const socket = io();

// Elements
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
const messages = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");

const fileInput = document.getElementById("fileInput");
const filePreview = document.getElementById("filePreview");

const form = document.getElementById("form");
const input = document.getElementById("input");
const leaveBtn = document.getElementById("leaveBtn");

// State
let username = "";
let roomId = "";
let selectedFile = null;

// Helpers
function show(screen) {
  [joinScreen, menuScreen, chatScreen].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}
function clearMessages() { messages.innerHTML = ""; }

function addMessageToList(msg) {
  const li = document.createElement("li");
  li.dataset.id = msg.id;
  if (msg.user === username && msg.type === "chat") li.classList.add("me");

  // header
  const header = document.createElement("div");
  const time = new Date(msg.timestamp).toLocaleTimeString();
  header.textContent = `[${time}] ${msg.user}: ${msg.text || ""}`;
  li.appendChild(header);

  // file link
  if (msg.file) {
    const line = document.createElement("div");
    const a = document.createElement("a");
    a.href = msg.file.url;
    a.target = "_blank";
    a.textContent = msg.file.originalName;
    line.appendChild(a);
    li.appendChild(line);
  }

  // delete button
  if (msg.type === "chat" && msg.user === username) {
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.style.marginLeft = "8px";
    del.onclick = () => socket.emit("deleteMessage", { roomId, msgId: msg.id });
    header.appendChild(del);
  }

  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

// Join & Menu
joinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  username = joinName.value.trim() || "Anonymous";
  show(menuScreen);
  socket.emit("listRooms", (rooms) => {
    roomDropdown.innerHTML = `<option value="">-- Select a room --</option>`;
    rooms.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.name} (${r.users} online)`;
      roomDropdown.appendChild(opt);
    });
  });
});

randomBtn.onclick = () => joinRoom("lobby", "");
createBtn.onclick = () => {
  createForm.style.display = "block";
  joinForm2.style.display = "none";
};
joinBtn.onclick = () => {
  joinForm2.style.display = "block";
  createForm.style.display = "none";
};

createRoomBtn.onclick = () => {
  const name = newRoomName.value.trim();
  const pass = newRoomPass.value.trim();
  if (!name) return;
  socket.emit("createRoom", { roomName: name, password: pass }, (res) => {
    if (res.ok) joinRoom(res.roomId, pass);
    else alert(res.error || "Failed to create room");
  });
};

joinRoomBtn.onclick = () => {
  const rid = roomDropdown.value;
  const pass = joinPass.value.trim();
  if (!rid) return alert("Choose a room");
  joinRoom(rid, pass);
};

function joinRoom(rid, pass) {
  socket.emit("joinRoom", { roomId: rid, password: pass, user: username }, (res) => {
    if (!res.ok) return alert(res.error || "Failed to join");
    roomId = rid;
    roomTitle.textContent = res.roomName;
    clearMessages();
    res.messages.forEach(addMessageToList);
    show(chatScreen);
  });
}

// File Preview
fileInput.addEventListener("change", () => {
  if (!fileInput.files.length) return;
  selectedFile = fileInput.files[0];
  filePreview.textContent = `Selected: ${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)  [click to clear]`;
  filePreview.style.display = "block";
});
filePreview.addEventListener("click", () => {
  selectedFile = null;
  fileInput.value = "";
  filePreview.style.display = "none";
});

// Send Message
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!roomId) return;

  let text = input.value.trim();
  let fileData = null;

  if (selectedFile) {
    const data = new FormData();
    data.append("file", selectedFile);
    const resp = await fetch("/upload", { method: "POST", body: data });
    const json = await resp.json();
    if (json.ok) fileData = json.file;
    selectedFile = null;
    fileInput.value = "";
    filePreview.style.display = "none";
  }

  if (text || fileData) {
    socket.emit("chatMessage", { roomId, user: username, text, file: fileData });
  }
  input.value = "";
});

input.addEventListener("input", () => {
  socket.emit("typing", { roomId, typing: input.value.length > 0 });
});

// Socket events
socket.on("chatMessage", (msg) => addMessageToList(msg));
socket.on("messageDeleted", ({ msgId }) => {
  const li = messages.querySelector(`li[data-id="${msgId}"]`);
  if (li) li.remove();
});
socket.on("typing", ({ user, typing }) => {
  typingIndicator.textContent = typing ? `${user} is typing...` : "";
});

// Leave
leaveBtn.onclick = () => {
  roomId = "";
  show(menuScreen);
  socket.emit("listRooms", (rooms) => {
    roomDropdown.innerHTML = `<option value="">-- Select a room --</option>`;
    rooms.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.name} (${r.users} online)`;
      roomDropdown.appendChild(opt);
    });
  });
};
