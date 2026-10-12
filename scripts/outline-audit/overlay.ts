// Draw stored quad(s) over a downscaled photo for eyeballing. Args: in.jpg out.jpg quadJSON [quad2JSON]
import sharp from 'sharp';
async function main() {
  const [inp, out, ...qs] = process.argv.slice(2);
  const meta = await sharp(inp).metadata();
  const W = 800, H = Math.round(meta.height! * 800 / meta.width!);
  const colors = ['red', 'lime', 'cyan'];
  const polys = qs.map((q, i) => {
    const pts = JSON.parse(q).map((p: any) => `${p.x * W / 1000},${p.y * H / 1000}`).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="${colors[i]}" stroke-width="2"/>`;
  }).join('');
  const grid = Array.from({ length: 9 }, (_, i) => `<line x1="0" x2="${W}" y1="${(i + 1) * H / 10}" y2="${(i + 1) * H / 10}" stroke="yellow" stroke-width="0.5" opacity="0.6"/><text x="2" y="${(i + 1) * H / 10 - 2}" fill="yellow" font-size="12">${(i + 1) * 100}</text>`).join('');
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${grid}${polys}</svg>`;
  await sharp(inp).resize(W, H).composite([{ input: Buffer.from(svg) }]).jpeg().toFile(out);
}
main();
