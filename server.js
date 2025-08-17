const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const bcrypt = require("bcryptjs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// Room store
const rooms = {
  lobby: { name: "Random Group Chat", password: null, messages: [], users: new Set(), createdAt: Date.now() }
};

// Cleanup every minute
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of Object.entries(rooms)) {
    // Remove old messages
    room.messages = room.messages.filter(msg => now - msg.timestamp < 3 * 60 * 60 * 1000);

    // Auto-delete empty private rooms after 3h
    if (
      roomId !== "lobby" &&
      room.users.size === 0 &&
      room.messages.length === 0 &&
      now - room.createdAt > 3 * 60 * 60 * 1000
    ) {
      delete rooms[roomId];
    }
  }
}, 60 * 1000);

io.on("connection", (socket) => {
  console.log("User connected");

  // Create room
  socket.on("createRoom", async ({ roomName, password }, cb) => {
    if (!roomName) return cb({ error: "Room name required" });
    const roomId = roomName.toLowerCase().replace(/\s+/g, "-");
    if (rooms[roomId]) return cb({ error: "Room already exists" });

    const passwordHash = password ? await bcrypt.hash(password, 8) : null;
    rooms[roomId] = {
      name: roomName,
      password: passwordHash,
      messages: [],
      users: new Set(),
      createdAt: Date.now()
    };
    cb({ ok: true, roomId, roomName });
  });

  // List rooms
  socket.on("listRooms", (cb) => {
    const list = Object.entries(rooms).map(([id, r]) => ({
      id,
      name: r.name,
      users: r.users.size
    }));
    cb(list);
  });

  // Join room
  socket.on("joinRoom", async ({ roomId, password, user }, cb) => {
    const room = rooms[roomId];
    if (!room) return cb({ error: "Room not found" });

    if (room.password) {
      const match = await bcrypt.compare(password || "", room.password);
      if (!match) return cb({ error: "Wrong password" });
    }

    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = user;
    room.users.add(socket.id);

    // Send init + user count update
    cb({ ok: true, messages: room.messages, roomName: room.name });
    io.emit("roomUsers", { roomId, count: room.users.size });
  });

  // Chat message
  socket.on("chatMessage", ({ roomId, user, text }) => {
    const room = rooms[roomId];
    if (!room) return;
    const message = { user, text, timestamp: Date.now() };
    room.messages.push(message);
    io.to(roomId).emit("chatMessage", message);
  });

  // Disconnect
  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId].users.delete(socket.id);
      io.emit("roomUsers", { roomId, count: rooms[roomId].users.size });
    }
    console.log("User disconnected");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
