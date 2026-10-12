import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const rows: any[] = JSON.parse(readFileSync(process.argv[2], 'utf8'));
(async () => {
  for (const [label, from, to] of [['before Oct 4', '2026-09-24', '2026-10-04'], ['Oct 4+', '2026-10-04', '2026-10-13']] as const) {
    const list = rows.filter(r => r.src.startsWith('web_mobile/camera') && r.created_at >= from && r.created_at < to);
    const ua = new Map<string, string>();
    for (let i = 0; i < list.length; i += 200) {
      const ids = list.slice(i, i + 200).map(r => r.id);
      const { data, error } = await db.from('upload_telemetry').select('submission_id, user_agent').in('submission_id', ids).eq('event', 'grade_started');
      if (error) throw error;
      for (const d of data || []) ua.set(d.submission_id, d.user_agent || '');
    }
    const agg: Record<string, { n: number; small: number }> = {};
    for (const r of list) {
      const u = ua.get(r.id) || '';
      const k = !u ? 'unknown' : /iPhone|iPad/.test(u) ? (/CriOS/.test(u) ? 'iOS Chrome' : /GSA/.test(u) ? 'iOS Google app' : /FxiOS/.test(u) ? 'iOS Firefox' : 'iOS Safari/other') : /Android/.test(u) ? 'Android' : 'other';
      agg[k] = agg[k] || { n: 0, small: 0 }; agg[k].n++; if (r.short < 1000) agg[k].small++;
    }
    console.log(label, agg);
    const exRelay = list.filter(r => !r.user_id.startsWith('29978476'));
    console.log('  excl relay user small', exRelay.filter(r => r.short < 1000).length, '/', exRelay.length);
  }
})();
