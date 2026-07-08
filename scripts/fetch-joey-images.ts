import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const OUT = process.argv[2];
const FILES: [string, string][] = [
  ['saddam-front', '7483d95f-62ac-42fa-a104-1f62bef961be/910dd3de-d62f-4996-9fd4-f338039668fd/front.jpg'],
  ['mj-jpeg-front', '7483d95f-62ac-42fa-a104-1f62bef961be/917d6b3e-17de-466a-8a0e-167ff54455aa/front.jpg'],
  ['mj-camera-front', '7483d95f-62ac-42fa-a104-1f62bef961be/b98dc05b-db1d-4432-9095-84964d07eb49/front.jpg'],
  ['andre-jpeg-front', '7483d95f-62ac-42fa-a104-1f62bef961be/848ddbc1-7327-47c5-96b4-ef5e5385ef4d/front.jpg'],
  ['andre-camera-front', '7483d95f-62ac-42fa-a104-1f62bef961be/cd250fa5-e1d6-433b-b355-40233c83a89a/front.jpg'],
];

async function main() {
  for (const [name, key] of FILES) {
    const { data, error } = await supabase.storage.from('cards').createSignedUrl(key, 600);
    if (error || !data) { console.log(`${name}: ERR ${error?.message}`); continue; }
    const res = await fetch(data.signedUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    const dest = path.join(OUT, `${name}.jpg`);
    fs.writeFileSync(dest, buf);
    console.log(`${name}: ${(buf.length / 1024).toFixed(0)}KB -> ${dest}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
