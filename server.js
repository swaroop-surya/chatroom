import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.set('trust proxy', true);
app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const FILES = new Map();

const TTL_MS = 3 * 60 * 60 * 1000;
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'text/plain','text/csv','text/markdown','text/html','text/css','text/xml',
  'application/json','application/xml','application/javascript'
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.' + (mime.extension(file.mimetype) || 'txt');
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype) || file.mimetype.startsWith('text/')) cb(null, true);
    else cb(new Error('Only text files are allowed'));
  }
});

app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Disposition', 'inline');
    const type = mime.lookup(filePath) || 'text/plain';
    res.setHeader('Content-Type', String(type));
  }
}));
app.use('/', express.static(PUBLIC_DIR));

app.get('/files', (req, res) => {
  const now = Date.now();
  const list = [];
  for (const meta of FILES.values()) if (meta.expiresAt > now) list.push(meta);
  list.sort((a,b)=>b.createdAt-a.createdAt);
  res.json(list);
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const name = (req.body.user || 'Anonymous').toString().trim().slice(0,32) || 'Anonymous';
  const now = Date.now();
  const expiresAt = now + TTL_MS;
  const meta = {
    id: uuidv4(),
    user: name,
    originalName: req.file.originalname,
    storedName: req.file.filename,
    mime: req.file.mimetype,
    size: req.file.size,
    createdAt: now,
    expiresAt,
    url: `/uploads/${req.file.filename}`
  };
  FILES.set(req.file.filename, meta);
  io.emit('file_uploaded', meta);
  res.json({ file: meta });
});

setInterval(() => {
  const now = Date.now();
  for (const [storedName, meta] of Array.from(FILES.entries())) {
    if (meta.expiresAt <= now) {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, storedName)); } catch {}
      FILES.delete(storedName);
      io.emit('file_expired', { id: meta.id, url: meta.url });
    }
  }
}, 60000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ TextShare running on http://localhost:${PORT}`));
