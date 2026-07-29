/**
 * Builds the 60-second "Super Slabby" Spider-Man grade-reveal scene and uploads
 * it to the Slabby Lab drafts bucket for review.
 *
 * Card: 1992 Impel Marvel Universe "Super Heroes" #1 Spider-Man (serial 984567).
 * Grade 10, all four subgrades 10, and 50/50 centering on all four measurements.
 * The hook is real pop data: six copies of this exact card have been graded and
 * only this one came back a 10.
 *
 * Every number in the script is read from the DB at build time — subgrades,
 * centering ratios, professional estimates, and the grade distribution — so the
 * script can't drift from the actual grade. Re-run it to rebuild.
 *
 * Voiceover text is written per beat but NO audio is generated: it's recorded by
 * hand in the Lab, then transcribed so karaoke syncs to the real speech.
 *
 *   npx tsx scripts/build-spiderman-slabby-scene.ts [serial]
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import type { SlabbyScene, SlabbyBeat, SlabCardData } from '../src/lib/slabby/types';

dotenv.config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const SERIAL = process.argv[2] || '984567';
const DRAFT_NAME = 'super-slabby-spider-man-1992-60s';
const BUCKET = 'slabby-drafts';
/** Older draft this one replaces — removed so the Lab list stays clean. */
const SUPERSEDES = 'super-slabby-cosmic-spider-man-60s';

async function main() {
  const { data: card, error } = await s.from('cards').select('*').eq('serial', SERIAL).maybeSingle();
  if (error) throw error;
  if (!card) throw new Error(`No card with serial ${SERIAL}`);

  const c = card as any;
  const label = c.label_data || {};
  const subs = c.conversational_sub_scores || {};
  const pro = c.estimated_professional_grades || {};
  const cen = c.conversational_centering_ratios || {};

  // Real pop data for this exact card — the hook of the whole video.
  const { data: pop } = await s
    .from('cards')
    .select('serial, conversational_whole_grade')
    .ilike('card_name', `%${c.card_name}%`)
    .ilike('card_set', `%${c.card_set}%`)
    .eq('card_number', c.card_number)
    .not('conversational_whole_grade', 'is', null);
  const graded = pop || [];
  const tens = graded.filter((p) => p.conversational_whole_grade === 10).length;
  const nines = graded.filter((p) => p.conversational_whole_grade === 9).length;
  console.log(`pop: ${graded.length} graded — ${nines} nines, ${tens} tens`);

  // Inline the front image so the scene JSON is self-contained (signed URLs expire).
  const { data: signed } = await s.storage.from('cards').createSignedUrl(c.front_path, 600);
  if (!signed?.signedUrl) throw new Error('Could not sign the front image');
  const res = await fetch(signed.signedUrl);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const image = `data:${res.headers.get('content-type') || 'image/jpeg'};base64,${buf.toString('base64')}`;
  console.log(`front image inlined: ${(buf.length / 1024).toFixed(0)} KB`);

  const slab: SlabCardData = {
    image,
    name: label.primaryName || c.card_name,
    contextLine: label.contextLine || '',
    featuresLine: label.featuresLine ?? null,
    serial: label.serial || c.serial,
    gradeFormatted: label.gradeFormatted || String(c.conversational_whole_grade),
    condition: label.condition || c.conversational_condition_label,
    category: label.category || c.category,
    subgrades: {
      centering: subs.centering?.weighted ?? null,
      corners: subs.corners?.weighted ?? null,
      edges: subs.edges?.weighted ?? null,
      surface: subs.surface?.weighted ?? null,
    },
    summary: c.conversational_final_grade_summary || null,
  };

  console.log(`card: ${slab.name} — ${slab.contextLine} — grade ${slab.gradeFormatted} ${slab.condition}`);
  console.log(`subgrades: ${JSON.stringify(slab.subgrades)}`);
  console.log(`centering: front ${cen.front_lr}/${cen.front_tb}, back ${cen.back_lr}/${cen.back_tb}`);

  /** Slab mockup held still behind Slabby. */
  const held = (over: Partial<SlabbyBeat> = {}): Partial<SlabbyBeat> => ({
    slabCard: slab,
    bgAnimation: 'static',
    ...over,
  });

  const beats: SlabbyBeat[] = [
    {
      duration: 4,
      motion: 'fly-in',
      expression: 'excited',
      gradeText: '10',
      gradeLabel: 'GEM MINT',
      headline: `${graded.length} PEOPLE. 1 TEN.`,
      caption: 'Super Slabby, reporting in',
      voiceover:
        `${graded.length} different people sent us this exact same card. Only one of them came back a ten. Let me show you what separated it.`,
    },
    {
      duration: 5,
      motion: 'hover',
      expression: 'happy',
      gradeText: '10',
      gradeLabel: 'GEM MINT',
      headline: 'SPIDER-MAN · 1992',
      ...held({ bgAnimation: 'pop' }),
      voiceover:
        "Nineteen ninety-two Impel. Marvel Universe, Super Heroes subset, card number one. Spider-Man. Not a rare card. Millions of these were printed.",
    },
    {
      duration: 5,
      motion: 'point',
      expression: 'thinking',
      gradeText: '10',
      gradeLabel: 'GEM MINT',
      headline: 'SAME CARD. DIFFERENT GRADE.',
      ...held(),
      voiceover:
        `And that's exactly the point. ${nines} of the copies we graded came back a nine. One came back a ten. Same card, same year, same print run.`,
    },
    {
      duration: 5,
      motion: 'shake',
      expression: 'shocked',
      gradeText: '?',
      gradeLabel: 'GRADING…',
      headline: 'FOUR CATEGORIES',
      ...held(),
      voiceover:
        "So what's the difference between a nine and a ten? Four categories. Centering, corners, edges, surface. And you have to win all four.",
    },
    {
      duration: 5,
      motion: 'point',
      expression: 'thinking',
      gradeText: '?',
      gradeLabel: 'GRADING…',
      headline: 'CENTERING',
      detailsPage: slab,
      bgAnimation: 'fade',
      scrollFrom: 0,
      scrollTo: 0.42,
      voiceover:
        `Centering first. ${cen.front_lr || '50/50'} left to right. ${cen.front_tb || '50/50'} top to bottom. Then we flip it — ${cen.back_lr || '50/50'} and ${cen.back_tb || '50/50'} on the back. All four measurements dead perfect.`,
    },
    {
      duration: 5,
      motion: 'idle',
      expression: 'happy',
      gradeText: '?',
      gradeLabel: 'GRADING…',
      headline: 'CORNERS & EDGES',
      detailsPage: slab,
      bgAnimation: 'static',
      scrollFrom: 0.42,
      scrollTo: 0.68,
      voiceover:
        "Corners: four sharp points, front and back. No whitening, no softness. Edges: full color the whole way around, no chipping. Ten and ten.",
    },
    {
      duration: 5,
      motion: 'point',
      expression: 'thinking',
      gradeText: '?',
      gradeLabel: 'GRADING…',
      headline: 'SURFACE',
      detailsPage: slab,
      bgAnimation: 'static',
      scrollFrom: 0.68,
      scrollTo: 0.9,
      voiceover:
        "Surface is usually where these lose it. This one: no scratches, no scuffs, no print defects, full original gloss. On a card that's thirty-four years old.",
    },
    {
      duration: 4,
      motion: 'shake',
      expression: 'shocked',
      gradeText: '?',
      gradeLabel: 'GRADING…',
      headline: 'FINAL GRADE…',
      ...held(),
      voiceover: "Four categories. Nothing gave. Which means…",
    },
    {
      duration: 5,
      motion: 'celebrate',
      expression: 'excited',
      gradeText: '10',
      gradeLabel: 'GEM MINT',
      headline: 'GEM MINT 10',
      caption: `Serial ${slab.serial}`,
      ...held({ bgAnimation: 'pop' }),
      voiceover:
        "Ten. Gem Mint. Centering ten, corners ten, edges ten, surface ten. There's no weak link anywhere on this card — that's what makes it a true ten.",
    },
    {
      duration: 6,
      motion: 'point',
      expression: 'happy',
      gradeText: '10',
      gradeLabel: 'GEM MINT',
      headline: 'WHERE IT WOULD LAND',
      detailsPage: slab,
      bgAnimation: 'fade',
      scrollFrom: 0.9,
      scrollTo: 1,
      voiceover:
        `We also estimate the big houses. P-S-A: ${pro.PSA?.estimated_grade || '10 Gem Mint'}. B-G-S: ${pro.BGS?.estimated_grade || '10 Pristine'} — that's the black label. S-G-C: pristine. All four, top of the scale.`,
    },
    {
      duration: 5,
      motion: 'wave',
      expression: 'wink',
      gradeText: '10',
      gradeLabel: 'GEM MINT',
      headline: 'ONE MORE THING',
      ...held(),
      voiceover:
        "The back of this card quotes Amazing Spider-Man number eighteen, from nineteen sixty-four. \"A man can't change his destiny — and I was born to be Spider-Man.\" They don't write card backs like that anymore.",
    },
    {
      duration: 6,
      motion: 'celebrate',
      expression: 'excited',
      gradeText: '10',
      gradeLabel: 'GEM MINT',
      headline: 'DCMGRADING.COM',
      caption: 'Two free grades to start',
      ...held({ bgAnimation: 'pop' }),
      voiceover:
        `${nines} nines and one ten, out of ${graded.length} identical cards. That right there is the whole reason you grade. Two free grades to start, and you get this exact breakdown. Super Slabby, out.`,
    },
  ];

  const scene: SlabbyScene = { name: DRAFT_NAME, costume: 'hero', beats };

  const total = beats.reduce((n, b) => n + b.duration, 0);
  console.log(`\nscene: ${beats.length} beats, ${total}s`);

  // Wrapped in { scene } — the shape `remotion render --props=` needs. The Lab's
  // draft and file loaders both accept either form.
  const json = JSON.stringify({ scene });
  console.log(`scene JSON: ${(json.length / 1024 / 1024).toFixed(2)} MB`);

  const localPath = path.join('slabby', 'scenes', `${DRAFT_NAME}.json`);
  fs.writeFileSync(localPath, json);
  console.log(`wrote ${localPath}`);

  const { data: bucket } = await s.storage.getBucket(BUCKET);
  if (!bucket) await s.storage.createBucket(BUCKET, { public: false });
  const { error: upErr } = await s.storage
    .from(BUCKET)
    .upload(`${DRAFT_NAME}.json`, Buffer.from(json), { contentType: 'application/json', upsert: true });
  if (upErr) throw upErr;
  console.log(`uploaded draft "${DRAFT_NAME}" to ${BUCKET}`);

  if (SUPERSEDES) {
    await s.storage.from(BUCKET).remove([`${SUPERSEDES}.json`]);
    console.log(`removed superseded draft "${SUPERSEDES}"`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
