import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim());
(async () => {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const out: any[] = [];
  for (let page = 0; page < 40; page++) {
    const { data, error } = await sb.from('cards')
      .select('id, created_at, category, serial, conversational_whole_grade, conversational_image_confidence, conversational_final_grade_summary')
      .gte('created_at', since)
      .ilike('conversational_final_grade_summary', '%presents at Gem Mint%')
      .order('created_at', { ascending: false })
      .range(page * 500, page * 500 + 499);
    if (error) { console.error(error.message); break; }
    out.push(...data!);
    if (data!.length < 500) break;
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  console.log('rows', out.length);
})();
