const socket = io();

// Screens
const joinScreen = document.getElementById("joinScreen");
const menuScreen = document.getElementById("menuScreen");
const chatroomsScreen = document.getElementById("chatroomsScreen");
const funroomsScreen = document.getElementById("funroomsScreen");
const chatScreen = document.getElementById("chatScreen");
const funScreen = document.getElementById("funScreen");

// Join
const joinForm = document.getElementById("joinForm");
const joinName = document.getElementById("joinName");

// Menu navigation buttons
const chatroomsBtn = document.getElementById("chatroomsBtn");
const funroomsBtn = document.getElementById("funroomsBtn");
const backFromChatBtn = document.getElementById("backFromChatBtn");
const backFromFunBtn = document.getElementById("backFromFunBtn");

// New chatrooms interface elements
const availableRoomsList = document.getElementById("availableRoomsList");
const randomRoomItem = document.getElementById("randomRoomItem");
const createRoomView = document.getElementById("createRoomView");
const joinRoomView = document.getElementById("joinRoomView");
const selectedRoomName = document.getElementById("selectedRoomName");
const cancelJoinBtn = document.getElementById("cancelJoinBtn");

// Funroom buttons
const createFunBtn = document.getElementById("createFunBtn");
const joinFunBtn = document.getElementById("joinFunBtn");

// Create/join chatroom
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
let currentRole = ""; // player|spectator|chat
let lastState = null;

// Store avatars/colors per user
const userStyles = {};
function getUserStyle(user) {
  if (!userStyles[user]) {
    const colors = ["#ff7675", "#74b9ff", "#55efc4", "#ffeaa7", "#fd79a8", "#a29bfe"];
    const avatars = ["🐱", "🐶", "🐵", "🦊", "🐼", "🐸", "🐯", "🐰", "🐨", "🦁"];
    userStyles[user] = {
      color: colors[Math.floor(Math.random() * colors.length)],
      avatar: avatars[Math.floor(Math.random() * avatars.length)]
    };
  }
  return userStyles[user];
}

// Helpers
function show(screen) {
  [joinScreen, menuScreen, chatroomsScreen, funroomsScreen, chatScreen, funScreen].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}
function clearMessages(list) {
  list.innerHTML = "";
}
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function addMessageToList(msg, list, currentInputUser) {
  const li = document.createElement("li");
  li.dataset.id = msg.id;

  const style = getUserStyle(msg.user);
  const bubble = document.createElement("div");
  bubble.classList.add("bubble");
  bubble.style.background = msg.user === currentInputUser ? "#333" : style.color;
  bubble.style.color = "#fff";
  bubble.style.maxWidth = "70%";
  bubble.style.padding = "8px 12px";
  bubble.style.borderRadius = "12px";
  bubble.style.margin = "4px";
  bubble.style.alignSelf = msg.user === currentInputUser ? "flex-end" : "flex-start";

  const header = document.createElement("div");
  header.style.fontSize = "0.8rem";
  header.style.opacity = "0.8";
  header.textContent = `${style.avatar} ${msg.user} • ${formatTime(msg.timestamp)}`;
  bubble.appendChild(header);

  if (msg.text) {
    const textEl = document.createElement("div");
    textEl.style.marginTop = "4px";
    textEl.textContent = msg.text;
    bubble.appendChild(textEl);
  }

  if (msg.file) {
    const fileWrap = document.createElement("div");
    fileWrap.style.marginTop = "6px";

    if (msg.file.url.match(/\.(jpg|jpeg|png|gif)$/i)) {
      const img = document.createElement("img");
      img.src = msg.file.url;
      img.alt = msg.file.originalName;
      img.style.maxWidth = "150px";
      img.style.borderRadius = "6px";
      fileWrap.appendChild(img);
    } else {
      const a = document.createElement("a");
      a.href = msg.file.url;
      a.target = "_blank";
      a.textContent = "📎 " + msg.file.originalName;
      fileWrap.appendChild(a);
    }
    bubble.appendChild(fileWrap);
  }

  li.appendChild(bubble);
  list.appendChild(li);
  list.scrollTop = list.scrollHeight;
}
function resizeCanvasToGrid() {
  const targetW = Math.min(720, Math.floor(window.innerWidth * 0.95));
  const cell = Math.floor(targetW / 24);
  board.width = cell * 24;
  board.height = cell * 16;
}

// Join - with localStorage persistence
joinForm.addEventListener("submit", e => {
  e.preventDefault();
  username = joinName.value.trim() || "Anonymous";
  localStorage.setItem('chatroom_username', username);
  show(menuScreen);
});

// Check for saved username on page load
window.addEventListener('load', () => {
  const savedUsername = localStorage.getItem('chatroom_username');
  if (savedUsername) {
    username = savedUsername;
    joinName.value = savedUsername;
    show(menuScreen);
  }
});

// Main menu navigation
chatroomsBtn.onclick = () => {
  show(chatroomsScreen);
  refreshAvailableRooms();
  showCreateRoomView();
  startAutoRefresh();
};
funroomsBtn.onclick = () => {
  show(funroomsScreen);
  refreshJoinableFunrooms();
};

// Back navigation
backFromChatBtn.onclick = () => {
  stopAutoRefresh();
  show(menuScreen);
};
backFromFunBtn.onclick = () => show(menuScreen);

// New chatroom interface variables
let selectedRoomId = "";
let selectedRoomPassword = "";
let autoRefreshInterval = null;

// Handle room selection from left panel
function selectRoom(roomId, roomName, password) {
  selectedRoomId = roomId;
  selectedRoomPassword = password;
  
  // Update UI
  document.querySelectorAll('.room-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  if (roomId === "lobby") {
    // Random room - join directly
    joinRoom("lobby", "");
  } else {
    // Regular room - show join form
    const roomItem = document.querySelector(`[data-room-id="${roomId}"]`);
    if (roomItem) roomItem.classList.add('selected');
    
    selectedRoomName.textContent = `Join: ${roomName}`;
    showJoinRoomView();
  }
}

function showCreateRoomView() {
  createRoomView.style.display = "block";
  joinRoomView.style.display = "none";
}

function showJoinRoomView() {
  createRoomView.style.display = "none";
  joinRoomView.style.display = "block";
  joinPass.focus();
}

// Funroom actions
createFunBtn.onclick = () => {
  createFunForm.style.display = "block";
  joinFunForm.style.display = "none";
};
joinFunBtn.onclick = () => {
  joinFunForm.style.display = "block";
  createFunForm.style.display = "none";
  refreshJoinableFunrooms();
};

// New chatroom interface event listeners
createRoomBtn.onclick = () => {
  const name = newRoomName.value.trim();
  const pass = newRoomPass.value.trim();
  if (!name) return alert("Room name is required");
  socket.emit("createRoom", { roomName: name, password: pass }, res => {
    if (res.ok) {
      newRoomName.value = "";
      newRoomPass.value = "";
      joinRoom(res.roomId, pass);
    } else {
      alert(res.error || "Failed to create room");
    }
  });
};

joinRoomBtn.onclick = () => {
  if (!selectedRoomId) return alert("No room selected");
  const pass = joinPass.value.trim();
  joinRoom(selectedRoomId, pass);
};

cancelJoinBtn.onclick = () => {
  showCreateRoomView();
  document.querySelectorAll('.room-item').forEach(item => {
    item.classList.remove('selected');
  });
  joinPass.value = "";
};

// Set up random room click handler
randomRoomItem.onclick = () => selectRoom("lobby", "Random Group Chat", "");
function joinRoom(rid, pass) {
  socket.emit("joinRoom", { roomId: rid, password: pass, user: username }, res => {
    if (!res.ok) return alert(res.error || "Failed to join");
    roomId = rid;
    currentRole = "chat";
    roomTitle.textContent = res.roomName;
    clearMessages(messages);
    res.messages.forEach(m => addMessageToList(m, messages, username));
    show(chatScreen);
  });
}

// Funroom create/join
createFunroomBtn.onclick = () => {
  const name = newFunName.value.trim();
  const pass = newFunPass.value.trim();
  const mode = funMode.value;
  const t60 = !!timer60.checked;
  if (!name) return alert("Funroom name required");
  socket.emit("createFunroom", { roomName: name, password: pass, funMode: mode, timer60: t60 }, res => {
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
  socket.emit("joinFunroom", { roomId: rid, password: pass, user: username }, res => {
    if (!res.ok) return alert(res.error || "Failed to join funroom");
    roomId = rid;
    currentRole = res.role;
    funRoomTitle.textContent = res.roomName;
    clearMessages(messagesFun);
    res.messages.forEach(m => addMessageToList(m, messagesFun, username));
    show(funScreen);
    resizeCanvasToGrid();
    updateHud(res.state);
    alert("Controls: Use W/A/S/D or Arrow keys to play!");
  });
}

// Auto-refresh functionality
function startAutoRefresh() {
  if (autoRefreshInterval) return;
  autoRefreshInterval = setInterval(refreshAvailableRooms, 3000); // Refresh every 3 seconds
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

// Updated room refresh for new interface
function refreshAvailableRooms() {
  socket.emit("listRooms", rooms => {
    // Clear existing rooms (except random room)
    const existingRooms = availableRoomsList.querySelectorAll('.room-item:not(#randomRoomItem)');
    existingRooms.forEach(room => room.remove());
    
    // Add new rooms
    rooms.forEach(r => {
      if (r.id !== "lobby") { // Skip lobby since it's already shown as random room
        const roomDiv = document.createElement("div");
        roomDiv.className = "room-item";
        roomDiv.dataset.roomId = r.id;
        roomDiv.dataset.password = r.password || "";
        roomDiv.innerHTML = `
          <strong>${r.name}</strong>
          <div style="font-size:0.9rem; opacity:0.8;">${r.users} users online • ${r.password ? 'Password protected' : 'Public'}</div>
        `;
        roomDiv.onclick = () => selectRoom(r.id, r.name, r.password || "");
        availableRoomsList.appendChild(roomDiv);
      }
    });
  });
}

// Legacy function for compatibility
function refreshChatRooms() {
  refreshAvailableRooms();
}
function refreshFunrooms() {
  socket.emit("listFunrooms", () => {});
}
function refreshJoinableFunrooms() {
  socket.emit("listJoinableFunrooms", list => {
    funDropdown.innerHTML = `<option value="">-- Select a funroom --</option>`;
    list.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.name;
      funDropdown.appendChild(opt);
    });
  });
}

// Send message (chat)
form.addEventListener("submit", async e => {
  e.preventDefault();
  if (!roomId) return;
  let text = input.value.trim();
  let fileData = null;
  if (fileInput.files[0]) {
    const data = new FormData();
    data.append("file", fileInput.files[0]);
    const resp = await fetch("/upload", { method: "POST", body: data });
    const json = await resp.json();
    if (json.ok) fileData = json.file;
    fileInput.value = "";
    filePreview.style.display = "none";
  }
  if (text || fileData) socket.emit("chatMessage", { roomId, user: username, text, file: fileData });
  input.value = "";
});
input.addEventListener("input", () => socket.emit("typing", { roomId, typing: input.value.length > 0 }));

// Send message (fun)
formFun.addEventListener("submit", async e => {
  e.preventDefault();
  if (!roomId) return;
  let text = inputFun.value.trim();
  let fileData = null;
  if (fileInputFun.files[0]) {
    const data = new FormData();
    data.append("file", fileInputFun.files[0]);
    const resp = await fetch("/upload", { method: "POST", body: data });
    const json = await resp.json();
    if (json.ok) fileData = json.file;
    fileInputFun.value = "";
    filePreviewFun.style.display = "none";
  }
  if (text || fileData) socket.emit("chatMessage", { roomId, user: username, text, file: fileData });
  inputFun.value = "";
});
inputFun.addEventListener("input", () => socket.emit("typing", { roomId, typing: inputFun.value.length > 0 }));

// Socket chat events
socket.on("chatMessage", msg => {
  if (currentRole === "chat") addMessageToList(msg, messages, username);
  else if (roomId) addMessageToList(msg, messagesFun, username);
});
socket.on("messageDeleted", ({ msgId }) => {
  const li1 = messages.querySelector(`li[data-id="${msgId}"]`);
  const li2 = messagesFun.querySelector(`li[data-id="${msgId}"]`);
  if (li1) li1.remove();
  if (li2) li2.remove();
});
socket.on("typing", ({ user, typing }) => {
  if (currentRole === "chat") typingIndicator.textContent = typing ? `${user} is typing...` : "";
  else typingIndicatorFun.textContent = typing ? `${user} is typing...` : "";
});

// Leave
leaveBtn.onclick = () => {
  roomId = "";
  show(chatroomsScreen);
  refreshAvailableRooms();
  showCreateRoomView();
  startAutoRefresh();
};
leaveFunBtn.onclick = () => {
  roomId = "";
  currentRole = "";
  lastState = null;
  show(funroomsScreen);
  refreshJoinableFunrooms();
};

// Game input
window.addEventListener("keydown", e => {
  if (!roomId || currentRole !== "player") return;
  let dir = null;
  if (["ArrowUp", "w", "W"].includes(e.key)) dir = "up";
  else if (["ArrowDown", "s", "S"].includes(e.key)) dir = "down";
  else if (["ArrowLeft", "a", "A"].includes(e.key)) dir = "left";
  else if (["ArrowRight", "d", "D"].includes(e.key)) dir = "right";
  if (dir) {
    e.preventDefault();
    socket.emit("playerInput", { roomId, dir });
  }
});

// Game events
socket.on("gameState", state => {
  if (!roomId || state.id !== roomId) return;
  lastState = state;
  updateHud(state);
  draw(state);
});
playAgainBtn.onclick = () => {
  if (roomId) socket.emit("playAgain", { roomId, timer60: !!timer60Replay.checked });
};

// HUD + draw
function updateHud(state) {
  const p1 = state.players?.[0],
    p2 = state.players?.[1];
  roleBadge.textContent = currentRole ? `Role: ${currentRole}` : "";
  scoreP1.textContent = p1 ? `P1(${p1.name}) Score: ${p1.score}` : "P1 waiting…";
  scoreP2.textContent = p2 ? `P2(${p2.name}) Score: ${p2.score}` : "P2 waiting…";
  spectators.textContent = state.spectators?.length ? `Spectators: ${state.spectators.length}` : "Spectators: 0";
  if (state.timerEndsAt) {
    const ms = Math.max(0, state.timerEndsAt - Date.now());
    timerLabel.textContent = `Timer: ${Math.ceil(ms / 1000)}s`;
  } else timerLabel.textContent = "";

  if (state.status === "gameover") {
    if (state.winner === null) alert("Result: Draw!");
    else {
      const w = state.players[state.winner];
      alert(`Winner: ${w.name}!`);
    }
  }
}
function draw(state) {
  resizeCanvasToGrid();
  ctx.clearRect(0, 0, board.width, board.height);
  const cellW = board.width / 24,
    cellH = board.height / 16;
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, board.width, board.height);
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 1;
  for (let x = 1; x < 24; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cellW, 0);
    ctx.lineTo(x * cellW, board.height);
    ctx.stroke();
  }
  for (let y = 1; y < 16; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellH);
    ctx.lineTo(board.width, y * cellH);
    ctx.stroke();
  }
  if (state.food) {
    ctx.fillStyle = "#ffd24c";
    ctx.fillRect(state.food.x * cellW, state.food.y * cellH, cellW, cellH);
  }
  state.players?.forEach(p => {
    if (!p.body) return;
    ctx.fillStyle = p.color;
    p.body.forEach((seg, i) => {
      ctx.fillRect(seg.x * cellW, seg.y * cellH, cellW, cellH);
      if (i === 0) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.strokeRect(seg.x * cellW + 2, seg.y * cellH + 2, cellW - 4, cellH - 4);
      }
    });
  });
  if (state.status !== "running") {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, board.width, board.height);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = `${Math.floor(board.height / 12)}px monospace`;
    ctx.fillText(state.status === "waiting" ? "Waiting…" : "Game Over", board.width / 2, board.height / 2);
  }
}
window.addEventListener("resize", () => {
  if (lastState) draw(lastState);
});
