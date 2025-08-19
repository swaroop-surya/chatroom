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
const roomList = document.getElementById("roomList");
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

// Random chat
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
    if (res.error) return alert(res.error);
    joinRoom(res.roomId, newRoomPass.value);
  });
});

// Show join form
joinBtn.addEventListener("click", () => {
  createForm.style.display = "none";
  joinForm2.style.display = "block";
  const roomDropdown = document.getElementById("roomDropdown");
socket.emit("listRooms", rooms => {
  roomDropdown.innerHTML = '<option value="">-- Select a room --</option>';
  rooms.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = `${r.name} (${r.users} online)`;
    roomDropdown.appendChild(opt);
  });
});

});

// Join room
joinRoomBtn.addEventListener("click", () => {
  const selected = roomList.querySelector(".card.active");
  if (!selected) {
    alert("Select a room first");
    return;
  }
  joinRoom(selected.dataset.id, joinPass.value);
});

// Join room function
function joinRoom(roomId, password) {
  socket.emit("joinRoom", { roomId, password, user: username }, res => {
    if (res.error) return alert(res.error);
    currentRoom = roomId;
    roomTitle.textContent = res.roomName;
    messagesEl.innerHTML = "";
    res.messages.forEach(addMessage);
    show(chatScreen);
  });
}

// Send chat
form.addEventListener("submit", e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  socket.emit("chatMessage", { roomId: currentRoom, user: username, text });
  input.value = "";
});

// Render messages
socket.on("chatMessage", addMessage);
function addMessage(msg) {
  const li = document.createElement("li");
  const time = new Date(msg.timestamp).toLocaleTimeString();
  li.textContent = `[${time}] ${msg.user}: ${msg.text}`;
  messagesEl.appendChild(li);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Update users live
socket.on("roomUsers", ({ roomId, count }) => {
  document.querySelectorAll(`#roomList .card`).forEach(card => {
    if (card.dataset.id === roomId) {
      const base = card.textContent.split("(")[0].trim();
      card.textContent = `${base} (${count} online)`;
    }
  });
});

// Leave
leaveBtn.addEventListener("click", () => {
  show(menuScreen);
  currentRoom = "";
  messagesEl.innerHTML = "";
});
