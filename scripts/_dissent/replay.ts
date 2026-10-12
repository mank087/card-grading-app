// Replays the majority-gate centering check on stored pass records (no DB, no API).
import * as fs from 'fs';
import { centeringDissentEvidence } from '../../src/lib/grading/dissentRelease';
const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const R = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const out: Record<string, number> = {}; const released: string[] = [];
for (const r of R) {
  if (r.why !== 'cenMeasured' && r.why !== 'cenDisagree') continue;
  const d = D[r.id]; const P = d.passes; const fs_ = P.map((p: any) => p.f);
  const di = fs_.indexOf(Math.min(...fs_));
  const cr = d.cen ? { front_lr: d.cen.f.lr, front_tb: d.cen.f.tb, back_lr: d.cen.b.lr, back_tb: d.cen.b.tb } : null;
  const input = { cardRatios: cr, dissenter: { ratios: P[di].r, dev: P[di].dev }, majority: P.filter((_: any, i: number) => i !== di).map((p: any) => ({ ratios: p.r, dev: p.dev })) };
  const off = centeringDissentEvidence(input, false), on = centeringDissentEvidence(input, true);
  const k = `off:${off.arm} on:${on.arm}`; out[k] = (out[k] || 0) + 1;
  if (off.evidence && !on.evidence) released.push(`${r.id.slice(0, 8)} ${r.date} ${r.name}`);
}
console.log(out); console.log('released with flag ON:', released.length); released.forEach(x => console.log('  ' + x));
