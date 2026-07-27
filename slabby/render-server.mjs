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
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 7799;
const PRESETS = new Set(['shorts', 'square', 'wide', 'overlay']);

let busy = false;
let counter = 0;

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
        fs.writeFileSync(sceneFile, JSON.stringify({ scene }));

        busy = true;
        console.log(`[render] ${safeName} (${p}) starting…`);
        const args = ['remotion', 'render', 'src/index.ts', `composer-${p}`, outFile, `--props=${sceneFile}`];
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
