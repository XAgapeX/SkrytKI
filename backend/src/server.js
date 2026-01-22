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

    // --- DELETE ACCOUNT REQUESTS ---
    await db.exec(`
    CREATE TABLE IF NOT EXISTS delete_account_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        email TEXT NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'pending', -- pending | approved | rejected
        createdAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id)
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
    console.log("Seeded locker_groups");
  }

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

  setInterval(() => {
    cleanupExpiredReservations().catch((e) =>
        console.error("Cleanup error:", e)
    );
  }, 30_000);

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

// ---------------- PROFILE (GET) ----------------
app.get("/api/profile", auth, async (req, res) => {
    try {
        const user = await db.get(
            `SELECT id, email, firstName, lastName, phone, role
             FROM users
             WHERE id = ?`,
            [req.user.id]
        );

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ ok: true, user });
    } catch (err) {
        console.error("GET PROFILE ERROR:", err);
        res.status(500).json({ error: "Failed to load profile" });
    }
});

app.post("/api/profile/delete-request", auth, requireRole("user"), async (req, res) => {
    const { reason = "" } = req.body || {};

    const existing = await db.get(
        `SELECT id FROM delete_account_requests
     WHERE userId = ? AND status = 'pending'`,
        [req.user.id]
    );

    if (existing) {
        return res.status(409).json({
            error: "Już wysłałeś prośbę o usunięcie konta"
        });
    }

    await db.run(
        `
    INSERT INTO delete_account_requests
    (userId, email, reason, status, createdAt)
    VALUES (?, ?, ?, 'pending', ?)
    `,
        [
            req.user.id,
            req.user.email,
            reason || null,
            new Date().toISOString()
        ]
    );

    res.json({ ok: true });
});


// ---------------- ADMIN: UPDATE ROLE ----------------
app.post("/api/setRole", auth, requireRole("admin"), async (req, res) => {
  const { email, role } = req.body || {};
  if (!email || !role) return res.status(400).json({ error: "Missing email/role" });

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

// ---------------- ADMIN: USER SEARCH ----------------
app.get("/api/admin/users", auth, requireRole("admin"), async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Missing email" });

  const user = await db.get(
      "SELECT id, email, role FROM users WHERE email = ?",
      [email]
  );

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ ok: true, user });
});

// ---------------- ADMIN: USER DELETE (SAFE) ----------------
app.delete(
    "/api/admin/users/:id",
    auth,
    requireRole("admin"),
    async (req, res) => {
        const id = Number(req.params.id);
        if (!id) {
            return res.status(400).json({ error: "Invalid user id" });
        }

        try {
            const user = await db.get(
                "SELECT id, email, role FROM users WHERE id = ?",
                [id]
            );

            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            if (user.role === "admin") {
                return res.status(403).json({
                    error: "Nie można usunąć konta administratora",
                });
            }

            const activePackages = await db.get(
                `
        SELECT COUNT(*) AS cnt
        FROM packages
        WHERE (senderId = ? OR recipientId = ?)
          AND status IN ('created', 'inTransit', 'delivered')
        `,
                [id, id]
            );

            if (activePackages.cnt > 0) {
                return res.status(409).json({
                    error: "Nie można usunąć użytkownika — ma aktywne paczki",
                });
            }

            await db.exec("BEGIN;");

            await db.run(
                "DELETE FROM delete_account_requests WHERE userId = ?",
                [id]
            );

            await db.run(
                `
        UPDATE lockers
        SET reservedBy = NULL,
            openedBy = NULL
        WHERE reservedBy = ? OR openedBy = ?
        `,
                [id, id]
            );

            await db.run(
                `
              DELETE FROM packages
              WHERE senderId = ? OR recipientId = ?
              `,
                [id, id]
            );

            await db.run("DELETE FROM users WHERE id = ?", [id]);

            await db.exec("COMMIT;");

            res.json({
                ok: true,
                message: `Użytkownik ${user.email} został usunięty`,
            });

        } catch (err) {
            await db.exec("ROLLBACK;");
            console.error("DELETE USER ERROR:", err);
            res.status(500).json({
                error: "Błąd usuwania użytkownika (powiązane dane)",
            });
        }
    }
);

// ---------------- ADMIN: USER DELETE REQUEST ----------------
app.get(
    "/api/admin/delete-requests",
    auth,
    requireRole("admin"),
    async (req, res) => {
        try {
            const rows = await db.all(`
                SELECT id, userId, email, reason, createdAt
                FROM delete_account_requests
                WHERE status = 'pending'
                ORDER BY createdAt DESC
            `);

            res.json({ ok: true, requests: rows });
        } catch (err) {
            console.error("GET DELETE REQUESTS ERROR:", err);
            res.status(500).json({ error: "Failed to load delete requests" });
        }
    }
);

// ---------------- ADMIN: USER DELETE REQUEST DENIED ----------------
app.post(
    "/api/admin/delete-requests/:id/reject",
    auth,
    requireRole("admin"),
    async (req, res) => {
        const id = Number(req.params.id);

        await db.run(
            `UPDATE delete_account_requests
             SET status = 'rejected'
             WHERE id = ?`,
            [id]
        );

        res.json({ ok: true });
    }
);

// ---------------- ADMIN: REPORTS (CSV) ----------------
function sendCsv(res, filename, header, rows) {
  let csv = "\uFEFF" + header + "\n";

  for (const row of rows) {
    csv += row
        .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",") + "\n";
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
      "Content-Disposition",
      `attachment; filename=${filename}`
  );

  res.send(csv);
}

app.get(
    "/api/admin/reports/:type",
    auth,
    requireRole("admin"),
    async (req, res) => {
      const { type } = req.params;

      try {
        // RAPORT PACZEK
        if (type === "packages") {
          const rows = await db.all(`
            SELECT
              P.packageId,
              P.status,
              P.createdAt,
              P.updatedAt,
              U1.email AS sender,
              U2.email AS recipient,
              G1.name AS origin,
              G2.name AS destination
            FROM packages P
                   JOIN users U1 ON U1.id = P.senderId
                   JOIN users U2 ON U2.id = P.recipientId
                   JOIN locker_groups G1 ON G1.id = P.originGroupId
                   JOIN locker_groups G2 ON G2.id = P.destinationGroupId
            ORDER BY P.createdAt DESC
          `);

          return sendCsv(
              res,
              "raport_paczki.csv",
              "packageId,status,createdAt,updatedAt,sender,recipient,origin,destination",
              rows.map(r => [
                r.packageId,
                r.status,
                r.createdAt,
                r.updatedAt,
                r.sender,
                r.recipient,
                r.origin,
                r.destination
              ])
          );
        }

        // RAPORT SKRYTEK
        if (type === "lockers") {
          const rows = await db.all(`
            SELECT
              L.id,
              G.name,
              L.status,
              L.lastAction,
              L.updatedAt
            FROM lockers L
                   JOIN locker_groups G ON G.id = L.groupId
            ORDER BY G.name, L.id
          `);

          return sendCsv(
              res,
              "raport_skrytki.csv",
              "lockerId,location,status,lastAction,updatedAt",
              rows.map(r => [
                r.id,
                r.name,
                r.status,
                r.lastAction || "",
                r.updatedAt
              ])
          );
        }

        // RAPORT AWARII
        if (type === "failures") {
          const rows = await db.all(`
          SELECT
            L.id,
            G.name,
            L.status,
            L.lastAction,
            L.updatedAt
          FROM lockers L
          JOIN locker_groups G ON G.id = L.groupId
          WHERE L.status = 'broken'
          ORDER BY L.updatedAt DESC
        `);

          return sendCsv(
              res,
              "raport_awarie.csv",
              "lockerId,location,status,lastAction,updatedAt",
              rows.map(r => [
                r.id,
                r.name,
                r.status,
                r.lastAction,
                r.updatedAt
              ])
          );
        }

        // RAPORT AKTYWNOŚCI
        if (type === "activity") {
          const rows = await db.all(`
          SELECT
            U.email,
            U.role,
            COUNT(DISTINCT P.id) AS packagesCount
          FROM users U
          LEFT JOIN packages P
            ON U.id = P.senderId OR U.id = P.recipientId
          GROUP BY U.id
          ORDER BY packagesCount DESC
        `);

          return sendCsv(
              res,
              "raport_aktywnosc.csv",
              "email,role,packagesCount",
              rows.map(r => [
                r.email,
                r.role,
                r.packagesCount
              ])
          );
        }

        // NIEZNANY TYP
        return res.status(400).json({ error: "Unknown report type" });

      } catch (err) {
        console.error("REPORT ERROR:", err);
        res.status(500).json({ error: "Failed to generate report" });
      }
    }
);

// ---------------- ADMIN: BLOCK LOCKER ----------------
app.post(
    "/api/admin/lockers/block",
    auth,
    requireRole("admin"),
    async (req, res) => {
        const { id } = req.body || {};
        const lockerId = Number(id);
        if (!lockerId) return res.status(400).json({ error: "Missing locker id" });

        const locker = await db.get(
            "SELECT status FROM lockers WHERE id=?",
            [lockerId]
        );
        if (!locker) return res.status(404).json({ error: "Locker not found" });

        if (["occupied", "reserved"].includes(locker.status)) {
            return res.status(400).json({
                error: "Nie można zablokować zajętej lub zarezerwowanej skrytki",
            });
        }

        if (locker.status === "broken") {
            return res.status(400).json({
                error: "Skrytka jest uszkodzona – napraw ją najpierw",
            });
        }

        await db.run(
            `UPDATE lockers
             SET status='blocked',
                 lastAction='adminBlock',
                 updatedAt=datetime('now')
             WHERE id=?`,
            [lockerId]
        );

        res.json({ ok: true, message: "Skrytka zablokowana" });
    }
);

// ---------------- ADMIN: UNBLOCK LOCKER ----------------
app.post(
    "/api/admin/lockers/unblock",
    auth,
    requireRole("admin"),
    async (req, res) => {
        const { id } = req.body || {};
        const lockerId = Number(id);
        if (!lockerId) return res.status(400).json({ error: "Missing locker id" });

        const locker = await db.get(
            "SELECT status FROM lockers WHERE id=?",
            [lockerId]
        );
        if (!locker) return res.status(404).json({ error: "Locker not found" });

        if (locker.status !== "blocked") {
            return res.status(400).json({
                error: "Skrytka nie jest zablokowana",
            });
        }

        await db.run(
            `UPDATE lockers
       SET status='free',
           lastAction='adminUnblock',
           updatedAt=datetime('now')
       WHERE id=?`,
            [lockerId]
        );

        res.json({ ok: true, message: "Skrytka odblokowana" });
    }
);

// ---------------- ADMIN: DELETE LOCKER ----------------
app.delete(
    "/api/admin/lockers/:id",
    auth,
    requireRole("admin"),
    async (req, res) => {
        const lockerId = Number(req.params.id);

        if (!lockerId) {
            return res.status(400).json({ error: "Invalid locker id" });
        }

        const locker = await db.get(
            "SELECT status FROM lockers WHERE id=?",
            [lockerId]
        );

        if (!locker) {
            return res.status(404).json({ error: "Locker not found" });
        }

        if (locker.status !== "free") {
            return res.status(409).json({
                error: "Można usunąć tylko wolną skrytkę",
            });
        }

        await db.run("DELETE FROM lockers WHERE id=?", [lockerId]);

        res.json({
            ok: true,
            message: `Skrytka ${lockerId} została usunięta`,
        });
    }
);

// ---------------- ADMIN: ADD LOCKER ----------------
app.post(
    "/api/admin/lockers",
    auth,
    requireRole("admin"),
    async (req, res) => {
        const { groupId } = req.body || {};
        const gId = Number(groupId);

        if (!gId) {
            return res.status(400).json({ error: "Missing groupId" });
        }

        const group = await db.get(
            "SELECT id FROM locker_groups WHERE id=?",
            [gId]
        );

        if (!group) {
            return res.status(404).json({ error: "Locker group not found" });
        }

        const result = await db.run(
            `
      INSERT INTO lockers (groupId, status, updatedAt)
      VALUES (?, 'free', datetime('now'))
      `,
            [gId]
        );

        res.json({
            ok: true,
            lockerId: result.lastID,
            message: `Dodano skrytkę ${result.lastID}`,
        });
    }
);

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
    if (!recipient) return res.status(404).json({ error: "Uzytkownik nie istnieje" });

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

    await db.exec("BEGIN;");
    try {
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

// ---------------- USER: PACKAGES IN TRANSIT ----------------
app.get("/api/packages/my", auth, requireRole("user"), async (req, res) => {
  try {
    const sent = await db.all(
        `
          SELECT *
          FROM packages
          WHERE senderId = ?
            AND status NOT IN ('received', 'cancelled')
          ORDER BY updatedAt DESC
        `,
        [req.user.id]
    );

    const incoming = await db.all(
        `
          SELECT *
          FROM packages
          WHERE recipientId = ?
            AND status NOT IN ('received', 'cancelled')
          ORDER BY updatedAt DESC
        `,
        [req.user.id]
    );

    res.json({ ok: true, sent, incoming });
  } catch (err) {
    console.error("MY PACKAGES ERROR:", err);
    res.status(500).json({ error: "Failed to load packages" });
  }
});

// ---------------- USER: PACKAGES HISTORY ----------------
app.get("/api/packages/history", auth, requireRole("user"), async (req, res) => {
  try {
    const rows = await db.all(
        `
      SELECT *
      FROM packages
      WHERE (senderId = ? OR recipientId = ?)
        AND status IN ('received', 'cancelled')
      ORDER BY updatedAt DESC
      `,
        [req.user.id, req.user.id]
    );

    res.json({ ok: true, packages: rows });
  } catch (err) {
    console.error("PACKAGES HISTORY ERROR:", err);
    res.status(500).json({ error: "Failed to load history" });
  }
});

// ---------------- COURIER: STATUS OVERVIEW ----------------
app.post("/api/courier/statusByGroup", auth, requireRole("courier"), async (req, res) => {
  const { groupId } = req.body || {};
  const gId = Number(groupId);
  if (!gId) return res.status(400).json({ error: "Missing groupId" });

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

// ---------------- COURIER: DELIVERY OPEN ----------------
app.post("/api/courier/delivery/open", auth, requireRole("courier"), async (req, res) => {
    const { groupId } = req.body || {};
    const gId = Number(groupId);
    if (!gId) {
        return res.status(400).json({ error: "Missing groupId" });
    }

    const packages = await db.all(
        `
            SELECT id
            FROM packages
            WHERE status = 'inTransit'
              AND destinationGroupId = ?
              AND courierId = ?
        `,
        [gId, req.user.id]
    );

    if (packages.length === 0) {
        return res.status(403).json({
            error: "You have no packages to deliver to this locker group"
        });
    }

    // wolne skrytki
    const freeLockers = await db.all(
        `
            SELECT id
            FROM lockers
            WHERE groupId = ?
              AND status = 'free'
            ORDER BY id ASC
        `,
        [gId]
    );

    if (freeLockers.length < packages.length) {
        return res.status(400).json({ error: "Not enough free lockers" });
    }

    const used = freeLockers.slice(0, packages.length);

    await db.exec("BEGIN;");
    try {
        for (const l of used) {
            await db.run(
                `
                UPDATE lockers
                SET status = 'reserved',
                    openedBy = ?,
                    lastAction = 'deliveryOpen',
                    updatedAt = datetime('now')
                WHERE id = ?
                  AND status = 'free'
                `,
                [req.user.id, l.id]
            );
        }

        await db.exec("COMMIT;");
    } catch (e) {
        await db.exec("ROLLBACK;");
        return res.status(500).json({ error: e.message });
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

    const pkgs = await db.all(
        `
    SELECT P.id AS packageRowId, P.currentLockerId
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
        for (const p of pkgs) {
            const result = await db.run(
                `
        UPDATE packages
        SET status='inTransit',
            currentLockerId=NULL,
            courierId=?,
            updatedAt=?
        WHERE id=?
          AND courierId IS NULL
        `,
                [req.user.id, nowIso(), p.packageRowId]
            );

            if (result.changes === 0) continue;

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
        return res.status(500).json({ error: e.message });
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
        `
            SELECT id
            FROM packages
            WHERE status='inTransit'
              AND destinationGroupId=?
              AND courierId=?
            ORDER BY updatedAt ASC
        `,
        [destId, req.user.id]
    );

    if (packages.length === 0) {
        return res.status(403).json({
            error: "No packages assigned to this courier for this locker group",
        });
    }

    const reservedLockers = await db.all(
        `
    SELECT id
    FROM lockers
    WHERE groupId=?
      AND status='reserved'
      AND lastAction='deliveryOpen'
    ORDER BY id ASC
    `,
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
                `
        UPDATE lockers
        SET status='occupied',
            lastAction='delivery',
            updatedAt=datetime('now')
        WHERE id=?
        `,
                [locker.id]
            );

            await db.run(
                `
        UPDATE packages
        SET status='delivered',
            currentLockerId=?,
            updatedAt=?
        WHERE id=?
          AND courierId=?
        `,
                [locker.id, nowIso(), pkg.id, req.user.id]
            );
        }

        await db.exec("COMMIT;");
    } catch (e) {
        await db.exec("ROLLBACK;");
        throw e;
    }

    res.json({
        ok: true,
        message: `Delivered ${packages.length} packages`,
    });
});

// ---------------- USER: RECEIVE ----------------
app.post("/api/lockers/receive", auth, requireRole("user"), async (req, res) => {
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

/// ---------------- SERVICE: MARK BROKEN ----------------
app.post("/api/lockers/broken", auth, requireRole("service"), async (req, res) => {
    const { id } = req.body || {};
    const lockerId = Number(id);
    if (!lockerId) return res.status(400).json({ error: "Missing id" });

    const locker = await db.get(
        "SELECT status FROM lockers WHERE id=?",
        [lockerId]
    );
    if (!locker) return res.status(404).json({ error: "Locker not found" });

    if (locker.status !== "free") {
        return res.status(400).json({
            error: "Tylko wolną skrytkę można oznaczyć jako uszkodzoną",
        });
    }

    await db.run(
        `UPDATE lockers
         SET status='broken',
             lastAction='serviceBroken',
             updatedAt=datetime('now')
         WHERE id=?`,
        [lockerId]
    );

    res.json({ ok: true, message: "Skrytka oznaczona jako uszkodzona" });
});

// ---------------- SERVICE: REPAIRED ----------------
app.post(
    "/api/lockers/repaired",
    auth,
    requireRole("service"),
    async (req, res) => {
        const { id } = req.body || {};
        const lockerId = Number(id);
        if (!lockerId) return res.status(400).json({ error: "Missing id" });

        const locker = await db.get(
            "SELECT status FROM lockers WHERE id=?",
            [lockerId]
        );
        if (!locker) return res.status(404).json({ error: "Locker not found" });

        if (locker.status !== "broken") {
            return res.status(400).json({
                error: "Można naprawić tylko uszkodzoną skrytkę",
            });
        }

        await db.run(
            `UPDATE lockers
             SET status='free',
                 lastAction='serviceRepaired',
                 updatedAt=datetime('now')
             WHERE id=?`,
            [lockerId]
        );

        res.json({ ok: true, message: "Skrytka naprawiona" });
    }
);

// ---------------- SERVICE: FORCE OPEN ----------------
app.post(
    "/api/lockers/force-open",
    auth,
    requireRole("service"),
    async (req, res) => {
        const { id } = req.body || {};
        const lockerId = Number(id);
        if (!lockerId) return res.status(400).json({ error: "Missing locker id" });

        const locker = await db.get(
            "SELECT status FROM lockers WHERE id=?",
            [lockerId]
        );
        if (!locker) return res.status(404).json({ error: "Locker not found" });

        if (!["occupied", "reserved"].includes(locker.status)) {
            return res.status(400).json({
                error: "Tylko zajętą lub zarezerwowaną skrytkę można otworzyć awaryjnie",
            });
        }

        await db.run(
            `UPDATE lockers
             SET status='open',
                 reservedBy=NULL,
                 reservationExpiresAt=NULL,
                 openedBy=?,
                 lastAction='serviceOpen',
                 updatedAt=datetime('now')
             WHERE id=?`,
            [req.user.id, lockerId]
        );

        res.json({ ok: true, message: "Skrytka otwarta awaryjnie" });
    }
);


// ---------------- SERVICE: OPEN ALL FREE LOCKERS ----------------
app.post(
    "/api/lockers/force-open-all",
    auth,
    requireRole("service"),
    async (req, res) => {
      const { groupId } = req.body || {};
      const gId = Number(groupId);

      if (!gId) {
        return res.status(400).json({ error: "Missing groupId" });
      }

      const result = await db.run(
          `UPDATE lockers
           SET status='open',
               openedBy=?,
               lastAction='serviceOpenAll',
               updatedAt=datetime('now')
           WHERE groupId=?
             AND status='free'`,
          [req.user.id, gId]
      );

      res.json({
        ok: true,
        opened: result.changes,
        message: `Otwarto ${result.changes} wolnych skrytek`,
      });
    }
);

// ---------------- SERVICE: CLOSE ----------------
app.post("/api/lockers/close", auth, requireRole("service"), async (req, res) => {
    const { id } = req.body || {};
    const lockerId = Number(id);
    if (!lockerId) return res.status(400).json({ error: "Missing locker id" });

    const locker = await db.get(
        "SELECT status FROM lockers WHERE id=?",
        [lockerId]
    );
    if (!locker) return res.status(404).json({ error: "Locker not found" });

    if (locker.status !== "open") {
        return res.status(400).json({ error: "Locker is not open" });
    }

    await db.run(
        `UPDATE lockers
     SET status='free',
         lastAction='serviceClose',
         updatedAt=datetime('now')
     WHERE id=?`,
        [lockerId]
    );

    res.json({ ok: true, message: "Skrytka zamknięta" });
});

// ---------------- ADMIN: GET ALL USERS ----------------
app.get("/api/admin/users/all", auth, requireRole("admin"), async (req, res) => {
    try {
        const users = await db.all(
            "SELECT id, email, role FROM users ORDER BY id ASC"
        );

        res.json({ ok: true, users });
    } catch (err) {
        console.error("GET ALL USERS ERROR:", err);
        res.status(500).json({ error: "Failed to load users" });
    }
});

// ---------------- ADMIN: CREATE STAFF USER ----------------
app.post(
    "/api/admin/create-user",
    auth,
    requireRole("admin"),
    async (req, res) => {
        const { email, password, role } = req.body || {};

        if (!email || !password || !role) {
            return res.status(400).json({ error: "Brak danych" });
        }

        if (!["courier", "service"].includes(role)) {
            return res.status(400).json({ error: "Nieprawidłowa rola" });
        }

        if (password.length < 5) {
            return res.status(400).json({ error: "Hasło min. 5 znaków" });
        }

        try {
            const hashed = await bcrypt.hash(password, 10);

            await db.run(
                `
                INSERT INTO users (email, password, role)
                VALUES (?, ?, ?)
                `,
                [email.toLowerCase(), hashed, role]
            );

            res.json({ ok: true });
        } catch (err) {
            if (err.message.includes("UNIQUE")) {
                return res.status(400).json({ error: "Email już istnieje" });
            }

            console.error("CREATE STAFF ERROR:", err);
            res.status(500).json({ error: "Nie udało się utworzyć konta" });
        }
    }
);



