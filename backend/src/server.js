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

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user'
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS lockers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT DEFAULT 'free',         -- free | occupied | broken
      packageId TEXT,
      assignedTo INTEGER,
      openedBy INTEGER,
      lastAction TEXT,
      updatedAt TEXT
    );
  `);

  // ✅ Seed lockers if none exist
  const count = await db.get("SELECT COUNT(*) AS c FROM lockers");
  if (!count || count.c === 0) {
    for (let i = 0; i < 5; i++) {
      await db.run("INSERT INTO lockers (status) VALUES ('free')");
    }
    console.log("Seeded 5 lockers ✅");
  } else {
    console.log(`Lockers already exist (${count.c})`);
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
app.get("/api/users", auth, requireRole("admin"), async (req, res) => {
  const users = await db.all("SELECT id, email, role FROM users");
  res.json({ ok: true, users });
});

app.get("/api/lockers", auth, async (req, res) => {
  const allowed = ["admin", "service"];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied" });
  }
  const lockers = await db.all("SELECT * FROM lockers");
  res.json({ ok: true, lockers });
});

// ---------------- USER: SEND ----------------
app.post("/api/lockers/send", auth, requireRole("user"), async (req, res) => {
  const locker = await db.get("SELECT * FROM lockers WHERE status='free' LIMIT 1");
  if (!locker)
    return res.status(400).json({ error: "No free lockers available" });

  const pkgId = "PKG-" + Math.random().toString(36).substring(2, 10).toUpperCase();
  await db.run(
    `UPDATE lockers
     SET status='occupied',
         packageId=?,
         assignedTo=?,
         openedBy=?,
         lastAction='send',
         updatedAt=datetime('now')
     WHERE id=?`,
    [pkgId, req.user.id, req.user.id, locker.id]
  );

  res.json({ ok: true, message: `Locker ${locker.id} opened for sending`, packageId: pkgId });
});

// ---------------- COURIER: PICKUP ----------------
app.post("/api/lockers/pickup", auth, requireRole("courier"), async (req, res) => {
  const locker = await db.get(
    "SELECT * FROM lockers WHERE status='occupied' AND lastAction='send' LIMIT 1"
  );
  if (!locker)
    return res.status(404).json({ error: "No outgoing package ready for pickup" });

  await db.run(
    `UPDATE lockers
     SET status='free',
         packageId=NULL,
         assignedTo=NULL,
         openedBy=?,
         lastAction='pickupByCourier',
         updatedAt=datetime('now')
     WHERE id=?`,
    [req.user.id, locker.id]
  );

  res.json({ ok: true, message: `Locker ${locker.id} opened — package picked up by courier` });
});

// ---------------- COURIER: DELIVER ----------------
app.post("/api/lockers/deliver", auth, requireRole("courier"), async (req, res) => {
  const { recipientEmail } = req.body;
  const recipient = await db.get("SELECT id FROM users WHERE email = ?", [recipientEmail]);
  if (!recipient) return res.status(404).json({ error: "Recipient not found" });

  const locker = await db.get("SELECT * FROM lockers WHERE status='free' LIMIT 1");
  if (!locker)
    return res.status(400).json({ error: "No free lockers available" });

  const pkgId = "PKG-" + Math.random().toString(36).substring(2, 10).toUpperCase();
  await db.run(
    `UPDATE lockers
     SET status='occupied',
         packageId=?,
         assignedTo=?,
         lastAction='delivery',
         updatedAt=datetime('now')
     WHERE id=?`,
    [pkgId, recipient.id, locker.id]
  );

  res.json({ ok: true, message: `Delivered to locker ${locker.id}`, packageId: pkgId });
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