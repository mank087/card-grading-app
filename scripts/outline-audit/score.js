// Score outline quad sets against the hand-checked reference (Oct 12 2026 audit).
// DIR=<scratch dir with manifest.json + probe.json> node scripts/outline-audit/score.js [name=quads.json ...]
// Error is per edge midpoint, as % of the reference card height (top/bottom) or width (left/right).
const m=require(process.env.DIR+'/manifest.json'), ref=require('./reference-fronts-2026-10-12.json'), probe=(require('fs').existsSync(process.env.DIR+'/probe.json')?require(process.env.DIR+'/probe.json'):{});
const e=q=>[ (q[0].y+q[1].y)/2,(q[3].y+q[2].y)/2,(q[0].x+q[3].x)/2,(q[1].x+q[2].x)/2];
const sets={stored:Object.fromEntries(m.map(c=>[c.id,c.faces.front.quad]))};
for(const v in probe) sets['probe'+v]=Object.fromEntries(Object.entries(probe[v]).map(([id,x])=>[id,x.front]));
for(const a of process.argv.slice(2)){const [n,p]=a.split('=');sets[n]=require(require('path').resolve(process.env.DIR,p));}
const pad=(s,n)=>String(s).padEnd(n);
console.log(pad('set',14),pad('n',4),'MAE% t     b     l     r  | bias% t     b   | >3%  >6%  | median worst%');
for(const [name,set] of Object.entries(sets)){
  const errs=[];let n=0,bad3=0,bad6=0;const sum=[0,0,0,0],bias=[0,0,0,0];const worsts=[];
  for(const id in ref){const q=set[id];if(!q||q.length!==4)continue;n++;
    const R=ref[id].edges, E=e(q); const H=R[1]-R[0], W=R[3]-R[2];
    const d=[(E[0]-R[0])/H,(E[1]-R[1])/H,(E[2]-R[2])/W,(E[3]-R[3])/W].map(x=>x*100);
    d.forEach((x,i)=>{sum[i]+=Math.abs(x);bias[i]+=x});
    const w=Math.max(...d.map(Math.abs));worsts.push(w); if(w>3)bad3++; if(w>6)bad6++;}
  worsts.sort((a,b)=>a-b);
  console.log(pad(name,14),pad(n,4),sum.map(s=>(s/n).toFixed(1).padStart(5)).join(' '),' |',(bias[0]/n).toFixed(1).padStart(5),(bias[1]/n).toFixed(1).padStart(5),' |',pad(bad3,4),pad(bad6,4),' |',worsts[Math.floor(n/2)].toFixed(1));
}
