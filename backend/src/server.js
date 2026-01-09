import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- HEALTH CHECK ----------------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ---------------- DATABASE INIT ----------------
let db;
(async () => {
  db = await open({ filename: "./db.sqlite", driver: sqlite3.Database });

  // Użytkownicy
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user'
    );
  `);

  // Grupy paczkomatów (lokalizacje)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS locker_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT
    );
  `);

  // Szafki w grupach
  await db.exec(`
    CREATE TABLE IF NOT EXISTS lockers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      groupId INTEGER,
      status TEXT DEFAULT 'free',            -- free | occupied | broken | inTransit
      packageId TEXT,
      assignedTo INTEGER,
      openedBy INTEGER,
      destinationGroupId INTEGER,
      lastAction TEXT,
      updatedAt TEXT,
      FOREIGN KEY (groupId) REFERENCES locker_groups(id)
    );
  `);

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
          "INSERT INTO lockers (groupId, status) VALUES (?, 'free')",
          [group.groupId]
        );
      }
    }
    console.log("Seeded lockers in groups");
  } else {
    console.log(`Lockers already exist (${lockerCount.c})`);
  }

  await db.exec("PRAGMA busy_timeout = 5000;");

  console.log("SQLite ready");

  // Start the server
  app.listen(3001, () => console.log("Backend running on port 3001"));
})();

// ---------------- AUTH MIDDLEWARE ----------------
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "Invalid Authorization format" });
  }

  try {
    const decoded = jwt.verify(token, "super-secret-key");
    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    res.status(403).json({ error: "Invalid or expired token" });
  }
}

// ---------------- REUSABLE ROLE CHECK HELPER ----------------
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Missing user information" });
    }

    if (req.user.role !== role) {
      return res
        .status(403)
        .json({ error: `Access denied — ${role} role required.` });
    }

    next();
  };
}

// ---------------- REGISTER ----------------
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const hashed = await bcrypt.hash(password, 10);
    await db.run("INSERT INTO users (email, password) VALUES (?, ?)", [
      email,
      hashed,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ---------------- LOGIN ----------------
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await db.get("SELECT * FROM users WHERE email = ?", [email]);

  if (!user) {
    return res.status(400).json({ ok: false, error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(400).json({ ok: false, error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    "super-secret-key",
    { expiresIn: "2h" }
  );

  res.json({ ok: true, token });
});

// ---------------- PROFILE (JWT protected) ----------------
app.get("/api/profile", auth, async (req, res) => {
  const user = await db.get(
    "SELECT id, email, role FROM users WHERE id = ?",
    [req.user.id]
  );

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ ok: true, user });
});

// ---------------- ADMIN: UPDATE ROLE ----------------
app.post("/api/setRole", auth, requireRole("admin"), async (req, res) => {
  const { email, role } = req.body;
  try {
    const result = await db.run("UPDATE users SET role = ? WHERE email = ?", [
      role,
      email,
    ]);

    if (result.changes === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ ok: true, message: `Role updated to ${role}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------- ADMIN: LIST USERS ----------------
app.get("/api/lockerGroups", auth, async (req, res) => {
  try {
    const groups = await db.all("SELECT * FROM locker_groups");
    res.json({ ok: true, groups });
  } catch (err) {
    console.error("Error loading locker groups:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/lockers", auth, async (req, res) => {
  const allowed = ["admin", "service"];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied" });
  }
  const lockers = await db.all("SELECT * FROM lockers");
  res.json({ ok: true, lockers });
});

// ---------------- USER: PREVIEW FREE LOCKER ----------------
app.get("/api/lockers/preview/:groupId", auth, async (req, res) => {
  const groupId = Number(req.params.groupId);

  if (!groupId) {
    return res.status(400).json({ error: "Invalid groupId" });
  }

  const locker = await db.get(
      "SELECT id FROM lockers WHERE groupId=? AND status='free' ORDER BY id ASC LIMIT 1",
      [groupId]
  );

  if (!locker) {
    return res.json({ ok: true, lockerId: null });
  }

  res.json({ ok: true, lockerId: locker.id });
});


// ---------------- USER: OPEN LOCKER ----------------
app.post("/api/lockers/open", auth, requireRole("user"), async (req, res) => {
  const { sendGroupId } = req.body;

  if (!sendGroupId) {
    return res.status(400).json({ error: "Missing sendGroupId" });
  }

  const locker = await db.get(
      "SELECT * FROM lockers WHERE groupId=? AND status='free' LIMIT 1",
      [sendGroupId]
  );

  if (!locker) {
    return res.status(400).json({ error: "No free lockers available" });
  }

  await db.run(
      `UPDATE lockers
     SET status='reserved',
         openedBy=?,
         lastAction='open',
         updatedAt=datetime('now')
     WHERE id=?`,
      [req.user.id, locker.id]
  );

  res.json({
    ok: true,
    lockerId: locker.id,
  });
});


// ---------------- USER: SEND ----------------
app.post("/api/lockers/send", auth, requireRole("user"), async (req, res) => {
  try {
    const {
      lockerId,
      destinationGroupId = 0,
      recipientEmail = "",
      packageName = "",
    } = req.body;

    console.log("SEND request:", req.body);

    if (!Number(lockerId) || !Number(destinationGroupId)) {
      return res.status(400).json({ error: "Missing locker or destination" });
    }

    if (!recipientEmail.trim()) {
      return res.status(400).json({ error: "Missing recipient email." });
    }

    const recipient = await db.get(
        "SELECT id FROM users WHERE email = ?",
        [recipientEmail]
    );
    if (!recipient) {
      return res.status(404).json({ error: "Recipient not found" });
    }

    const locker = await db.get(
        "SELECT * FROM lockers WHERE id=? AND status='reserved'",
        [lockerId]
    );
    if (!locker) {
      return res
          .status(400)
          .json({ error: "Locker not reserved or reservation expired" });
    }

    const pkgId =
        "PKG-" + Math.random().toString(36).substring(2, 10).toUpperCase();

    await db.run(
        `UPDATE lockers
         SET status='occupied',
             packageId=?,
             packageName=?,
             assignedTo=?,
             destinationGroupId=?,
             lastAction='send',
             updatedAt=datetime('now')
         WHERE id=?`,
        [
          pkgId,
          packageName,
          recipient.id,
          destinationGroupId,
          lockerId,
        ]
    );

    res.json({
      ok: true,
      lockerId,
      packageId: pkgId,
      message: "Package successfully sent",
    });
  } catch (err) {
    console.error("SEND ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- USER: CANCEL OPEN LOCKER ----------------
app.post("/api/lockers/cancel", auth, requireRole("user"), async (req, res) => {
  const { lockerId } = req.body;

  if (!lockerId) {
    return res.status(400).json({ error: "Missing lockerId" });
  }

  const locker = await db.get(
      "SELECT * FROM lockers WHERE id=? AND status='reserved'",
      [lockerId]
  );

  if (!locker) {
    return res.json({ ok: true }); // nic do anulowania
  }

  await db.run(
      `UPDATE lockers
     SET status='free',
         openedBy=NULL,
         lastAction='cancel',
         updatedAt=datetime('now')
     WHERE id=?`,
      [lockerId]
  );

  res.json({ ok: true });
});

// ---------------- USER: CHECK IF HAS PENDING PACKAGE ----------------
app.get("/api/user/pending", auth, requireRole("user"), async (req, res) => {
  try {
    const locker = await db.get(
      `SELECT L.id, L.groupId, G.name AS groupName, L.packageId, L.lastAction
       FROM lockers L
       JOIN locker_groups G ON G.id = L.groupId
       WHERE L.assignedTo=? AND L.status='occupied' AND L.lastAction='delivery'
       LIMIT 1`,
      [req.user.id]
    );

    if (!locker)
      return res.json({ ok: true, pending: false });

    res.json({
      ok: true,
      pending: true,
      locker: {
        id: locker.id,
        groupId: locker.groupId,
        packageId: locker.packageId,
        location: locker.groupName,
      },
    });
  } catch (err) {
    console.error("Error checking user pending package:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------- COURIER: STATUS OVERVIEW ----------------
app.post("/api/courier/statusByGroup", auth, requireRole("courier"), async (req, res) => {
  const { groupId } = req.body;
  if (!groupId) {
    return res.status(400).json({ error: "Missing groupId" });
  }

  // Paczki gotowe do odbioru
  const pickupReady = await db.all(
    "SELECT * FROM lockers WHERE groupId=? AND status='occupied' AND lastAction='send'",
    [groupId]
  );

  // Paczki do dostarczenia
  const toDeliver = await db.all(
    "SELECT * FROM lockers WHERE status='inTransit' AND destinationGroupId=?",
    [groupId]
  );

  res.json({ ok: true, groupId, pickupReady, toDeliver });
});
// ---------------- COURIER: PICKUP ----------------
app.post("/api/lockers/pickup", auth, requireRole("courier"), async (req, res) => {
  const { groupId } = req.body;
  if (!groupId) {
    return res.status(400).json({ error: "Missing groupId" });
  }

  const lockers = await db.all(
    "SELECT * FROM lockers WHERE groupId=? AND status='occupied' AND lastAction='send'",
    [groupId]
  );

  if (lockers.length === 0) {
    return res.status(404).json({ error: "No outgoing packages ready here" });
  }

  for (const locker of lockers) {
    await db.run(
      `UPDATE lockers
       SET status='inTransit',
           groupId=NULL,
           lastAction='inTransit',
           openedBy=?,
           updatedAt=datetime('now')
       WHERE id=?`,
      [req.user.id, locker.id]
    );
  }

  res.json({
    ok: true,
    message: `Picked up ${lockers.length} packages from locker group ${groupId}`,
  });
});

// ---------------- COURIER: DELIVER ----------------
app.post("/api/lockers/deliver", auth, requireRole("courier"), async (req, res) => {
  const { toGroupId } = req.body;
  if (!toGroupId) {
    return res.status(400).json({ error: "Missing toGroupId" });
  }

  const toDeliver = await db.all(
    "SELECT * FROM lockers WHERE status='inTransit' AND destinationGroupId=?",
    [toGroupId]
  );

  if (toDeliver.length === 0) {
    return res
      .status(404)
      .json({ error: "No packages in transit for this locker group" });
  }

  const availableLockers = await db.all(
    "SELECT id FROM lockers WHERE groupId=? AND status='free'",
    [toGroupId]
  );

  if (availableLockers.length < toDeliver.length) {
    return res.status(400).json({
      error: "Not enough free lockers in destination location",
    });
  }

  for (let i = 0; i < toDeliver.length; i++) {
    const pkg = toDeliver[i];
    const targetLocker = availableLockers[i];

    await db.run(
      `UPDATE lockers
       SET status='occupied',
           groupId=?,
           lastAction='delivery',
           openedBy=?,
           updatedAt=datetime('now')
       WHERE id=?`,
      [toGroupId, req.user.id, pkg.id]
    );
  }

  res.json({
    ok: true,
    message: `Delivered ${toDeliver.length} packages to locker group ${toGroupId}`,
  });
});
// ---------------- USER: RECEIVE ----------------
app.post("/api/lockers/receive", auth, requireRole("user"), async (req, res) => {
  const locker = await db.get(
    "SELECT * FROM lockers WHERE assignedTo=? AND status='occupied' AND lastAction='delivery' LIMIT 1",
    [req.user.id]
  );
  if (!locker)
    return res.status(404).json({ error: "No package waiting for you" });

  await db.run(
    `UPDATE lockers
     SET status='free',
         packageId=NULL,
         assignedTo=NULL,
         openedBy=?,
         lastAction='receive',
         updatedAt=datetime('now')
     WHERE id=?`,
    [req.user.id, locker.id]
  );

  res.json({ ok: true, message: `Locker ${locker.id} opened for pickup` });
});

// ---------------- SERVICE: BROKEN ----------------
app.post("/api/lockers/broken", auth, requireRole("service"), async (req, res) => {
  const { id } = req.body;
  await db.run(`UPDATE lockers SET status='broken', updatedAt=datetime('now') WHERE id=?`, [id]);
  res.json({ ok: true, message: `Locker ${id} marked as broken` });
});

// ---------------- SERVICE: REPAIRED ----------------
app.post("/api/lockers/repaired", auth, requireRole("service"), async (req, res) => {
  const { id } = req.body;
  await db.run(`UPDATE lockers SET status='free', updatedAt=datetime('now') WHERE id=?`, [id]);
  res.json({ ok: true, message: `Locker ${id} repaired and set to free` });
});