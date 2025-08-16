const socket = io();
const qs = s => document.querySelector(s);
const nameInput = qs('#name');
const setNameBtn = qs('#setName');
const uploadForm = qs('#uploadForm');
const fileInput = qs('#file');
const filesEl = qs('#files');

// Persist name locally
const storedName = localStorage.getItem('ts:name') || '';
nameInput.value = storedName;
setNameBtn.addEventListener('click', () => {
  localStorage.setItem('ts:name', nameInput.value.trim().slice(0,32) || 'Anonymous');
});

// Helpers
const fmt = ts => new Date(ts).toLocaleString();
function timeLeft(expiresAt) {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms/3600000);
  const m = Math.floor((ms % 3600000)/60000);
  const s = Math.floor((ms % 60000)/1000);
  return `${h}h ${m}m ${s}s left`;
}
function escapeHtml(str){return (str||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));}

// Render a file item
function renderItem(meta, opts={prepend:false}) {
  const li = document.createElement('li');
  li.className = 'file-item';
  li.dataset.id = meta.id;
  li.innerHTML = `
    <div class="file-head">
      <span class="name">${escapeHtml(meta.user)}</span>
      <span class="meta">• ${escapeHtml(meta.originalName)} • ${Math.ceil(meta.size/1024)} KB • ${fmt(meta.createdAt)}</span>
      <span class="meta expires" data-exp="${meta.expiresAt}">• ${timeLeft(meta.expiresAt)}</span>
      <span class="file-actions">
        <a href="${meta.url}" target="_blank" rel="noopener">Open</a>
        <a href="${meta.url}" download>Download</a>
      </span>
    </div>
    <pre class="preview" data-url="${meta.url}">Loading preview…</pre>
  `;
  if (opts.prepend && filesEl.firstChild) filesEl.prepend(li); else filesEl.append(li);
  // Load preview (limit ~100KB)
  fetch(meta.url).then(r=>r.text()).then(t=>{
    const pre = li.querySelector('.preview');
    const max=100*1024;
    pre.textContent = t.length>max ? (t.slice(0,max)+"\n… (truncated preview)") : t;
  }).catch(()=>{
    li.querySelector('.preview').textContent='(preview unavailable)';
  });
}

function tick(){
  document.querySelectorAll('.expires').forEach(el=>{
    const exp = Number(el.getAttribute('data-exp'));
    el.textContent = '• ' + timeLeft(exp);
    if (exp <= Date.now()) el.closest('.file-item')?.remove();
  });
}
setInterval(tick, 1000);

// Initial list
fetch('/files').then(r=>r.json()).then(list=>list.forEach(m=>renderItem(m)));

// Realtime
socket.on('file_uploaded', meta => renderItem(meta, { prepend: true }));
socket.on('file_expired', ({ id }) => document.querySelector(`.file-item[data-id="${id}"]`)?.remove());

// Upload handler
uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = fileInput.files[0];
  if (!f) return alert('Choose a text file first');
  const name = (nameInput.value || 'Anonymous').trim().slice(0,32) || 'Anonymous';

  const data = new FormData();
  data.append('file', f);
  data.append('user', name);

  const res = await fetch('/upload', { method: 'POST', body: data });
  if (!res.ok) {
    const t = await res.text().catch(()=>'');
    alert('Upload failed: ' + t);
    return;
  }
  fileInput.value='';
});
