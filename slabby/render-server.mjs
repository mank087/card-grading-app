/**
 * Slabby local render server — gives the admin Slabby Lab a one-click
 * Render button. Runs on YOUR machine (rendering needs headless Chrome +
 * ffmpeg, which the web server doesn't have).
 *
 *   cd slabby && npm run serve
 *
 * Binds to 127.0.0.1 only. The Lab POSTs {scene, preset}; this writes the
 * scene JSON, runs `npx remotion render`, and responds with the output path
 * when done (renders take 1-5 minutes — the Lab shows a spinner).
 */
import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 7799;
const PRESETS = new Set(['shorts', 'square', 'wide', 'overlay']);

let busy = false;
let counter = 0;

const EXT_FOR = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp',
  'image/gif': 'gif', 'image/avif': 'avif', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
  'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/aac': 'aac',
};

/**
 * Move every embedded data URL out of the scene and into public/lab-assets/,
 * rewriting the scene to reference the file instead.
 *
 * Two problems this solves:
 *  1. SPEED — a scene with inline base64 makes the props payload 10-15MB, and
 *     Remotion re-serialises it for every frame. Renders that should take
 *     ~2 minutes were estimating 4-6 HOURS. Files are read once, natively.
 *  2. RELIABILITY — Remotion's data-URL parser rejects MIME parameters such
 *     as MediaRecorder's `audio/webm;codecs=opus`. Files have no such issue.
 *
 * Assets are content-hashed, so re-rendering the same scene reuses them.
 */
function externalizeAssets(scene) {
  const dir = path.join(__dirname, 'public', 'lab-assets');
  fs.mkdirSync(dir, { recursive: true });
  let written = 0;
  let savedBytes = 0;

  const put = (value) => {
    if (typeof value !== 'string' || !value.startsWith('data:')) return value;
    const comma = value.indexOf(',');
    if (comma < 0) return value;
    const header = value.slice(5, comma);
    const mime = header.split(';')[0].toLowerCase();
    const b64 = value.slice(comma + 1);
    let buf;
    try { buf = Buffer.from(b64, 'base64'); } catch { return value; }
    if (!buf.length) return value;

    const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
    const file = `${hash}.${EXT_FOR[mime] || 'bin'}`;
    const abs = path.join(dir, file);
    if (!fs.existsSync(abs)) { fs.writeFileSync(abs, buf); written++; }
    savedBytes += value.length;
    // Relative to public/ — Remotion resolves it via staticFile().
    return `lab-assets/${file}`;
  };

  const beats = scene.beats.map((b) => ({
    ...b,
    voiceoverAudio: put(b.voiceoverAudio),
    backgroundImage: put(b.backgroundImage),
    ...(b.slabCard ? { slabCard: { ...b.slabCard, image: put(b.slabCard.image) } } : {}),
    ...(b.detailsPage ? { detailsPage: { ...b.detailsPage, image: put(b.detailsPage.image) } } : {}),
  }));

  return { scene: { ...scene, beats }, written, savedMb: (savedBytes / 1048576).toFixed(1) };
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  // Chrome Private Network Access: an HTTPS page (the admin Lab on
  // dcmgrading.com) calling a localhost server must receive this header on
  // the preflight or the browser blocks the request entirely.
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, busy }));
    return;
  }

  if (req.method === 'POST' && req.url === '/render') {
    if (busy) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'A render is already running — wait for it to finish.' }));
      return;
    }
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 80_000_000) req.destroy(); });
    req.on('end', () => {
      try {
        const { scene, preset } = JSON.parse(body);
        if (!scene?.beats?.length) throw new Error('Invalid scene');
        const p = PRESETS.has(preset) ? preset : 'shorts';
        const stamp = `${Date.now().toString(36)}-${++counter}`;
        const safeName = String(scene.name || 'scene').replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
        const sceneFile = path.join(__dirname, 'scenes', `_lab-${safeName}-${stamp}.json`);
        const outFile = path.join(__dirname, 'out', `${safeName}-${p}-${stamp}.mp4`);
        fs.mkdirSync(path.join(__dirname, 'scenes'), { recursive: true });
        fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });

        // Pull embedded base64 out to files — see externalizeAssets().
        const ext = externalizeAssets(scene);
        if (ext.savedMb > 0.5) {
          console.log(`[render] externalized ${ext.savedMb}MB of assets (${ext.written} new files)`);
        }
        fs.writeFileSync(sceneFile, JSON.stringify({ scene: ext.scene }));

        busy = true;
        console.log(`[render] ${safeName} (${p}) starting…`);
        // --port: Remotion serves its bundle on 3000 by default, which
        // collides with a running Next dev server and fails with
        // 'Visited http://localhost:3000/index.html but got no response'.
        const args = [
          'remotion', 'render', 'src/index.ts', `composer-${p}`, outFile,
          `--props=${sceneFile}`, '--port=7788',
        ];
        if (p === 'overlay') args.push('--codec=vp8', '--image-format=png');
        const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
          cwd: __dirname,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: process.platform === 'win32',
        });
        let tail = '';
        const capture = (d) => { tail = (tail + d.toString()).slice(-2000); process.stdout.write(d); };
        child.stdout.on('data', capture);
        child.stderr.on('data', capture);
        child.on('close', (code) => {
          busy = false;
          fs.rmSync(sceneFile, { force: true });
          if (code === 0) {
            console.log(`[render] done → ${outFile}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, output: outFile }));
          } else {
            console.error(`[render] FAILED (exit ${code})`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Render failed (exit ${code})`, tail }));
          }
        });
      } catch (e) {
        busy = false;
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Slabby render server ready → http://127.0.0.1:${PORT}`);
  console.log('Leave this running; the admin Slabby Lab Render button uses it.');
});
