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
  lobby: { name: "Random Group Chat", password: null, messages: [] }
};

// Cleanup expired messages every minute
setInterval(() => {
  const now = Date.now();
  for (const roomId in rooms) {
    rooms[roomId].messages = rooms[roomId].messages.filter(
      (msg) => now - msg.timestamp < 3 * 60 * 60 * 1000
    );
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
    rooms[roomId] = { name: roomName, password: passwordHash, messages: [] };
    cb({ ok: true, roomId, roomName });
  });

  // List rooms
  socket.on("listRooms", (cb) => {
    const list = Object.entries(rooms).map(([id, r]) => ({
      id,
      name: r.name
    }));
    cb(list);
  });

  // Join room
  socket.on("joinRoom", async ({ roomId, password }, cb) => {
    const room = rooms[roomId];
    if (!room) return cb({ error: "Room not found" });

    if (room.password) {
      const match = await bcrypt.compare(password || "", room.password);
      if (!match) return cb({ error: "Wrong password" });
    }

    socket.join(roomId);
    cb({ ok: true, messages: room.messages, roomName: room.name });
  });

  // Chat message
  socket.on("chatMessage", ({ roomId, user, text }) => {
    const room = rooms[roomId];
    if (!room) return;
    const message = {
      user,
      text,
      timestamp: Date.now()
    };
    room.messages.push(message);
    io.to(roomId).emit("chatMessage", message);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
