import "dotenv/config";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("Missing JWT_SECRET in environment.");
  console.error("Set it, e.g.: JWT_SECRET=some-long-random-string");
  process.exit(1);
}

const RESERVATION_MINUTES = Number(process.env.RESERVATION_MINUTES || 5);

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- HEALTH CHECK ----------------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ---------------- DATABASE INIT ----------------
let db;

function nowIso() {
  return new Date().toISOString();
}

async function cleanupExpiredReservations() {
  // Any reserved locker past reservationExpiresAt -> free it
  await db.run(`
    UPDATE lockers
    SET status='free',
        reservedBy=NULL,
        reservationExpiresAt=NULL,
        lastAction='reservationExpired',
        updatedAt=datetime('now')
    WHERE status='reserved'
      AND reservationExpiresAt IS NOT NULL
      AND datetime(reservationExpiresAt) <= datetime('now')
  `);
}

(async () => {
  db = await open({ filename: "./db.sqlite", driver: sqlite3.Database });

  await db.exec("PRAGMA foreign_keys = ON;");
  await db.exec("PRAGMA busy_timeout = 5000;");

  // --- USERS ---
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user'
    );
  `);

  // --- GROUPS ---
  await db.exec(`
    CREATE TABLE IF NOT EXISTS locker_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT
    );
  `);

  // --- LOCKERS (PHYSICAL) ---
  // status: free | reserved | occupied | broken
  await db.exec(`
    CREATE TABLE IF NOT EXISTS lockers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      groupId INTEGER NOT NULL,
      status TEXT DEFAULT 'free',
      reservedBy INTEGER,
      reservationExpiresAt TEXT,
      openedBy INTEGER,
      lastAction TEXT,
      updatedAt TEXT,
      FOREIGN KEY (groupId) REFERENCES locker_groups(id),
      FOREIGN KEY (reservedBy) REFERENCES users(id),
      FOREIGN KEY (openedBy) REFERENCES users(id)
    );
  `);

  // --- PACKAGES (LOGICAL SHIPMENTS) ---
  // status: created | inTransit | delivered | received | cancelled
  await db.exec(`
    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      packageId TEXT UNIQUE NOT NULL,
      packageName TEXT,
      senderId INTEGER NOT NULL,
      recipientId INTEGER NOT NULL,
      originGroupId INTEGER NOT NULL,
      destinationGroupId INTEGER NOT NULL,
      status TEXT NOT NULL,
      currentLockerId INTEGER,        -- locker holding the package (when created/delivered)
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (senderId) REFERENCES users(id),
      FOREIGN KEY (recipientId) REFERENCES users(id),
      FOREIGN KEY (originGroupId) REFERENCES locker_groups(id),
      FOREIGN KEY (destinationGroupId) REFERENCES locker_groups(id),
      FOREIGN KEY (currentLockerId) REFERENCES lockers(id)
    );
  `);

  // --- MIGRATIONS / COMPAT: If you had older DB with extra columns, ignore.
  // We intentionally remodeled, so we don't try to keep old "lockers.packageId" etc.

  // Seed groups if empty
  const groupCount = await db.get("SELECT COUNT(*) AS c FROM locker_groups");
  if (groupCount.c === 0) {
    await db.run(
        "INSERT INTO locker_groups (name, location) VALUES (?, ?)",
        ["Kraków - Długa 15", "50.05831081733932, 19.99935917523723"]
    );
    await db.run(
        "INSERT INTO locker_groups (name, location) VALUES (?, ?)",
        ["Warszawa - Marszałkowska 10", "55.2231610624876026, 21.03468982125436"]
    );
    await db.run(
        "INSERT INTO locker_groups (name, location) VALUES (?, ?)",
        ["Tarnów - Nowy Świat 10", "50.012218531600666, 20.986982194583156"]
    );
    console.log("✅ Seeded locker_groups");
  }

  // Seed lockers if empty
  const lockerCount = await db.get("SELECT COUNT(*) AS c FROM lockers");
  if (lockerCount.c === 0) {
    const lockerGroups = [
      { groupId: 1, count: 3 },
      { groupId: 2, count: 5 },
      { groupId: 3, count: 2 },
    ];

    for (const group of lockerGroups) {
      for (let i = 0; i < group.count; i++) {
        await db.run(
            "INSERT INTO lockers (groupId, status, updatedAt) VALUES (?, 'free', datetime('now'))",
            [group.groupId]
        );
      }
    }
    console.log("Seeded lockers in groups");
  } else {
    console.log(`Lockers already exist (${lockerCount.c})`);
  }

  console.log("SQLite ready");

  // Periodic cleanup
  setInterval(() => {
    cleanupExpiredReservations().catch((e) =>
        console.error("Cleanup error:", e)
    );
  }, 30_000);

  // Start server
  app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
})();

// ---------------- AUTH MIDDLEWARE ----------------
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing Authorization header" });

  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "Invalid Authorization format" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    res.status(403).json({ error: "Invalid or expired token" });
  }
}

// ---------------- ROLE HELPERS ----------------
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Missing user information" });
    if (req.user.role !== role) {
      return res.status(403).json({ error: `Access denied — ${role} role required.` });
    }
    next();
  };
}
function requireAnyRole(roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Missing user information" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Access denied" });
    next();
  };
}

// ---------------- REGISTER ----------------
app.post("/api/register", async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    password,
    phone,
    acceptTerms,
    acceptPrivacy,
    marketing,
  } = req.body || {};

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: "Brak wymaganych danych" });
  }

  if (!acceptTerms || !acceptPrivacy) {
    return res.status(400).json({
      error: "Musisz zaakceptować regulamin i politykę prywatności",
    });
  }

  // tylko userzy z domeny
  if (!email.toLowerCase().endsWith("@skrytki.pl")) {
    return res.status(400).json({
      error: "Rejestracja tylko dla adresów @skrytki.pl",
    });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);

    await db.run(
        `
      INSERT INTO users
      (email, password, firstName, lastName, phone,
       acceptTerms, acceptPrivacy, marketing, role, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'user', ?)
      `,
        [
          email,
          hashed,
          firstName,
          lastName,
          phone || null,
          acceptTerms ? 1 : 0,
          acceptPrivacy ? 1 : 0,
          marketing ? 1 : 0,
          new Date().toISOString(),
        ]
    );

    res.json({ ok: true });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(400).json({ error: "Email już istnieje" });
    }
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ error: "Błąd rejestracji" });
  }
});

// ---------------- LOGIN ----------------
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = await db.get("SELECT * FROM users WHERE email = ?", [email]);

  if (!user) return res.status(400).json({ ok: false, error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ ok: false, error: "Invalid credentials" });

  const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "2h" }
  );

  res.json({ ok: true, token });
});

// ---------------- PROFILE ----------------

app.put("/api/profile", auth, async (req, res) => {
    const { firstName, lastName, phone, password } = req.body;

    try {
        if (password && password.length < 5) {
            return res.status(400).json({ error: "Hasło musi mieć min. 5 znaków" });
        }

        if (password) {
            const hashed = await bcrypt.hash(password, 10);
            await db.run(
                `UPDATE users SET
           firstName=?,
           lastName=?,
           phone=?,
           password=?
         WHERE id=?`,
                [firstName, lastName, phone, hashed, req.user.id]
            );
        } else {
            await db.run(
                `UPDATE users SET
           firstName=?,
           lastName=?,
           phone=?
         WHERE id=?`,
                [firstName, lastName, phone, req.user.id]
            );
        }

        res.json({ ok: true });
    } catch (err) {
        console.error("PROFILE UPDATE:", err);
        res.status(500).json({ error: "Nie udało się zapisać profilu" });
    }
});


// ---------------- ADMIN: UPDATE ROLE ----------------
app.post("/api/setRole", auth, requireRole("admin"), async (req, res) => {
  const { email, role } = req.body || {};
  if (!email || !role) return res.status(400).json({ error: "Missing email/role" });

  // Optional hardening: block creating more admins unless explicitly allowed
  if (role === "admin" && process.env.ALLOW_ADMIN_ESCALATION !== "true") {
    return res.status(403).json({ error: "Admin escalation is disabled" });
  }

  try {
    const result = await db.run("UPDATE users SET role = ? WHERE email = ?", [role, email]);
    if (result.changes === 0) return res.status(404).json({ error: "User not found" });
    res.json({ ok: true, message: `Role updated to ${role}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------- LOCKER GROUPS ----------------
app.get("/api/lockerGroups", auth, async (req, res) => {
  try {
    const groups = await db.all("SELECT * FROM locker_groups");
    res.json({ ok: true, groups });
  } catch (err) {
    console.error("Error loading locker groups:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------- LOCKERS (ADMIN/SERVICE) ----------------
app.get("/api/lockers", auth, requireAnyRole(["admin", "service"]), async (req, res) => {
  await cleanupExpiredReservations();
  const lockers = await db.all("SELECT * FROM lockers ORDER BY groupId ASC, id ASC");
  res.json({ ok: true, lockers });
});

// ---------------- USER: PREVIEW FREE LOCKER ----------------
app.get("/api/lockers/preview/:groupId", auth, async (req, res) => {
  await cleanupExpiredReservations();
  const groupId = Number(req.params.groupId);
  if (!groupId) return res.status(400).json({ error: "Invalid groupId" });

  const locker = await db.get(
      "SELECT id FROM lockers WHERE groupId=? AND status='free' ORDER BY id ASC LIMIT 1",
      [groupId]
  );

  res.json({ ok: true, lockerId: locker ? locker.id : null });
});

// ---------------- USER: OPEN (RESERVE) LOCKER (ATOMIC + EXPIRY) ----------------
app.post("/api/lockers/open", auth, requireRole("user"), async (req, res) => {
  await cleanupExpiredReservations();

  const { sendGroupId } = req.body || {};
  const groupId = Number(sendGroupId);
  if (!groupId) return res.status(400).json({ error: "Missing sendGroupId" });

  const expiresAtSql = `datetime('now', '+${RESERVATION_MINUTES} minutes')`;

  try {
    // Atomic reservation: update exactly one free locker and return it
    const row = await db.get(
        `
      UPDATE lockers
      SET status='reserved',
          reservedBy=?,
          reservationExpiresAt=${expiresAtSql},
          openedBy=?,
          lastAction='open',
          updatedAt=datetime('now')
      WHERE id = (
        SELECT id FROM lockers
        WHERE groupId=? AND status='free'
        ORDER BY id ASC
        LIMIT 1
      )
      RETURNING id, reservationExpiresAt;
      `,
        [req.user.id, req.user.id, groupId]
    );

    if (!row) return res.status(400).json({ error: "No free lockers available" });

    res.json({
      ok: true,
      lockerId: row.id,
      reservationExpiresAt: row.reservationExpiresAt,
    });
  } catch (err) {
    console.error("OPEN ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- USER: CANCEL RESERVATION ----------------
app.post("/api/lockers/cancel", auth, requireRole("user"), async (req, res) => {
  await cleanupExpiredReservations();
  const { lockerId } = req.body || {};
  const id = Number(lockerId);
  if (!id) return res.status(400).json({ error: "Missing lockerId" });

  const result = await db.run(
      `
    UPDATE lockers
    SET status='free',
        reservedBy=NULL,
        reservationExpiresAt=NULL,
        openedBy=NULL,
        lastAction='cancel',
        updatedAt=datetime('now')
    WHERE id=?
      AND status='reserved'
      AND reservedBy=?
    `,
      [id, req.user.id]
  );

  // If no changes, either it wasn't reserved or not yours → still return ok to keep UX simple
  res.json({ ok: true, changed: result.changes });
});

// ---------------- USER: SEND (from reserved locker) ----------------
app.post("/api/lockers/send", auth, requireRole("user"), async (req, res) => {
  await cleanupExpiredReservations();

  try {
    const {
      lockerId,
      destinationGroupId = 0,
      recipientEmail = "",
      packageName = "",
    } = req.body || {};

    const lId = Number(lockerId);
    const destId = Number(destinationGroupId);

    if (!lId || !destId) {
      return res.status(400).json({ error: "Missing locker or destination" });
    }
    if (!recipientEmail.trim()) {
      return res.status(400).json({ error: "Missing recipient email." });
    }

    const recipient = await db.get("SELECT id FROM users WHERE email = ?", [recipientEmail.trim()]);
    if (!recipient) return res.status(404).json({ error: "Recipient not found" });

    // Verify locker is reserved by this user and not expired
    const locker = await db.get(
        `
      SELECT *
      FROM lockers
      WHERE id=?
        AND status='reserved'
        AND reservedBy=?
        AND (reservationExpiresAt IS NULL OR datetime(reservationExpiresAt) > datetime('now'))
      `,
        [lId, req.user.id]
    );
    if (!locker) {
      return res.status(400).json({ error: "Locker not reserved by you or reservation expired" });
    }

    const pkgId = "PKG-" + Math.random().toString(36).substring(2, 10).toUpperCase();

    // Transaction: occupy locker + create package
    await db.exec("BEGIN;");
    try {
      // Occupy the physical locker (origin)
      await db.run(
          `
        UPDATE lockers
        SET status='occupied',
            reservedBy=NULL,
            reservationExpiresAt=NULL,
            lastAction='send',
            updatedAt=datetime('now')
        WHERE id=?
          AND status='reserved'
          AND reservedBy=?
        `,
          [lId, req.user.id]
      );

      // Create package in "created" state sitting in this locker
      await db.run(
          `
        INSERT INTO packages (
          packageId, packageName,
          senderId, recipientId,
          originGroupId, destinationGroupId,
          status, currentLockerId,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, 'created', ?, ?, ?)
        `,
          [
            pkgId,
            packageName || null,
            req.user.id,
            recipient.id,
            locker.groupId,
            destId,
            lId,
            nowIso(),
            nowIso(),
          ]
      );

      await db.exec("COMMIT;");
    } catch (e) {
      await db.exec("ROLLBACK;");
      throw e;
    }

    res.json({
      ok: true,
      lockerId: lId,
      packageId: pkgId,
      message: "Package successfully sent",
    });
  } catch (err) {
    console.error("SEND ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- USER: CHECK IF HAS PENDING PACKAGE ----------------
app.get("/api/user/pending", auth, requireRole("user"), async (req, res) => {
  try {
    const pkg = await db.get(
        `
      SELECT
        P.packageId,
        P.currentLockerId AS lockerId,
        L.groupId,
        G.name AS groupName
      FROM packages P
      JOIN lockers L ON L.id = P.currentLockerId
      JOIN locker_groups G ON G.id = L.groupId
      WHERE P.recipientId=?
        AND P.status='delivered'
      ORDER BY P.updatedAt ASC
      LIMIT 1
      `,
        [req.user.id]
    );

    if (!pkg) return res.json({ ok: true, pending: false });

    res.json({
      ok: true,
      pending: true,
      locker: {
        id: pkg.lockerId,
        groupId: pkg.groupId,
        packageId: pkg.packageId,
        location: pkg.groupName,
      },
    });
  } catch (err) {
    console.error("Error checking user pending package:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------- COURIER: STATUS OVERVIEW ----------------
app.post("/api/courier/statusByGroup", auth, requireRole("courier"), async (req, res) => {
  const { groupId } = req.body || {};
  const gId = Number(groupId);
  if (!gId) return res.status(400).json({ error: "Missing groupId" });

  // Packages ready to pickup: created + in an occupied locker in this group
  const pickupReady = await db.all(
      `
    SELECT P.packageId, P.packageName, P.destinationGroupId, P.currentLockerId
    FROM packages P
    JOIN lockers L ON L.id = P.currentLockerId
    WHERE P.status='created'
      AND L.groupId=?
      AND L.status='occupied'
    ORDER BY P.updatedAt ASC
    `,
      [gId]
  );

  // Packages to deliver: inTransit and destination = this group
  const toDeliver = await db.all(
      `
    SELECT packageId, packageName, destinationGroupId
    FROM packages
    WHERE status='inTransit'
      AND destinationGroupId=?
    ORDER BY updatedAt ASC
    `,
      [gId]
  );

  res.json({ ok: true, groupId: gId, pickupReady, toDeliver });
});

// ---------------- COURIER: OPEN LOCKERS FOR PICKUP ----------------
app.post("/api/courier/open", auth, requireRole("courier"), async (req, res) => {
  const { groupId } = req.body || {};
  const gId = Number(groupId);
  if (!gId) return res.status(400).json({ error: "Missing groupId" });

  const rows = await db.all(
      `
    SELECT L.id
    FROM lockers L
    JOIN packages P ON P.currentLockerId = L.id
    WHERE L.groupId=?
      AND L.status='occupied'
      AND P.status='created'
    `,
      [gId]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: "No packages ready in this locker group" });
  }

  await db.run(
      `
    UPDATE lockers
    SET openedBy=?,
        lastAction='courierOpen',
        updatedAt=datetime('now')
    WHERE groupId=?
      AND status='occupied'
      AND id IN (${rows.map(() => "?").join(",")})
    `,
      [req.user.id, gId, ...rows.map((r) => r.id)]
  );

  res.json({
    ok: true,
    message: `Opened ${rows.length} lockers for pickup`,
    count: rows.length,
  });
});

app.post("/api/courier/delivery/open", auth, requireRole("courier"), async (req, res) => {
    const { groupId } = req.body;
    const gId = Number(groupId);
    if (!gId) return res.status(400).json({ error: "Missing groupId" });

    // Paczki w drodze do tego paczkomatu
    const packages = await db.all(
        `SELECT id FROM packages
     WHERE status='inTransit' AND destinationGroupId=?`,
        [gId]
    );

    if (packages.length === 0) {
        return res.status(404).json({ error: "No packages to deliver to this locker group" });
    }

    // Wolne skrytki w tym paczkomacie
    const freeLockers = await db.all(
        `SELECT id FROM lockers
     WHERE groupId=? AND status='free'
     ORDER BY id ASC`,
        [gId]
    );

    if (freeLockers.length < packages.length) {
        return res.status(400).json({ error: "Not enough free lockers" });
    }

    const used = freeLockers.slice(0, packages.length);

    // Rezerwujemy skrytki
    for (const l of used) {
        await db.run(
            `UPDATE lockers
       SET status='reserved',
           openedBy=?,
           lastAction='deliveryOpen',
           updatedAt=datetime('now')
       WHERE id=?`,
            [req.user.id, l.id]
        );
    }

    res.json({
        ok: true,
        count: used.length,
        lockers: used.map(l => l.id)
    });
});

// ---------------- COURIER: PICKUP ----------------
app.post("/api/lockers/pickup", auth, requireRole("courier"), async (req, res) => {
  const { groupId } = req.body || {};
  const gId = Number(groupId);
  if (!gId) return res.status(400).json({ error: "Missing groupId" });

  // Find all created packages physically in occupied lockers at this group
  const pkgs = await db.all(
      `
    SELECT P.id AS packageRowId, P.packageId, P.currentLockerId
    FROM packages P
    JOIN lockers L ON L.id = P.currentLockerId
    WHERE P.status='created'
      AND L.groupId=?
      AND L.status='occupied'
    `,
      [gId]
  );

  if (pkgs.length === 0) {
    return res.status(404).json({ error: "No outgoing packages ready here" });
  }

  await db.exec("BEGIN;");
  try {
    // Mark packages in transit + free their lockers (physical lockers become free after pickup)
    for (const p of pkgs) {
      await db.run(
          `
        UPDATE packages
        SET status='inTransit',
            currentLockerId=NULL,
            updatedAt=?
        WHERE id=?
        `,
          [nowIso(), p.packageRowId]
      );

      await db.run(
          `
        UPDATE lockers
        SET status='free',
            openedBy=?,
            lastAction='pickup',
            updatedAt=datetime('now')
        WHERE id=?
        `,
          [req.user.id, p.currentLockerId]
      );
    }

    await db.exec("COMMIT;");
  } catch (e) {
    await db.exec("ROLLBACK;");
    throw e;
  }

  res.json({
    ok: true,
    message: `Picked up ${pkgs.length} packages from locker group ${gId}`,
  });
});

// ---------------- COURIER: DELIVER ----------------
app.post("/api/lockers/deliver", auth, requireRole("courier"), async (req, res) => {
    const { toGroupId } = req.body;
    const destId = Number(toGroupId);
    if (!destId) return res.status(400).json({ error: "Missing toGroupId" });

    const packages = await db.all(
        `SELECT id FROM packages
         WHERE status='inTransit' AND destinationGroupId=?
         ORDER BY updatedAt ASC`,
        [destId]
    );

    if (packages.length === 0) {
        return res.status(404).json({ error: "No packages to deliver" });
    }

    const reservedLockers = await db.all(
        `SELECT id FROM lockers
     WHERE groupId=? AND status='reserved' AND lastAction='deliveryOpen'
     ORDER BY id ASC`,
        [destId]
    );

    if (reservedLockers.length < packages.length) {
        return res.status(400).json({ error: "Not enough reserved lockers" });
    }

    await db.exec("BEGIN;");
    try {
        for (let i = 0; i < packages.length; i++) {
            const pkg = packages[i];
            const locker = reservedLockers[i];

            await db.run(
                `UPDATE lockers
                 SET status='occupied',
                     lastAction='delivery',
                     updatedAt=datetime('now')
                 WHERE id=?`,
                [locker.id]
            );

            await db.run(
                `UPDATE packages
                 SET status='delivered',
                     currentLockerId=?,
                     updatedAt=?
                 WHERE id=?`,
                [locker.id, nowIso(), pkg.id]
            );
        }

        await db.exec("COMMIT;");
    } catch (e) {
        await db.exec("ROLLBACK;");
        throw e;
    }

    res.json({
        ok: true,
        message: `Delivered ${packages.length} packages`
    });
});


// ---------------- USER: RECEIVE ----------------
app.post("/api/lockers/receive", auth, requireRole("user"), async (req, res) => {
  // Find earliest delivered package for user
  const pkg = await db.get(
      `
    SELECT id, packageId, currentLockerId
    FROM packages
    WHERE recipientId=?
      AND status='delivered'
      AND currentLockerId IS NOT NULL
    ORDER BY updatedAt ASC
    LIMIT 1
    `,
      [req.user.id]
  );

  if (!pkg) return res.status(404).json({ error: "No package waiting for you" });

  await db.exec("BEGIN;");
  try {
    // Free the locker
    await db.run(
        `
      UPDATE lockers
      SET status='free',
          openedBy=?,
          lastAction='receive',
          updatedAt=datetime('now')
      WHERE id=?
        AND status='occupied'
      `,
        [req.user.id, pkg.currentLockerId]
    );

    // Mark package received
    await db.run(
        `
      UPDATE packages
      SET status='received',
          updatedAt=?,
          currentLockerId=NULL
      WHERE id=?
      `,
        [nowIso(), pkg.id]
    );

    await db.exec("COMMIT;");
  } catch (e) {
    await db.exec("ROLLBACK;");
    throw e;
  }

  res.json({ ok: true, message: `Package ${pkg.packageId} picked up` });
});

// ---------------- SERVICE: BROKEN ----------------
app.post("/api/lockers/broken", auth, requireRole("service"), async (req, res) => {
  const { id } = req.body || {};
  const lockerId = Number(id);
  if (!lockerId) return res.status(400).json({ error: "Missing id" });

  // Optional safety: don't break occupied locker
  const locker = await db.get("SELECT status FROM lockers WHERE id=?", [lockerId]);
  if (!locker) return res.status(404).json({ error: "Locker not found" });
  if (locker.status === "occupied" || locker.status === "reserved") {
    return res.status(400).json({ error: "Cannot mark occupied/reserved locker as broken" });
  }

  await db.run(
      `UPDATE lockers SET status='broken', updatedAt=datetime('now'), lastAction='broken' WHERE id=?`,
      [lockerId]
  );
  res.json({ ok: true, message: `Locker ${lockerId} marked as broken` });
});

// ---------------- SERVICE: REPAIRED ----------------
app.post("/api/lockers/repaired", auth, requireRole("service"), async (req, res) => {
  const { id } = req.body || {};
  const lockerId = Number(id);
  if (!lockerId) return res.status(400).json({ error: "Missing id" });

  await db.run(
      `UPDATE lockers SET status='free', updatedAt=datetime('now'), lastAction='repaired' WHERE id=?`,
      [lockerId]
  );
  res.json({ ok: true, message: `Locker ${lockerId} repaired and set to free` });
});
