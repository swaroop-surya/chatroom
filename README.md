# TextShare (3‑hour public text uploads)

A tiny website where anyone can upload **text files** (no accounts). All uploads are public and auto‑delete after **3 hours**.

## Features
- No login; users set a display name
- Upload text files up to 2 MB (txt, md, csv, json, html, xml, css, js)
- Everyone sees new files instantly (Socket.IO)
- Inline previews for small files
- Files are removed automatically after 3 hours

## Requirements
- Node.js 18+

## Run locally
```bash
npm install
npm start
# open http://localhost:3000
```

## Deploy
Host on any Node.js platform (Render, Railway, Fly.io, etc.). The app listens on `PORT`.
