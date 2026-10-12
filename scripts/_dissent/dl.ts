import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim());
(async () => {
  const s = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const dir = process.argv[3];
  fs.mkdirSync(dir, { recursive: true });
  for (const c of s) for (const side of ['front', 'back']) {
    const f = `${dir}/${c.id.slice(0, 8)}_${side}.jpg`; if (fs.existsSync(f)) continue;
    const { data, error } = await sb.storage.from('cards').download(c[side]);
    if (error) { console.error(c.id, side, error.message); continue; }
    fs.writeFileSync(f, Buffer.from(await data!.arrayBuffer()));
  }
  console.log('ok');
})();
