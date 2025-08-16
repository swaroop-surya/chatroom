const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let messages = []; // store messages with timestamp

// auto-remove old messages every minute
setInterval(() => {
  const now = Date.now();
  messages = messages.filter(msg => now - msg.timestamp < 3 * 60 * 60 * 1000);
}, 60 * 1000);

io.on("connection", (socket) => {
  console.log("A user connected");

  // send current messages to new user
  socket.emit("init", messages);

  // when user sends message
  socket.on("chat message", (msg) => {
    const message = {
      id: Date.now() + "-" + Math.random(),
      user: msg.user,
      text: msg.text,
      timestamp: Date.now()
    };
    messages.push(message);
    io.emit("chat message", message);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

// Render provides PORT in env
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
