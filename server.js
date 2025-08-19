import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// --- Middleware
app.use(cors());
// If helmet causes CSP issues on free hosting, comment the next line out
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Static
const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use("/", express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOAD_DIR));

// --- File upload (images + .txt only)
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
const TTL_MS = 3 * 60 * 60 * 1000; // 3 hours expiry for uploads
const FILES = new Map(); // storedName -> meta

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype.startsWith("image/") ||
      file.mimetype === "text/plain";
    cb(ok ? null : new Error("Only images and .txt files are allowed"), ok);
  }
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: "No file" });
  const now = Date.now();
  const meta = {
    id: uuidv4(),
    storedName: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mime: req.file.mimetype,
    createdAt: now,
    expiresAt: now + TTL_MS,
    url: `/uploads/${req.file.filename}`
  };
  FILES.set(meta.storedName, meta);
  res.json({ ok: true, file: meta });
});

// Cleanup expired files every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, meta] of FILES) {
    if (meta.expiresAt < now) {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, key)); } catch {}
      FILES.delete(key);
    }
  }
}, 60_000);

// --- In-memory rooms & messages
const rooms = new Map();
function ensureLobby() {
  if (![...rooms.values()].some(r => r.name === "Random Group Chat")) {
    const id = "lobby";
    rooms.set(id, { id, name: "Random Group Chat", password: "", users: new Set(), messages: [] });
  }
}
ensureLobby();

io.on("connection", (socket) => {
  socket.data.username = "";
  socket.data.roomId = "";

  // List rooms
  socket.on("listRooms", (cb) => {
    const data = [...rooms.values()].map(r => ({
      id: r.id,
      name: r.name,
      users: r.users.size
    }));
    cb(data);
  });

  // Create room
  socket.on("createRoom", ({ roomName, password }, cb) => {
    const name = String(roomName || "").trim();
    if (!name) return cb({ ok: false, error: "Room name required" });
    const id = uuidv4();
    rooms.set(id, { id, name, password: String(password || ""), users: new Set(), messages: [] });
    cb({ ok: true, roomId: id, roomName: name });
  });

  // Join room
  socket.on("joinRoom", ({ roomId, password, user }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb({ ok: false, error: "Room not found" });
    if ((room.password || "") !== String(password || "")) {
      return cb({ ok: false, error: "Incorrect password" });
    }

    // Leave current room if any
    if (socket.data.roomId && rooms.has(socket.data.roomId)) {
      const oldRoom = rooms.get(socket.data.roomId);
      oldRoom.users.delete(socket.id);
      socket.leave(socket.data.roomId);
      io.to(socket.data.roomId).emit("roomUsers", { roomId: socket.data.roomId, count: oldRoom.users.size });
    }

    socket.data.username = String(user || "Anonymous").slice(0, 32);
    socket.data.roomId = roomId;
    room.users.add(socket.id);
    socket.join(roomId);

    // reply with history
    cb({ ok: true, roomName: room.name, messages: room.messages });

    // announce presence
    io.to(roomId).emit("roomUsers", { roomId, count: room.users.size });
    socket.to(roomId).emit("chatMessage", {
      user: "system",
      text: `${socket.data.username} joined`,
      timestamp: Date.now()
    });
  });

  // Incoming chat
  socket.on("chatMessage", ({ roomId, user, text, file }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const msg = {
      user: socket.data.username || user || "Anonymous",
      text: String(text || ""),
      file: file || null,
      timestamp: Date.now()
    };
    room.messages.push(msg);
    if (room.messages.length > 500) room.messages.shift();
    io.to(roomId).emit("chatMessage", msg);
  });

  // Typing indicator
  socket.on("typing", ({ roomId, typing }) => {
    const name = socket.data.username || "Someone";
    socket.to(roomId).emit("typing", { user: name, typing: !!typing });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.users.delete(socket.id);
      io.to(roomId).emit("roomUsers", { roomId, count: room.users.size });
      socket.to(roomId).emit("chatMessage", {
        user: "system",
        text: `${socket.data.username || "Someone"} left`,
        timestamp: Date.now()
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
