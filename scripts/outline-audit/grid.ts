// Labeling aid: photo with a 0-1000 grid (every 50, labelled every 100), two faces side by side.
import sharp from 'sharp';
import fs from 'fs';
async function tile(file: string, label: string) {
  const meta = await sharp(file).metadata();
  const H = 900, W = Math.round(meta.width! * H / meta.height!);
  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  for (let i = 50; i < 1000; i += 50) {
    const x = i * W / 1000, y = i * H / 1000, major = i % 100 === 0;
    svg += `<line x1="${x}" x2="${x}" y1="0" y2="${H}" stroke="${major ? 'yellow' : 'cyan'}" stroke-width="${major ? 0.8 : 0.5}" opacity="0.7"/>`;
    svg += `<line y1="${y}" y2="${y}" x1="0" x2="${W}" stroke="${major ? 'yellow' : 'cyan'}" stroke-width="${major ? 0.8 : 0.5}" opacity="0.7"/>`;
    if (major) svg += `<text x="${x + 2}" y="12" fill="yellow" font-size="11">${i}</text><text x="2" y="${y - 2}" fill="yellow" font-size="11">${i}</text>`;
  }
  svg += `<text x="4" y="${H - 6}" fill="white" stroke="black" stroke-width="0.4" font-size="16">${label}</text></svg>`;
  return { buf: await sharp(file).resize(W, H).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 85 }).toBuffer(), W, H };
}
async function main() {
  const [out, ...pairs] = process.argv.slice(2);
  const tiles = [];
  for (let i = 0; i < pairs.length; i += 2) tiles.push(await tile(pairs[i], pairs[i + 1]));
  const totalW = tiles.reduce((s, t) => s + t.W + 10, 0);
  let x = 0; const comps = tiles.map(t => { const c = { input: t.buf, left: x, top: 0 }; x += t.W + 10; return c; });
  await sharp({ create: { width: totalW, height: 900, channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 85 }).toFile(out);
}
main();
