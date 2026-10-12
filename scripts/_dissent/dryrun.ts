// Dry re-grade with DISSENT_RELEASE_V1=1. routingKey is NOT a UUID, so the engine's
// card-row writers (first look, capture quality, CV centering, model) all skip.
// Nothing is written to cards; no email paths are touched.
import { createClient } from '@supabase/supabase-js';
process.env.DISSENT_RELEASE_V1 = '1';
(async () => {
  const { gradeCardConversational } = await import('../../src/lib/visionGrader');
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim());
  const [id, cardType] = process.argv.slice(2);
  const { data: card } = await sb.from('cards').select('front_path, back_path').eq('id', id).single();
  const f = await sb.storage.from('cards').createSignedUrl(card!.front_path, 3600); if (f.error) throw new Error('sign front: ' + f.error.message);
  const b = await sb.storage.from('cards').createSignedUrl(card!.back_path, 3600); if (b.error) throw new Error('sign back: ' + b.error.message);
  const res: any = await gradeCardConversational(f.data!.signedUrl, b.data!.signedUrl, cardType as any, { routingKey: `dissent-dryrun:${id}` });
  const j = JSON.parse(res.markdown_report);
  const gp = j.grading_passes || {};
  console.log(JSON.stringify({
    id: id.slice(0, 8), grade: res.extracted_grade?.decimal_grade, letter: j.image_quality?.confidence_letter,
    passes: ['pass_1', 'pass_2', 'pass_3'].map(k => gp[k] && `${gp[k].final} c${gp[k].centering}/${gp[k].corners}/${gp[k].edges}/${gp[k].surface} ${JSON.stringify(gp[k].centering_ratios)}`),
    hold: j.grade_hold?.cause, hold_reason: j.grade_hold?.reason, dissent_release: j.dissent_release ?? null,
    notes: (gp.consensus_notes || []).filter((n: string) => /majority|DISSENT|unanimity/.test(n)),
    summary_tail: String(j.final_grade?.summary || '').slice(-420),
  }, null, 1));
})();
