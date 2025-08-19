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
  cors: { origin: "*" },
  transports: ["websocket", "polling"] // Render Free fallback
});

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

// ---- Rooms + Messages + Funrooms (Snake)
const rooms = new Map();
function ensureLobby() {
  if (![...rooms.values()].some(r => r.name === "Random Group Chat")) {
    const id = "lobby";
    rooms.set(id, { id, name: "Random Group Chat", type: "chat", password: "", users: new Set(), messages: [] });
  }
}
ensureLobby();

// ------- SNAKE GAME CORE -------
const GRID = { w: 24, h: 16, tickMs: 100 }; // 10 FPS
function randCell() {
  return { x: Math.floor(Math.random() * GRID.w), y: Math.floor(Math.random() * GRID.h) };
}
function nextPos({ x, y }, dir) {
  if (dir === "up") return { x, y: y - 1 };
  if (dir === "down") return { x, y: y + 1 };
  if (dir === "left") return { x: x - 1, y };
  return { x: x + 1, y };
}
function opposite(a, b) {
  return (a === "up" && b === "down") || (a === "down" && b === "up") || (a === "left" && b === "right") || (a === "right" && b === "left");
}
function createSnakeGameState() {
  const p1 = { color: "#4cb3ff", head: { x: 1, y: 1 }, dir: "right", pending: "right", body: [{ x: 1, y: 1 }], score: 0 };
  const p2 = { color: "#ff5a5a", head: { x: GRID.w - 2, y: GRID.h - 2 }, dir: "left", pending: "left", body: [{ x: GRID.w - 2, y: GRID.h - 2 }], score: 0 };
  return {
    mode: "snake",
    status: "waiting", // waiting|running|gameover
    players: [p1, p2],
    food: randCell(),
    winner: null,
    startAt: null,
    timerEndsAt: null,
    targetPellets: 10
  };
}
function spawnFoodAvoiding(state) {
  let cell;
  while (true) {
    cell = randCell();
    const occupied = state.players.some(p => p.body.some(s => s.x === cell.x && s.y === cell.y));
    if (!occupied) break;
  }
  state.food = cell;
}
function tickSnake(state) {
  if (state.status !== "running") return;

  // Apply pending turns
  state.players.forEach(p => { if (!opposite(p.dir, p.pending)) p.dir = p.pending; });

  // Next heads
  const nextHeads = state.players.map(p => nextPos(p.head, p.dir));

  // Collisions
  const wallCrash = nextHeads.map(h => h.x < 0 || h.y < 0 || h.x >= GRID.w || h.y >= GRID.h);
  const selfCrash = state.players.map((p, i) => p.body.some((s, idx) => idx !== 0 && s.x === nextHeads[i].x && s.y === nextHeads[i].y));
  const oppCrash = [0, 1].map(i => state.players[1 - i].body.some(s => s.x === nextHeads[i].x && s.y === nextHeads[i].y));
  const headToHead = nextHeads[0].x === nextHeads[1].x && nextHeads[0].y === nextHeads[1].y;

  let losers = [];
  [0, 1].forEach(i => { if (wallCrash[i] || selfCrash[i] || oppCrash[i]) losers.push(i); });
  if (headToHead) losers = [0, 1];

  if (losers.length) {
    state.status = "gameover";
    state.winner = losers.length === 2 ? null : (losers[0] === 0 ? 1 : 0);
    return;
  }

  // Advance
  state.players.forEach((p, i) => {
    const newHead = nextHeads[i];
    p.head = newHead;
    p.body.unshift({ ...newHead });
  });

  // Food & growth
  state.players.forEach(p => {
    if (p.head.x === state.food.x && p.head.y === state.food.y) {
      p.score += 1;
      spawnFoodAvoiding(state);
    } else {
      p.body.pop();
    }
  });

  // Score target
  const winnerByScore = state.players.findIndex(p => p.score >= state.targetPellets);
  if (winnerByScore !== -1) {
    state.status = "gameover";
    state.winner = winnerByScore;
    return;
  }

  // Timer check
  if (state.timerEndsAt && Date.now() >= state.timerEndsAt) {
    state.status = "gameover";
    const s0 = state.players[0].score; const s1 = state.players[1].score;
    state.winner = s0 === s1 ? null : (s0 > s1 ? 0 : 1);
  }
}
function startSnakeLoop(room) {
  if (room.gameLoop) return;
  room.gameLoop = setInterval(() => {
    tickSnake(room.game);
    io.to(room.id).emit("gameState", sanitizeGame(room));
    if (room.game.status === "gameover") {
      clearInterval(room.gameLoop);
      room.gameLoop = null;
    }
  }, GRID.tickMs);
}
function sanitizeGame(room) {
  return {
    id: room.id,
    name: room.name,
    type: room.type,
    status: room.game?.status,
    players: room.players.map((sid, idx) => ({
      id: sid,
      name: room.usernames.get(sid) || `P${idx + 1}`,
      color: room.game?.players[idx].color,
      body: room.game?.players[idx].body,
      score: room.game?.players[idx].score
    })),
    spectators: [...room.spectators].map(sid => room.usernames.get(sid) || "Spectator"),
    food: room.game?.food,
    timerEndsAt: room.game?.timerEndsAt,
    targetPellets: room.game?.targetPellets,
    winner: room.game?.winner
  };
}

// ------- SOCKET.IO -------
io.on("connection", (socket) => {
  socket.data.username = "";
  socket.data.roomId = "";
  socket.data.role = ""; // player|spectator|chat

  // list normal chat rooms
  socket.on("listRooms", (cb) => {
    const data = [...rooms.values()]
      .filter(r => r.type === "chat")
      .map(r => ({ id: r.id, name: r.name, users: r.users.size }));
    cb(data);
  });

  // list funrooms (all)
  socket.on("listFunrooms", (cb) => {
    const data = [...rooms.values()]
      .filter(r => r.type === "funroom")
      .map(r => ({
        id: r.id,
        name: r.name,
        players: r.players.length,
        spectators: r.spectators.size
      }));
    cb(data);
  });

  // list only joinable funrooms (exactly one player)
  socket.on("listJoinableFunrooms", (cb) => {
    const data = [...rooms.values()]
      .filter(r => r.type === "funroom" && r.players.length === 1)
      .map(r => ({ id: r.id, name: r.name }));
    cb(data);
  });

  // create normal chat room
  socket.on("createRoom", ({ roomName, password }, cb) => {
    const name = String(roomName || "").trim();
    if (!name) return cb({ ok: false, error: "Room name required" });
    const id = uuidv4();
    rooms.set(id, { id, name, type: "chat", password: String(password || ""), users: new Set(), messages: [] });
    cb({ ok: true, roomId: id, roomName: name });
  });

  // join normal chat room
  socket.on("joinRoom", ({ roomId, password, user }, cb) => {
    const room = rooms.get(roomId);
    if (!room || room.type !== "chat") return cb({ ok: false, error: "Room not found" });
    if ((room.password || "") !== String(password || "")) return cb({ ok: false, error: "Incorrect password" });

    leaveCurrent(socket);

    socket.data.username = String(user || "Anonymous").slice(0, 32);
    socket.data.roomId = roomId;
    socket.data.role = "chat";
    room.users.add(socket.id);
    socket.join(roomId);

    cb({ ok: true, roomName: room.name, messages: room.messages });
  });

  // create funroom
  socket.on("createFunroom", ({ roomName, password, funMode, timer60 }, cb) => {
    const name = String(roomName || "").trim();
    if (!name) return cb({ ok: false, error: "Room name required" });
    // funMode is reserved for future games; currently only "snake"
    const id = uuidv4();
    const room = {
      id,
      name,
      type: "funroom",
      password: String(password || ""),
      users: new Set(),
      usernames: new Map(),
      messages: [],
      players: [], // socket ids in order
      spectators: new Set(),
      game: createSnakeGameState(),
      gameLoop: null
    };
    if (timer60) room.game.timerEndsAt = Date.now() + 60_000;
    rooms.set(id, room);
    cb({ ok: true, roomId: id, roomName: name });
  });

  // join funroom
  socket.on("joinFunroom", ({ roomId, password, user }, cb) => {
    const room = rooms.get(roomId);
    if (!room || room.type !== "funroom") return cb({ ok: false, error: "Funroom not found" });
    if ((room.password || "") !== String(password || "")) return cb({ ok: false, error: "Incorrect password" });

    leaveCurrent(socket);

    socket.data.username = String(user || "Anonymous").slice(0, 32);
    socket.data.roomId = roomId;

    if (room.players.length < 2) {
      room.players.push(socket.id);
      socket.data.role = "player";
    } else {
      room.spectators.add(socket.id);
      socket.data.role = "spectator";
    }
    room.users.add(socket.id);
    room.usernames.set(socket.id, socket.data.username);
    socket.join(roomId);

    // Start when two players present
    if (room.players.length === 2 && room.game.status !== "running") {
      // reset to clean state, preserve timer if set
      const keepTimer = room.game.timerEndsAt && room.game.status !== "gameover";
      room.game = createSnakeGameState();
      if (keepTimer) room.game.timerEndsAt = Date.now() + Math.max(0, room.game.timerEndsAt - Date.now());
      room.game.status = "running";
      room.game.startAt = Date.now();
      startSnakeLoop(room);
    }

    cb({ ok: true, roomName: room.name, role: socket.data.role, state: sanitizeGame(room), messages: room.messages });
    io.to(room.id).emit("gameState", sanitizeGame(room));
  });

  // chat message (works for both room types)
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

  // delete message
  socket.on("deleteMessage", ({ roomId, msgId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const msg = room.messages.find(m => m.id === msgId);
    if (!msg) return;
    if (msg.senderId !== socket.id) return;
    room.messages = room.messages.filter(m => m.id !== msgId);
    io.to(roomId).emit("messageDeleted", { msgId });
  });

  // typing
  socket.on("typing", ({ roomId, typing }) => {
    const name = socket.data.username || "Someone";
    socket.to(roomId).emit("typing", { user: name, typing: !!typing });
  });

  // player input
  socket.on("playerInput", ({ roomId, dir }) => {
    const room = rooms.get(roomId);
    if (!room || room.type !== "funroom") return;
    const idx = room.players.indexOf(socket.id);
    if (idx === -1) return; // spectators cannot move
    const p = room.game.players[idx];
    const valid = ["up", "down", "left", "right"].includes(dir);
    if (!valid) return;
    if (!opposite(p.dir, dir)) p.pending = dir;
  });

  // play again
  socket.on("playAgain", ({ roomId, timer60 }) => {
    const room = rooms.get(roomId);
    if (!room || room.type !== "funroom") return;
    room.game = createSnakeGameState();
    if (timer60) room.game.timerEndsAt = Date.now() + 60_000;
    room.game.status = room.players.length === 2 ? "running" : "waiting";
    if (room.game.status === "running") startSnakeLoop(room);
    io.to(room.id).emit("gameState", sanitizeGame(room));
  });

  // disconnect
  socket.on("disconnect", () => {
    leaveCurrent(socket);
  });

  function leaveCurrent(sock) {
    const rid = sock.data.roomId;
    if (!rid || !rooms.has(rid)) return;
    const room = rooms.get(rid);

    if (room.type === "funroom") {
      const pi = room.players.indexOf(sock.id);
      if (pi !== -1) room.players.splice(pi, 1);
      room.spectators.delete(sock.id);
      room.usernames.delete(sock.id);

      // If a player leaves mid-game, other player wins
      if (room.game?.status === "running") {
        if (pi === 0) { room.game.status = "gameover"; room.game.winner = 1; }
        else if (pi === 1) { room.game.status = "gameover"; room.game.winner = 0; }
        if (room.game.status === "gameover" && room.gameLoop) {
          clearInterval(room.gameLoop);
          room.gameLoop = null;
        }
        io.to(room.id).emit("gameState", sanitizeGame(room));
      }
    }

    room.users.delete(sock.id);
    sock.leave(rid);
    sock.data.username = "";
    sock.data.roomId = "";
    sock.data.role = "";
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
