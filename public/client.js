const socket = io();

// Screens
const joinScreen = document.getElementById("joinScreen");
const menuScreen = document.getElementById("menuScreen");
const chatScreen = document.getElementById("chatScreen");
const funScreen  = document.getElementById("funScreen");

// Join
const joinForm = document.getElementById("joinForm");
const joinName = document.getElementById("joinName");

// Menu buttons
const randomBtn = document.getElementById("randomBtn");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const createFunBtn = document.getElementById("createFunBtn");
const joinFunBtn = document.getElementById("joinFunBtn");

// Chatroom create/join
const createForm = document.getElementById("createForm");
const newRoomName = document.getElementById("newRoomName");
const newRoomPass = document.getElementById("newRoomPass");
const createRoomBtn = document.getElementById("createRoomBtn");

const joinForm2 = document.getElementById("joinForm2");
const roomDropdown = document.getElementById("roomDropdown");
const joinPass = document.getElementById("joinPass");
const joinRoomBtn = document.getElementById("joinRoomBtn");

// Chat screen
const roomTitle = document.getElementById("roomTitle");
const messages = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");
const fileInput = document.getElementById("fileInput");
const filePreview = document.getElementById("filePreview");
const form = document.getElementById("form");
const input = document.getElementById("input");
const leaveBtn = document.getElementById("leaveBtn");

// Funroom create/join
const createFunForm = document.getElementById("createFunForm");
const newFunName = document.getElementById("newFunName");
const newFunPass = document.getElementById("newFunPass");
const funMode = document.getElementById("funMode");
const timer60 = document.getElementById("timer60");
const createFunroomBtn = document.getElementById("createFunroomBtn");

const joinFunForm = document.getElementById("joinFunForm");
const funDropdown = document.getElementById("funDropdown");
const joinFunPass = document.getElementById("joinFunPass");
const joinFunroomBtn = document.getElementById("joinFunroomBtn");

// Funroom (game + chat)
const funRoomTitle = document.getElementById("funRoomTitle");
const roleBadge = document.getElementById("roleBadge");
const scoreP1 = document.getElementById("scoreP1");
const scoreP2 = document.getElementById("scoreP2");
const timerLabel = document.getElementById("timerLabel");
const spectators = document.getElementById("spectators");
const playAgainBtn = document.getElementById("playAgainBtn");
const timer60Replay = document.getElementById("timer60Replay");
const leaveFunBtn = document.getElementById("leaveFunBtn");

const board = document.getElementById("board");
const ctx = board.getContext("2d");

// Fun chat
const messagesFun = document.getElementById("messagesFun");
const typingIndicatorFun = document.getElementById("typingIndicatorFun");
const fileInputFun = document.getElementById("fileInputFun");
const filePreviewFun = document.getElementById("filePreviewFun");
const formFun = document.getElementById("formFun");
const inputFun = document.getElementById("inputFun");

// State
let username = "";
let roomId = "";
let currentRole = "";   // player|spectator|chat
let lastState = null;
const userColors = {}; // store consistent colors for each user

// Helpers
function show(screen) {
  [joinScreen, menuScreen, chatScreen, funScreen].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}
function clearMessages(list) { list.innerHTML = ""; }

// --- Utility: hash username to consistent color
function getUserColor(name) {
  if (userColors[name]) return userColors[name];
  const colors = ["#f55","#5f5","#55f","#ff5","#f5f","#5ff"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const color = colors[Math.abs(hash) % colors.length];
  userColors[name] = color;
  return color;
}

// --- Emoji converter
function parseEmojis(text) {
  return text
    .replace(/:smile:/g, "😄")
    .replace(/:sad:/g, "😢")
    .replace(/:heart:/g, "❤️")
    .replace(/:thumbsup:/g, "👍")
    .replace(/:fire:/g, "🔥");
}

// --- Add Message
function addMessageToList(msg, list, currentInputUser) {
  const li = document.createElement("li");
  li.dataset.id = msg.id;
  if (msg.user === currentInputUser && msg.type === "chat") li.classList.add("me");

  const header = document.createElement("div");
  const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  
  // Avatar
  const avatar = document.createElement("span");
  avatar.textContent = msg.user[0].toUpperCase();
  avatar.style.background = getUserColor(msg.user);
  avatar.style.color = "#000";
  avatar.style.display = "inline-block";
  avatar.style.width = "22px";
  avatar.style.height = "22px";
  avatar.style.textAlign = "center";
  avatar.style.borderRadius = "50%";
  avatar.style.marginRight = "6px";

  header.appendChild(avatar);

  const textPart = document.createElement("span");
  textPart.innerHTML = `[${time}] <strong style="color:${getUserColor(msg.user)}">${msg.user}</strong>: ${parseEmojis(msg.text || "")}`;
  header.appendChild(textPart);
  li.appendChild(header);

  // File
  if (msg.file) {
    const line = document.createElement("div");
    if (msg.file.url && msg.file.originalName) {
      if (/\.(png|jpg|jpeg|gif|webp)$/i.test(msg.file.originalName)) {
        const img = document.createElement("img");
        img.src = msg.file.url;
        img.style.maxWidth = "120px";
        img.style.display = "block";
        line.appendChild(img);
      } else {
        const a = document.createElement("a");
        a.href = msg.file.url;
        a.target = "_blank";
        a.textContent = `📄 ${msg.file.originalName}`;
        line.appendChild(a);
      }
    }
    li.appendChild(line);
  }

  // Delete
  if (msg.type === "chat" && msg.user === currentInputUser) {
    const del = document.createElement("button");
    del.textContent = "X";
    del.style.marginLeft = "8px";
    del.onclick = () => socket.emit("deleteMessage", { roomId, msgId: msg.id });
    li.appendChild(del);
  }

  list.appendChild(li);
  list.scrollTop = list.scrollHeight;
}

// --- Resize canvas
function resizeCanvasToGrid() {
  const targetW = Math.min(720, Math.floor(window.innerWidth * 0.95));
  const cell = Math.floor(targetW / 24);
  board.width = cell * 24;
  board.height = cell * 16;
}

// --- File Preview handler
function setupFileHandler(inputEl, previewEl) {
  inputEl.addEventListener("change", () => {
    const file = inputEl.files[0];
    if (file) {
      previewEl.style.display = "block";
      previewEl.innerHTML = `📎 ${file.name} (${Math.round(file.size / 1024)} KB) <button class="remove-btn">❌</button>`;
      previewEl.classList.add("active");

      // image thumbnail
      if (file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.style.maxWidth = "60px";
        img.style.marginLeft = "10px";
        previewEl.prepend(img);
      }

      previewEl.querySelector(".remove-btn").onclick = () => {
        inputEl.value = "";
        previewEl.style.display = "none";
        previewEl.innerHTML = "";
        previewEl.classList.remove("active");
      };
    } else {
      previewEl.style.display = "none";
      previewEl.innerHTML = "";
      previewEl.classList.remove("active");
    }
  });
}
setupFileHandler(fileInput, filePreview);
setupFileHandler(fileInputFun, filePreviewFun);

// --- Join
joinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  username = joinName.value.trim() || "Anonymous";
  show(menuScreen);
  refreshChatRooms();
  refreshFunrooms();
});

// Menu actions
randomBtn.onclick = () => joinRoom("lobby", "");
createBtn.onclick = () => { createForm.style.display = "block"; joinForm2.style.display = "none"; createFunForm.style.display="none"; joinFunForm.style.display="none"; };
joinBtn.onclick = () => { joinForm2.style.display = "block"; createForm.style.display = "none"; createFunForm.style.display="none"; joinFunForm.style.display="none"; refreshChatRooms(); };
createFunBtn.onclick = () => { createFunForm.style.display = "block"; joinFunForm.style.display = "none"; createForm.style.display="none"; joinForm2.style.display="none"; };
joinFunBtn.onclick = () => { joinFunForm.style.display = "block"; createFunForm.style.display = "none"; createForm.style.display="none"; joinForm2.style.display="none"; refreshJoinableFunrooms(); };

// --- Chatroom create/join
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
    currentRole = "chat";
    clearMessages(messages);
    res.messages.forEach(m => addMessageToList(m, messages, username));
    show(chatScreen);
  });
}

// --- Funroom create/join
createFunroomBtn.onclick = () => {
  const name = newFunName.value.trim();
  const pass = newFunPass.value.trim();
  const mode = funMode.value;
  const t60 = !!timer60.checked;
  if (!name) return alert("Funroom name required");
  socket.emit("createFunroom", { roomName: name, password: pass, funMode: mode, timer60: t60 }, (res) => {
    if (res.ok) joinFunroomDirect(res.roomId, pass);
    else alert(res.error || "Failed to create funroom");
  });
};
joinFunroomBtn.onclick = () => {
  const rid = funDropdown.value;
  const pass = joinFunPass.value.trim();
  if (!rid) return alert("Choose a funroom");
  joinFunroomDirect(rid, pass);
};
function joinFunroomDirect(rid, pass) {
  socket.emit("joinFunroom", { roomId: rid, password: pass, user: username }, (res) => {
    if (!res.ok) return alert(res.error || "Failed to join funroom");
    roomId = rid;
    currentRole = res.role;
    funRoomTitle.textContent = res.roomName;
    clearMessages(messagesFun);
    res.messages.forEach(m => addMessageToList(m, messagesFun, username));
    show(funScreen);
    resizeCanvasToGrid();
    updateHud(res.state);
  });
}

// Refresh lists
function refreshChatRooms() {
  socket.emit("listRooms", (rooms) => {
    roomDropdown.innerHTML = `<option value="">-- Select a room --</option>`;
    rooms.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.name} (${r.users} online)`;
      roomDropdown.appendChild(opt);
    });
  });
}
function refreshFunrooms() { socket.emit("listFunrooms", () => {}); }
function refreshJoinableFunrooms() {
  socket.emit("listJoinableFunrooms", (list) => {
    funDropdown.innerHTML = `<option value="">-- Select a funroom --</option>`;
    list.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.name;
      funDropdown.appendChild(opt);
    });
  });
}

// --- Send message (chat)
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!roomId) return;
  let text = input.value.trim();
  let fileData = null;
  if (fileInput.files[0]) {
    const data = new FormData(); data.append("file", fileInput.files[0]);
    const resp = await fetch("/upload", { method:"POST", body:data });
    const json = await resp.json(); if (json.ok) fileData=json.file;
    fileInput.value=""; filePreview.style.display="none"; filePreview.innerHTML=""; filePreview.classList.remove("active");
  }
  if (text || fileData) socket.emit("chatMessage", { roomId, user: username, text, file: fileData });
  input.value = "";
});
input.addEventListener("input", () => socket.emit("typing", { roomId, typing: input.value.length > 0 }));

// --- Send message (fun)
formFun.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!roomId) return;
  let text = inputFun.value.trim();
  let fileData = null;
  if (fileInputFun.files[0]) {
    const data = new FormData(); data.append("file", fileInputFun.files[0]);
    const resp = await fetch("/upload", { method:"POST", body:data });
    const json = await resp.json(); if (json.ok) fileData=json.file;
    fileInputFun.value=""; filePreviewFun.style.display="none"; filePreviewFun.innerHTML=""; filePreviewFun.classList.remove("active");
  }
  if (text || fileData) socket.emit("chatMessage", { roomId, user: username, text, file: fileData });
  inputFun.value = "";
});
inputFun.addEventListener("input", () => socket.emit("typing", { roomId, typing: inputFun.value.length > 0 }));

// --- Socket chat events
socket.on("chatMessage", (msg) => {
  if (currentRole==="chat") addMessageToList(msg, messages, username);
  else if (roomId) addMessageToList(msg, messagesFun, username);
});
socket.on("messageDeleted", ({ msgId }) => {
  const li1 = messages.querySelector(`li[data-id="${msgId}"]`);
  const li2 = messagesFun.querySelector(`li[data-id="${msgId}"]`);
  if (li1) li1.remove(); if (li2) li2.remove();
});
socket.on("typing", ({ user, typing }) => {
  if (currentRole==="chat") typingIndicator.textContent = typing?`${user} is typing...`:"";
  else typingIndicatorFun.textContent = typing?`${user} is typing...`:"";
});

// --- Leave
leaveBtn.onclick = () => { roomId=""; show(menuScreen); refreshChatRooms(); };
leaveFunBtn.onclick = () => { roomId=""; currentRole=""; lastState=null; show(menuScreen); refreshJoinableFunrooms(); };

// --- Game input
window.addEventListener("keydown", (e) => {
  if (!roomId || currentRole!=="player") return;
  let dir=null;
  if (["ArrowUp","w","W"].includes(e.key)) dir="up";
  else if (["ArrowDown","s","S"].includes(e.key)) dir="down";
  else if (["ArrowLeft","a","A"].includes(e.key)) dir="left";
  else if (["ArrowRight","d","D"].includes(e.key)) dir="right";
  if (dir) { e.preventDefault(); socket.emit("playerInput",{roomId,dir}); }
});

// --- Game events
socket.on("gameState", (state) => {
  if (!roomId || state.id!==roomId) return;
  lastState = state;
  updateHud(state);
  draw(state);
});
playAgainBtn.onclick = () => { if(roomId) socket.emit("playAgain", {roomId, timer60: !!timer60Replay.checked}); };

// --- HUD + draw
function updateHud(state){
  const p1=state.players?.[0], p2=state.players?.[1];
  roleBadge.textContent = currentRole?`Role: ${currentRole}`:"";
  scoreP1.textContent = p1?`P1(${p1.name}) Score: ${p1.score}`:"P1 waiting…";
  scoreP2.textContent = p2?`P2(${p2.name}) Score: ${p2.score}`:"P2 waiting…";
  spectators.textContent = state.spectators?.length?`Spectators: ${state.spectators.length}`:"Spectators: 0";
  if (state.timerEndsAt){ const ms=Math.max(0,state.timerEndsAt-Date.now()); timerLabel.textContent=`Timer: ${Math.ceil(ms/1000)}s`; }
  else timerLabel.textContent="";
  if (state.finished){
    playAgainBtn.style.display="inline-block";
    // 🏆 announce in chat
    if(state.winner) socket.emit("chatMessage",{roomId,user:"System",text:`🏆 ${state.winner.name} wins the match!`});
  } else playAgainBtn.style.display="none";
}

function draw(state){
  if(!state||!state.players) return;
  const cell=board.width/24;
  ctx.fillStyle="black"; ctx.fillRect(0,0,board.width,board.height);
  ctx.fillStyle="lime"; ctx.fillRect(state.food.x*cell,state.food.y*cell,cell,cell);
  state.players.forEach((p,i)=>{
    ctx.fillStyle=getUserColor(p.name);
    p.snake.forEach(seg=>ctx.fillRect(seg.x*cell,seg.y*cell,cell,cell));
  });
  // Overlay Controls
  ctx.fillStyle="white"; ctx.font="12px monospace"; ctx.fillText("Controls: W/A/S/D or Arrows", 5, board.height-5);
}
window.addEventListener("resize",resizeCanvasToGrid);
