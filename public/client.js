const socket = io();

// Screens
const joinScreen = document.getElementById("joinScreen");
const menuScreen = document.getElementById("menuScreen");
const chatScreen = document.getElementById("chatScreen");

const joinForm = document.getElementById("joinForm");
const joinName = document.getElementById("joinName");

const randomBtn = document.getElementById("randomBtn");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");

const createForm = document.getElementById("createForm");
const newRoomName = document.getElementById("newRoomName");
const newRoomPass = document.getElementById("newRoomPass");
const createRoomBtn = document.getElementById("createRoomBtn");

const joinForm2 = document.getElementById("joinForm2");
const roomDropdown = document.getElementById("roomDropdown");
const joinPass = document.getElementById("joinPass");
const joinRoomBtn = document.getElementById("joinRoomBtn");

const roomTitle = document.getElementById("roomTitle");
const messagesEl = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const fileInput = document.getElementById("fileInput");
const leaveBtn = document.getElementById("leaveBtn");
const typingIndicator = document.getElementById("typingIndicator");

let username = "";
let currentRoom = "";
let typingTimeout = null;
const typingUsers = new Set();

function show(screen) {
  [joinScreen, menuScreen, chatScreen].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

// Join with name
joinForm.addEventListener("submit", e => {
  e.preventDefault();
  username = joinName.value.trim();
  if (!username) return;
  show(menuScreen);
});

// Quick random join
randomBtn.addEventListener("click", () => {
  joinRoom("lobby", "");
});

// Show create form
createBtn.addEventListener("click", () => {
  createForm.style.display = "block";
  joinForm2.style.display = "none";
});

// Create room
createRoomBtn.addEventListener("click", () => {
  socket.emit("createRoom", { roomName: newRoomName.value, password: newRoomPass.value }, res => {
    if (!res || res.ok !== true) {
      alert(res?.error || "Failed to create room");
      return;
    }
    joinRoom(res.roomId, newRoomPass.value, res.roomName || newRoomName.value);
  });
});

// Show join form + populate dropdown
joinBtn.addEventListener("click", () => {
  createForm.style.display = "none";
  joinForm2.style.display = "block";

  socket.emit("listRooms", rooms => {
    roomDropdown.innerHTML = '<option value="">-- Select a room --</option>';
    rooms.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.dataset.name = r.name;
      opt.textContent = `${r.name} (${r.users} online)`;
      roomDropdown.appendChild(opt);
    });
  });
});

// Join room using selected option
joinRoomBtn.addEventListener("click", () => {
  const selectedOpt = roomDropdown.options[roomDropdown.selectedIndex];
  if (!selectedOpt || !selectedOpt.value) {
    alert("Select a room first");
    return;
  }
  joinRoom(selectedOpt.value, joinPass.value, selectedOpt.dataset.name);
});

// Core join function
function joinRoom(roomId, password, fallbackName = "") {
  socket.emit("joinRoom", { roomId, password, user: username }, res => {
    console.log("joinRoom response:", res);

    if (!res || res.ok !== true) {
      alert(res?.error || "Failed to join room");
      return;
    }

    currentRoom = roomId;
    roomTitle.textContent = res.roomName || fallbackName || "Chatroom";

    // Reset messages and render any history
    messagesEl.innerHTML = "";
    if (Array.isArray(res.messages)) {
      res.messages.forEach(addMessage);
    }

    // Reset typing state on join
    typingUsers.clear();
    updateTypingIndicator();

    show(chatScreen);
  });
}

// Send message (with optional file)
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  const file = fileInput.files[0];

  let fileMeta = null;

  if (file) {
    const data = new FormData();
    data.append("file", file);
    try {
      const r = await fetch("/upload", { method: "POST", body: data });
      const json = await r.json();
      if (json.ok) {
        fileMeta = json.file; // {url, originalName, mime, size}
      } else {
        alert(json.error || "File upload failed");
      }
    } catch (err) {
      alert("Upload error");
    }
  }

  if (!text && !fileMeta) return;

  socket.emit("chatMessage", { roomId: currentRoom, user: username, text, file: fileMeta });
  input.value = "";
  fileInput.value = "";
  emitTyping(false);
});

// Incoming messages
socket.on("chatMessage", addMessage);

function addMessage(msg) {
  const li = document.createElement("li");
  const me = msg.user === username;
  if (me) li.classList.add("me");

  const ts = msg.timestamp ? new Date(msg.timestamp) : new Date();
  const time = ts.toLocaleTimeString();
  const who = msg.user || "Anonymous";
  const text = msg.text || "";

  // text
  const txt = document.createElement("div");
  txt.textContent = `[${time}] ${who}: ${text}`;
  li.appendChild(txt);

  // file (image or txt)
  if (msg.file && msg.file.url) {
    const box = document.createElement("div");
    box.className = "msg-file";

    if (msg.file.mime && msg.file.mime.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = msg.file.url;
      img.alt = msg.file.originalName || "image";
      box.appendChild(img);
    } else if (msg.file.mime === "text/plain") {
      const pre = document.createElement("pre");
      pre.style.maxHeight = "200px";
      pre.style.overflow = "auto";
      pre.style.whiteSpace = "pre-wrap";
      fetch(msg.file.url)
        .then(r => r.text())
        .then(t => pre.textContent = t)
        .catch(() => pre.textContent = "(failed to load text)");
      box.appendChild(pre);
    } else {
      const a = document.createElement("a");
      a.href = msg.file.url;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = msg.file.originalName || "download file";
      box.appendChild(a);
    }

    li.appendChild(box);
  }

  messagesEl.appendChild(li);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Live user count updates
socket.on("roomUsers", ({ roomId, count }) => {
  [...roomDropdown.options].forEach(opt => {
    if (opt.value === roomId) {
      const base = opt.textContent.split("(")[0].trim();
      opt.textContent = `${base} (${count} online)`;
    }
  });
});

// Typing indicator logic
function updateTypingIndicator() {
  const arr = [...typingUsers].filter(name => name !== username);
  if (arr.length === 0) {
    typingIndicator.textContent = "";
    return;
  }
  if (arr.length === 1) {
    typingIndicator.textContent = `✍️ ${arr[0]} is typing...`;
  } else if (arr.length === 2) {
    typingIndicator.textContent = `✍️ ${arr[0]} and ${arr[1]} are typing...`;
  } else {
    typingIndicator.textContent = `✍️ ${arr[0]}, ${arr[1]} and ${arr.length - 2} others are typing...`;
  }
}

function emitTyping(state) {
  if (!currentRoom) return;
  socket.emit("typing", { roomId: currentRoom, typing: !!state });
}

input.addEventListener("input", () => {
  emitTyping(true);
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => emitTyping(false), 1500);
});

socket.on("typing", ({ user, typing }) => {
  if (!user) return;
  if (typing) typingUsers.add(user);
  else typingUsers.delete(user);
  // Remove after grace period to avoid sticky indicators
  setTimeout(() => { typingUsers.delete(user); updateTypingIndicator(); }, 3000);
  updateTypingIndicator();
});

// Leave room (client-side view reset)
leaveBtn.addEventListener("click", () => {
  show(menuScreen);
  currentRoom = "";
  messagesEl.innerHTML = "";
  typingUsers.clear();
  updateTypingIndicator();
});
