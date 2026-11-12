// Zimmerboard-Server: Zimmerstatus und Team-Chat ohne Benutzerkonten.
// Zugang mit einer gemeinsamen Team-PIN. Braucht nur Node.js (ab Version 18), keine Pakete.
//
// Start:  node server.js
// Einstellungen über Umgebungsvariablen:
//   PORT       Port des Servers (Standard 8080)
//   TEAM_PIN   Team-PIN (sonst wird sie aus data/pin.txt gelesen bzw. dort neu erzeugt)
//   DATA_DIR   Ordner für die Daten (Standard ./data)

'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = Number(process.env.PORT) || 8080;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_FILE = path.join(DATA_DIR, 'board.json');
const MAX_CHAT = 2000;
const MAX_BODY = 256 * 1024;
const COOKIE = 'zb_session';

fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- PIN und Sitzungsschlüssel ----------
function readOrCreate(file, make) {
  const p = path.join(DATA_DIR, file);
  try { const v = fs.readFileSync(p, 'utf8').trim(); if (v) return v; } catch (e) {}
  const v = make();
  fs.writeFileSync(p, v + '\n', { mode: 0o600 });
  return v;
}
const PIN = String(process.env.TEAM_PIN || readOrCreate('pin.txt', () => String(crypto.randomInt(100000, 1000000)))).trim();
const SECRET = readOrCreate('secret.txt', () => crypto.randomBytes(32).toString('hex'));
// Das Sitzungs-Token hängt an der PIN: Wird die PIN geändert, müssen sich alle neu anmelden.
const TOKEN = crypto.createHmac('sha256', SECRET).update('pin:' + PIN).digest('hex');

// ---------- Daten ----------
let db = { rooms: {}, chat: {}, meta: {} };
try {
  const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  db = { rooms: raw.rooms || {}, chat: raw.chat || {}, meta: raw.meta || {} };
} catch (e) {
  if (e.code !== 'ENOENT') { console.error('board.json konnte nicht gelesen werden:', e.message); process.exit(1); }
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const tmp = DB_FILE + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, DB_FILE);
    } catch (e) { console.error('Speichern fehlgeschlagen:', e.message); }
  }, 300);
}
function flushSave() {
  if (!saveTimer) return;
  clearTimeout(saveTimer); saveTimer = null;
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db)); } catch (e) {}
}
process.on('SIGINT', () => { flushSave(); process.exit(0); });
process.on('SIGTERM', () => { flushSave(); process.exit(0); });

function trimChat() {
  const ids = Object.keys(db.chat);
  if (ids.length <= MAX_CHAT) return;
  ids.sort((a, b) => String(db.chat[a].t).localeCompare(String(db.chat[b].t)));
  for (const id of ids.slice(0, ids.length - MAX_CHAT)) delete db.chat[id];
}

// ---------- Live-Updates (Server-Sent Events) ----------
const clients = new Set();
function broadcast(msg) {
  const line = 'data: ' + JSON.stringify(msg) + '\n\n';
  for (const res of clients) res.write(line);
}
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 25000);

// ---------- Hilfen ----------
const ID_RE = /^[A-Za-z0-9_\-]{1,80}$/;
function send(res, status, obj, headers) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(obj));
}
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(c => { const i = c.indexOf('='); if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); });
  return out;
}
function authed(req) {
  const t = cookies(req)[COOKIE] || '';
  return t.length === TOKEN.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(TOKEN));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('zu groß'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(Object.assign(new Error('ungültiges JSON'), { status: 400 })); } });
    req.on('error', reject);
  });
}
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

// Einfacher Schutz gegen PIN-Raten: max. 8 Fehlversuche pro IP in 10 Minuten.
const fails = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (fails.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  fails.set(ip, list);
  return list.length >= 8;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

// ---------- Server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const ip = req.socket.remoteAddress || '';
  try {
    if (p === '/api/login' && req.method === 'POST') {
      if (tooMany(ip)) return send(res, 429, { error: 'Zu viele Fehlversuche. Bitte in 10 Minuten erneut versuchen.' });
      const body = await readBody(req);
      if (String(body.pin || '').trim() !== PIN) {
        fails.get(ip).push(Date.now());
        return send(res, 401, { error: 'Falsche PIN.' });
      }
      const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
      return send(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=${TOKEN}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${180 * 86400}${secure}` });
    }
    if (p === '/api/logout' && req.method === 'POST') {
      return send(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` });
    }

    if (p.startsWith('/api/')) {
      if (!authed(req)) return send(res, 401, { error: 'Nicht angemeldet.' });

      if (p === '/api/state' && req.method === 'GET') return send(res, 200, db);

      if (p === '/api/events' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write('retry: 3000\n');
        res.write('data: ' + JSON.stringify({ type: 'init', db }) + '\n\n');
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }

      const m = p.match(/^\/api\/(rooms|chat)\/([^/]+)$/);
      if (m && req.method === 'PUT') {
        const kind = m[1], id = decodeURIComponent(m[2]);
        if (!ID_RE.test(id)) return send(res, 400, { error: 'Ungültige ID.' });
        const body = await readBody(req);
        if (!isObj(body)) return send(res, 400, { error: 'Ungültige Daten.' });
        if (kind === 'chat') {
          if (db.chat[id]) return send(res, 409, { error: 'Nachricht existiert schon.' });
          const text = String(body.text || '').trim().slice(0, 1000);
          if (!text) return send(res, 400, { error: 'Leere Nachricht.' });
          const msg = {
            text,
            name: String(body.name || '').trim().slice(0, 40),
            uid: String(body.uid || '').slice(0, 60),
            rolle: String(body.rolle || '').slice(0, 20),
            unit: String(body.unit || '').slice(0, 40),
            t: new Date().toISOString()
          };
          db.chat[id] = msg; trimChat();
          broadcast({ type: 'chat', id, data: msg });
        } else {
          db.rooms[id] = body;
          broadcast({ type: 'room', id, data: body });
        }
        scheduleSave();
        return send(res, 200, { ok: true });
      }
      if (p === '/api/meta/tag' && req.method === 'PUT') {
        const body = await readBody(req);
        if (!isObj(body)) return send(res, 400, { error: 'Ungültige Daten.' });
        db.meta.tag = body; scheduleSave();
        broadcast({ type: 'meta', data: body });
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: 'Nicht gefunden.' });
    }

    // Statische Dateien
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Nicht erlaubt.' });
    const rel = p === '/' ? 'index.html' : decodeURIComponent(p).replace(/^\/+/, '');
    const file = path.resolve(PUBLIC_DIR, rel);
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, { error: 'Nicht gefunden.' });
    fs.readFile(file, (err, buf) => {
      if (err) return send(res, 404, { error: 'Nicht gefunden.' });
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : buf);
    });
  } catch (e) {
    send(res, e.status || 500, { error: e.status ? e.message : 'Serverfehler.' });
    if (!e.status) console.error(e);
  }
});

server.listen(PORT, () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log('');
  console.log('  Zimmerboard läuft.');
  console.log('  Auf diesem PC:      http://localhost:' + PORT);
  ips.forEach(a => console.log('  Im Hotel-WLAN:      http://' + a + ':' + PORT));
  console.log('  Team-PIN:           ' + PIN + (process.env.TEAM_PIN ? '' : '   (ändern: data/pin.txt bearbeiten und neu starten)'));
  console.log('  Daten liegen in:    ' + DATA_DIR);
  console.log('');
});
