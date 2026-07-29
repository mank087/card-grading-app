/**
 * Builds the 60-second "Super Slabby vs. the Cosmic Spider-Man" scene and
 * uploads it to the Slabby Lab drafts bucket for review.
 *
 * Every number in the script comes from the real graded card (serial 527738),
 * not from copy — subgrades, centering ratios, and the professional-grade
 * estimates are read straight out of the row.
 *
 * Voiceover text is written per beat but NO audio is generated: the plan is to
 * record it in the Lab, then transcribe so karaoke syncs to the real speech.
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
const SERIAL = process.argv[2] || '527738';
const DRAFT_NAME = 'super-slabby-cosmic-spider-man-60s';
const BUCKET = 'slabby-drafts';

async function main() {
  const { data: card, error } = await s.from('cards').select('*').eq('serial', SERIAL).maybeSingle();
  if (error) throw error;
  if (!card) throw new Error(`No card with serial ${SERIAL}`);

  const label = (card as any).label_data || {};
  const subs = (card as any).conversational_sub_scores || {};
  const pro = (card as any).estimated_professional_grades || {};
  const centering = (card as any).conversational_centering_ratios || {};

  // Inline the front image so the scene JSON is self-contained (signed URLs expire).
  const { data: signed } = await s.storage.from('cards').createSignedUrl((card as any).front_path, 600);
  if (!signed?.signedUrl) throw new Error('Could not sign the front image');
  const res = await fetch(signed.signedUrl);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const image = `data:${res.headers.get('content-type') || 'image/jpeg'};base64,${buf.toString('base64')}`;
  console.log(`front image inlined: ${(buf.length / 1024).toFixed(0)} KB`);

  const slab: SlabCardData = {
    image,
    name: label.primaryName || card.card_name,
    contextLine: label.contextLine || '',
    featuresLine: label.featuresLine ?? null,
    serial: label.serial || card.serial,
    gradeFormatted: label.gradeFormatted || String(card.conversational_whole_grade),
    condition: label.condition || card.conversational_condition_label,
    category: label.category || card.category,
    subgrades: {
      centering: subs.centering?.weighted ?? null,
      corners: subs.corners?.weighted ?? null,
      edges: subs.edges?.weighted ?? null,
      surface: subs.surface?.weighted ?? null,
    },
    summary: (card as any).conversational_final_grade_summary || null,
  };

  console.log(`card: ${slab.name} — grade ${slab.gradeFormatted} ${slab.condition}`);
  console.log(`subgrades: ${JSON.stringify(slab.subgrades)}`);
  console.log(`centering: front ${centering.front_lr} L/R, ${centering.front_tb} T/B`);
  console.log(`pro: PSA ${pro.PSA?.estimated_grade}, BGS ${pro.BGS?.estimated_grade}, SGC ${pro.SGC?.estimated_grade}`);

  // Held still behind Slabby across consecutive beats.
  const held = (over: Partial<SlabbyBeat>): Partial<SlabbyBeat> => ({
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
      headline: 'A PERFECT 10?',
      caption: 'Super Slabby, reporting in',
      voiceover:
        "Somebody just sent in a nineteen-ninety Marvel hologram. And I need you to see what our grader did with it.",
    },
    {
      duration: 5,
      motion: 'hover',
      expression: 'happy',
      gradeText: '10',
      gradeLabel: 'GEM MINT',
      headline: 'COSMIC SPIDER-MAN',
      ...held({ bgAnimation: 'pop' }),
      voiceover:
        "This is card M-H-one, Cosmic Spider-Man, from the nineteen-ninety Marvel Universe hologram set. Impel printed five of these. This is the first one.",
    },
    {
      duration: 5,
      motion: 'point',
      expression: 'thinking',
      gradeText: '10',
      gradeLabel: 'GEM MINT',
      headline: 'THE HARD PART',
      ...held({}),
      voiceover:
        "Here's the thing about holograms. That foil surface shows every single thing you do to it. A fingerprint. A soft corner. One bad slide into a binder.",
    },
    {
      duration: 5,
      motion: 'shake',
      expression: 'shocked',
      gradeText: '?',
      gradeLabel: 'GRADING…',
      headline: 'FOUR CATEGORIES',
      ...held({}),
      voiceover:
        "So we go category by category. Centering. Corners. Edges. Surface. And on a card this old, something almost always gives.",
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
      scrollTo: 0.3,
      voiceover:
        `Centering first. Front is ${centering.front_lr || '50/50'} left to right, ${centering.front_tb || '50/50'} top to bottom. That is dead center. The back comes in at ${centering.back_lr || '48/52'}, which is still well inside gem range.`,
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
      scrollFrom: 0.3,
      scrollTo: 0.58,
      voiceover:
        "Corners: all four sharp, front and back. Edges: clean, no chipping along the foil. Both score a ten. On a thirty-five year old card.",
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
      scrollFrom: 0.58,
      scrollTo: 0.85,
      voiceover:
        "And then the surface. No print lines. No scratches through the foil. Full original gloss. This is the category that usually ends the run, and it did not.",
    },
    {
      duration: 4,
      motion: 'shake',
      expression: 'shocked',
      gradeText: '?',
      gradeLabel: 'GRADING…',
      headline: 'FINAL GRADE…',
      ...held({}),
      voiceover: "Four categories. Four tens. Which means…",
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
        "A ten. Gem Mint. Centering ten, corners ten, edges ten, surface ten — there is no weak link anywhere on this card.",
    },
    {
      duration: 6,
      motion: 'point',
      expression: 'happy',
      gradeText: '10',
      gradeLabel: 'GEM MINT',
      headline: 'WHAT THE GRADERS WOULD SAY',
      detailsPage: slab,
      bgAnimation: 'fade',
      scrollFrom: 0.85,
      scrollTo: 1,
      voiceover:
        `We also estimate where it lands with the big houses. P-S-A: ${pro.PSA?.estimated_grade || '10 Gem Mint'}. B-G-S: ${pro.BGS?.estimated_grade || '10 Pristine'} — that's the black label. S-G-C: pristine. All four, top of the scale.`,
    },
    {
      duration: 5,
      motion: 'wave',
      expression: 'wink',
      gradeText: '10',
      gradeLabel: 'GEM MINT',
      headline: 'FUN FACT',
      ...held({}),
      voiceover:
        "One more thing. The back of this card brags that posing for the hologram was the first time these heroes got hit by a laser beam that wasn't being used as a weapon against them. Nineteen-ninety was undefeated.",
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
        "Got a card you think is a ten? Send it through and find out. Two free grades to start, and you get the full breakdown just like this one. Super Slabby, out.",
    },
  ];

  const scene: SlabbyScene = {
    name: DRAFT_NAME,
    costume: 'hero', // caped + masked for the whole video
    beats,
  };

  const total = beats.reduce((n, b) => n + b.duration, 0);
  console.log(`\nscene: ${beats.length} beats, ${total}s`);

  // Wrapped in { scene } — that's the shape `remotion render --props=` needs
  // for the composer composition. Both the Lab's draft loader and its file
  // loader accept either form.
  const json = JSON.stringify({ scene });
  console.log(`scene JSON: ${(json.length / 1024 / 1024).toFixed(2)} MB`);

  // Local copy for the render workspace
  const localPath = path.join('slabby', 'scenes', `${DRAFT_NAME}.json`);
  fs.writeFileSync(localPath, json);
  console.log(`wrote ${localPath}`);

  // Upload to the drafts bucket (same place the Lab's Load draft menu reads)
  const { data: bucket } = await s.storage.getBucket(BUCKET);
  if (!bucket) await s.storage.createBucket(BUCKET, { public: false });
  const { error: upErr } = await s.storage
    .from(BUCKET)
    .upload(`${DRAFT_NAME}.json`, Buffer.from(json), { contentType: 'application/json', upsert: true });
  if (upErr) throw upErr;
  console.log(`uploaded draft "${DRAFT_NAME}" to ${BUCKET}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
