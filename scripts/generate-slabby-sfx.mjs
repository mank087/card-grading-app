// Synthesizes Slabby's sound effects as small WAVs (nothing to license).
// Writes to public/sfx/ (Lab preview) and slabby/public/sfx/ (renders).
//   node scripts/generate-slabby-sfx.mjs
import fs from 'fs';
import path from 'path';

const SR = 22050;

function writeWav(file, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 32767, 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
}

// pop: sine with fast pitch drop + snappy decay
function pop() {
  const dur = 0.18, n = Math.round(SR * dur), out = new Float64Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const freq = 500 * Math.pow(0.18, t);
    phase += (2 * Math.PI * freq) / SR;
    out[i] = Math.sin(phase) * Math.pow(1 - t, 2.2) * 0.85;
  }
  return out;
}

// whoosh: white noise, smoothed (moving average that tightens over time) with swell envelope
function whoosh() {
  const dur = 0.55, n = Math.round(SR * dur), out = new Float64Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const noise = Math.random() * 2 - 1;
    const smooth = 0.92 - 0.5 * t; // opens up the "filter" as it goes
    acc = acc * smooth + noise * (1 - smooth);
    const env = Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 1.5;
    out[i] = acc * env * 1.6;
  }
  return out;
}

// ding: bright two-partial chime with slow decay (the "gem mint" sparkle)
function ding() {
  const dur = 0.7, n = Math.round(SR * dur), out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 6);
    out[i] = (Math.sin(2 * Math.PI * 1046.5 * t) * 0.55 + Math.sin(2 * Math.PI * 1568 * t) * 0.35) * env * 0.8;
  }
  return out;
}

for (const dir of ['public/sfx', 'slabby/public/sfx']) {
  fs.mkdirSync(dir, { recursive: true });
  writeWav(path.join(dir, 'pop.wav'), pop());
  writeWav(path.join(dir, 'whoosh.wav'), whoosh());
  writeWav(path.join(dir, 'ding.wav'), ding());
  console.log('wrote', dir);
}
