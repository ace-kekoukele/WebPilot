// daemon/static-server.js — 静态文件 serve (WebPilot GUI)
// 用户用 Chrome 打开 http://127.0.0.1:9224/ 即可看到桌面面板
//
// 仅 serve: electron/renderer/dist/ (React build,v4.0.2 起不再有 vanilla fallback)
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIME_TYPES } from './static-mime.js';

const MIME = MIME_TYPES;

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(ROOT_DIR, '..');

const STATIC_DIR = path.resolve(PROJECT_ROOT, 'electron/renderer/dist');

let _activeDir = null;
let _activeDirName = null;
function pickActiveDir() {
  if (_activeDir) return _activeDir;
  if (existsSync(STATIC_DIR)) {
    _activeDir = STATIC_DIR;
    _activeDirName = 'react-build';
    return _activeDir;
  }
  return null;
}

function serveStatic(req, res) {
  const STATIC_DIR = pickActiveDir();
  if (!STATIC_DIR) {
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    return res.end('WebPilot GUI 未构建. 跑 npm run build 生成 electron/renderer/dist/');
  }

  let url = req.url || '/';
  url = url.split('?')[0];
  if (url === '/') url = '/index.html';
  if (url.includes('..')) { res.writeHead(403); return res.end('forbidden'); }
  const filePath = path.join(STATIC_DIR, url);
  if (!existsSync(filePath)) {
    const idx = path.join(STATIC_DIR, 'index.html');
    try {
      const html = readFileSync(idx);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(html);
    } catch (e) { res.writeHead(404); return res.end('not found'); }
  }
  try {
    const st = statSync(filePath);
    if (!st.isFile()) { res.writeHead(404); return res.end('not found'); }
    const data = readFileSync(filePath);
    const ext = path.extname(filePath).slice(1);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime + (mime.startsWith('text/') ? '; charset=utf-8' : ''),
      'Content-Length': data.length,
      'Cache-Control': ext === 'html' ? 'no-cache' : 'max-age=3600',
      'Access-Control-Allow-Origin': process.env.BB_HTTP_CORS_ORIGIN || 'http://127.0.0.1:*',
      'X-WebPilot-GUI-Source': _activeDirName,
    });
    res.end(data);
  } catch (e) { res.writeHead(500); res.end('error: ' + e.message); }
}

export function attachStaticHandlers(httpServer) {
  httpServer.on('request', (req, res) => {
    const url = req.url || '/';
    if (url.startsWith('/api/') || url.startsWith('/mcp') || url.startsWith('/.well-known/')) return;
    serveStatic(req, res);
  });
}

export function getActiveStaticDir() { return pickActiveDir(); }
export function getActiveStaticDirName() { return _activeDirName; }
