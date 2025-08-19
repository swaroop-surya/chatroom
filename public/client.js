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
const leaveBtn = document.getElementById("leaveBtn");

let username = "";
let currentRoom = "";

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

// Quick random join (adjust roomId as needed by your server)
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
    // server returns { ok: true, roomId, roomName? }
    joinRoom(res.roomId, newRoomPass.value, res.roomName || newRoomName.value);
  });
});

// Show join form and populate dropdown
joinBtn.addEventListener("click", () => {
  createForm.style.display = "none";
  joinForm2.style.display = "block";

  socket.emit("listRooms", rooms => {
    roomDropdown.innerHTML = '<option value="">-- Select a room --</option>';
    rooms.forEach(r => {
      const opt = document.createElement("option");
      // server list should provide r.id, r.name, r.users
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

    // Your server returns { ok: true, messages: [], roomName: "..." }
    if (!res || res.ok !== true) {
      alert(res?.error || "Failed to join room");
      return;
    }

    currentRoom = roomId;

    // Prefer server roomName; fallback to provided name
    roomTitle.textContent = res.roomName || fallbackName || "Chatroom";

    // Reset messages and render any history
    messagesEl.innerHTML = "";
    if (Array.isArray(res.messages)) {
      res.messages.forEach(addMessage);
    }

    show(chatScreen);
  });
}

// Send message
form.addEventListener("submit", e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !currentRoom) return;
  socket.emit("chatMessage", { roomId: currentRoom, user: username, text });
  input.value = "";
});

// Incoming messages
socket.on("chatMessage", addMessage);
function addMessage(msg) {
  const li = document.createElement("li");
  const ts = msg.timestamp ? new Date(msg.timestamp) : new Date();
  const time = ts.toLocaleTimeString();
  li.textContent = `[${time}] ${msg.user}: ${msg.text}`;
  messagesEl.appendChild(li);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Live user count updates (if your server emits this)
socket.on("roomUsers", ({ roomId, count }) => {
  [...roomDropdown.options].forEach(opt => {
    if (opt.value === roomId) {
      const base = opt.textContent.split("(")[0].trim();
      opt.textContent = `${base} (${count} online)`;
    }
  });
});

// Leave room (client-side view reset)
leaveBtn.addEventListener("click", () => {
  show(menuScreen);
  currentRoom = "";
  messagesEl.innerHTML = "";
});
