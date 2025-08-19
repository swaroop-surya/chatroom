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
const io = new Server(server, { cors: { origin: "*" } });

// ---- Middleware
app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- Static
const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use("/", express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOAD_DIR));

// ---- Uploads (images + .txt only)
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const TTL_MS = 3 * 60 * 60 * 1000; // 3h
const FILES = new Map();

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_, file, cb) => {
    const ok = file.mimetype.startsWith("image/") || file.mimetype === "text/plain";
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

// cleanup expired uploads
setInterval(() => {
  const now = Date.now();
  for (const [key, meta] of FILES) {
    if (meta.expiresAt < now) {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, key)); } catch {}
      FILES.delete(key);
    }
  }
}, 60_000);

// ---- Rooms + Messages
// message: { id, type:'chat'|'game', user, senderId, text?, file?, timestamp, ...game }
const rooms = new Map();
function ensureLobby() {
  if (![...rooms.values()].some(r => r.name === "Random Group Chat")) {
    const id = "lobby";
    rooms.set(id, { id, name: "Random Group Chat", password: "", users: new Set(), messages: [] });
  }
}
ensureLobby();

// helpers for TicTacToe
function tttWinner(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

io.on("connection", (socket) => {
  socket.data.username = "";
  socket.data.roomId = "";

  // list rooms
  socket.on("listRooms", (cb) => {
    const data = [...rooms.values()].map(r => ({ id: r.id, name: r.name, users: r.users.size }));
    cb(data);
  });

  // create room
  socket.on("createRoom", ({ roomName, password }, cb) => {
    const name = String(roomName || "").trim();
    if (!name) return cb({ ok: false, error: "Room name required" });
    const id = uuidv4();
    rooms.set(id, { id, name, password: String(password || ""), users: new Set(), messages: [] });
    cb({ ok: true, roomId: id, roomName: name });
  });

  // join room
  socket.on("joinRoom", ({ roomId, password, user }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb({ ok: false, error: "Room not found" });
    if ((room.password || "") !== String(password || "")) return cb({ ok: false, error: "Incorrect password" });

    // leave previous
    if (socket.data.roomId && rooms.has(socket.data.roomId)) {
      const old = rooms.get(socket.data.roomId);
      old.users.delete(socket.id);
      socket.leave(socket.data.roomId);
    }

    socket.data.username = String(user || "Anonymous").slice(0, 32);
    socket.data.roomId = roomId;
    room.users.add(socket.id);
    socket.join(roomId);

    cb({ ok: true, roomName: room.name, messages: room.messages });
  });

  // chat message
  socket.on("chatMessage", ({ roomId, user, text, file }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const msg = {
      id: uuidv4(),
      type: "chat",
      user: socket.data.username || user || "Anonymous",
      senderId: socket.id,
      text: String(text || ""),
      file: file || null,
      timestamp: Date.now()
    };
    room.messages.push(msg);
    if (room.messages.length > 500) room.messages.shift();
    io.to(roomId).emit("chatMessage", msg);
  });

  // delete message (sender only)
  socket.on("deleteMessage", ({ roomId, msgId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const msg = room.messages.find(m => m.id === msgId);
    if (!msg) return;
    if (msg.senderId !== socket.id) return; // auth: only sender
    room.messages = room.messages.filter(m => m.id !== msgId);
    io.to(roomId).emit("messageDeleted", { msgId });
  });

  // typing
  socket.on("typing", ({ roomId, typing }) => {
    const name = socket.data.username || "Someone";
    socket.to(roomId).emit("typing", { user: name, typing: !!typing });
  });

  // --- Games ---
  socket.on("startGame", ({ roomId, gameType }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (gameType === "rps") {
      const msg = {
        id: uuidv4(),
        type: "game",
        gameType: "rps",
        user: socket.data.username,
        senderId: socket.id,
        timestamp: Date.now(),
        state: { moves: {}, players: [], result: null } // moves[user] = 'rock'|'paper'|'scissors'
      };
      room.messages.push(msg);
      io.to(roomId).emit("chatMessage", msg);
      return;
    }

    if (gameType === "ttt") {
      const msg = {
        id: uuidv4(),
        type: "game",
        gameType: "ttt",
        user: socket.data.username,
        senderId: socket.id,
        timestamp: Date.now(),
        state: {
          board: Array(9).fill(null),          // 'X' or 'O'
          players: [],                          // [userX, userO]
          marks: {},                            // username -> 'X'|'O'
          turn: 'X',
          result: null,                         // 'X'|'O'|'draw'|null
          winner: null
        }
      };
      room.messages.push(msg);
      io.to(roomId).emit("chatMessage", msg);
      return;
    }
  });

  socket.on("playMove", ({ roomId, msgId, move }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const msg = room.messages.find(m => m.id === msgId && m.type === "game");
    if (!msg) return;

    // Rock–Paper–Scissors
    if (msg.gameType === "rps") {
      if (msg.state.result) return; // already resolved
      const user = socket.data.username;
      if (!msg.state.players.includes(user)) msg.state.players.push(user);
      if (msg.state.players.length > 2 && !msg.state.players.includes(user)) return;
      if (["rock","paper","scissors"].includes(move)) {
        msg.state.moves[user] = move;
      }
      if (Object.keys(msg.state.moves).length >= 2) {
        const [p1, p2] = Object.keys(msg.state.moves);
        const m1 = msg.state.moves[p1], m2 = msg.state.moves[p2];
        let winner = "draw";
        if ((m1==="rock"&&m2==="scissors")||(m1==="scissors"&&m2==="paper")||(m1==="paper"&&m2==="rock")) winner = p1;
        else if (m1!==m2) winner = p2;
        msg.state.result = { p1, m1, p2, m2, winner };
      }
      io.to(roomId).emit("gameUpdated", { msgId, state: msg.state });
      return;
    }

    // Tic–Tac–Toe
    if (msg.gameType === "ttt") {
      if (msg.state.result) return;
      const user = socket.data.username;

      // allocate mark
      if (!msg.state.marks[user]) {
        if (msg.state.players.length >= 2 && !msg.state.players.includes(user)) return;
        const mark = msg.state.players.length === 0 ? 'X' : 'O';
        msg.state.players.push(user);
        msg.state.marks[user] = mark;
      }

      const mark = msg.state.marks[user];
      if (mark !== msg.state.turn) return;
      const idx = Number(move);
      if (!(idx >= 0 && idx < 9)) return;
      if (msg.state.board[idx] !== null) return;

      msg.state.board[idx] = mark;
      const w = tttWinner(msg.state.board);
      if (w) {
        msg.state.result = w;
        msg.state.winner = w;
      } else if (msg.state.board.every(c => c !== null)) {
        msg.state.result = "draw";
      } else {
        msg.state.turn = mark === 'X' ? 'O' : 'X';
      }
      io.to(roomId).emit("gameUpdated", { msgId, state: msg.state });
      return;
    }
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.users.delete(socket.id);
      socket.leave(roomId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
