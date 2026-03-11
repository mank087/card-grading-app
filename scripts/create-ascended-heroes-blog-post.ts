import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createPost() {
  const { data: category } = await supabase
    .from('blog_categories')
    .select('id')
    .eq('slug', 'card-spotlights')
    .single();

  if (!category) {
    console.error('Could not find "card-spotlights" category');
    process.exit(1);
  }

  const content = `Pokemon TCG just dropped its biggest English expansion ever — and DCM Grading is ready for it.

## The Largest Pokemon Set Ever Printed

Ascended Heroes landed on January 30, 2026, and it's a record-breaker. With **295 total cards** (217 base + 78 secret rares), it surpasses Fusion Strike as the largest English Pokemon TCG expansion ever released. Part of the Mega Evolution series and themed around Pokemon Legends: Z-A, it brings back Mega Evolution as a core mechanic while pairing iconic trainers with their signature Pokemon.

The set carries the first-ever "J" regulation mark, signaling a new competitive rotation cycle and what many collectors see as the capstone of the Scarlet & Violet era.

## Full Arts and Chase Cards

This set is stacked. The secret rare pool spans four tiers of collectible artwork, and the top-end cards are commanding serious prices.

### Special Illustration Rares (22 Cards)

The crown jewels. These feature extended, immersive artwork on Pokemon ex and Supporter cards. The standouts:

- **Mega Gengar ex (#284)** — The #1 chase card at ~$830 raw. A chaotic, ghastly rendition by Taiga Kasai that has collectors scrambling. PSA 10 copies are pushing past $5,000.
- **Mega Charizard Y ex (#294)** — The gold Mega Hyper Rare, sitting at ~$638 raw.
- **Pikachu ex (#276)** — Because it's always Pikachu. ~$516 raw, with PSA 10 copies around $2,000.
- **Mega Dragonite ex (#290)** — Fan-favorite Mega debut at ~$516 raw.
- **Team Rocket's Mewtwo ex (#281)** — Illustrated by Mitsuhiro Arita, featuring Mewtwo looming over Giovanni. ~$336 raw.
- **Lillie's Clefairy ex (#280)** and **N's Zoroark ex (#286)** round out the trainer-themed SIRs.

### Mega Attack Rares — A Brand New Rarity

Ascended Heroes debuts an entirely new card classification: **Mega Attack Rares**. Seven cards rendered in a bold pop-art style with the highlight attack written in large Japanese katakana across the foreground. Mega Gengar ex, Mega Dragonite ex, and Mega Diancie ex are the highlights. These slot between Illustration Rares and SIRs in pull difficulty.

### Illustration Rares (33 Cards)

Extended artwork on individual Pokemon. Psyduck (#226) leads the pack at ~$83 — proof that you don't need to be a legendary to be valuable. Cynthia's Spiritomb, Team Rocket's Mimikyu, and Iono's Wattrel are collector favorites.

## Trainer's Pokemon Theme

A defining feature of Ascended Heroes is the trainer-Pokemon pairing. Steven's Metagross, Marnie's Grimmsnarl, Iono's Bellibolt — the set reads like a greatest-hits roster of fan-favorite characters matched with their partner Pokemon. Team Rocket gets multiple entries too, including Kangaskhan ex, Mimikyu, and Dugtrio.

## DCM Grading Is Ready

Our internal Pokemon card database already contains **all 295 Ascended Heroes cards**, imported and indexed for instant identification. When you submit a card from this set, DCM Optic cross-references the AI's visual identification against our verified database — matching by set code, collector number, and card name to confirm exact identification with high confidence.

This means your Mega Gengar ex SIR gets properly identified as card #284 from ASC, not confused with a regular Gengar from a different set. Accurate identification feeds directly into accurate grading.

## Real-Time Market Values

Every graded card on DCM includes estimated market pricing powered by the **PriceCharting API**. For Ascended Heroes cards, this means you can see what your specific card is worth at each grade tier — raw, PSA 7 through PSA 10, and DCM's own estimated value based on your grade.

Market values update automatically, so as Ascended Heroes prices settle from their initial release spike, your card's estimated value stays current. Whether you're deciding to hold, sell, or submit to a professional grading company, you have real pricing data right on your card's detail page.

## The Bottom Line

Ascended Heroes is the kind of set that moves the hobby forward — a record-setting card count, a new rarity tier, and a chase card pool deep enough to keep collectors cracking packs for months. The Mega Gengar ex SIR is already one of the most valuable modern Pokemon cards printed.

Grade your Ascended Heroes pulls at [dcmgrading.com](https://dcmgrading.com) and see exactly what they're worth.`;

  const { data: post, error } = await supabase
    .from('blog_posts')
    .insert({
      title: 'Ascended Heroes Is Here: The Biggest Pokemon Set Ever, and DCM Is Ready',
      subtitle: '295 cards, a new rarity tier, and Mega Gengar leading the chase',
      slug: 'pokemon-ascended-heroes-set-guide-dcm-grading',
      excerpt: 'Pokemon TCG Ascended Heroes is the largest English expansion ever with 295 cards, a new Mega Attack Rare rarity, and chase cards like Mega Gengar ex SIR commanding $830+. DCM Grading has all 295 cards in its database for instant identification and real-time market pricing.',
      content,
      category_id: category.id,
      tags: ['pokemon', 'ascended heroes', 'mega evolution', 'full art', 'special illustration rare', 'market pricing', 'new set', 'dcm optic'],
      meta_title: 'Pokemon Ascended Heroes Set Guide: Full Arts, Chase Cards & DCM Grading | DCM Grading',
      meta_description: 'Pokemon Ascended Heroes is the largest English TCG set ever with 295 cards. See the top chase cards, full art breakdown, and how DCM Grading identifies and prices every card.',
      status: 'draft',
      author_name: 'DCM Team',
    })
    .select('id, title, slug, status')
    .single();

  if (error) {
    console.error('Error creating post:', error);
    process.exit(1);
  }

  console.log('Blog post created successfully!');
  console.log('  ID:', post.id);
  console.log('  Title:', post.title);
  console.log('  Slug:', post.slug);
  console.log('  Status:', post.status);
  console.log('  Edit at: /admin/blog/' + post.id + '/edit');
}

createPost().catch(console.error);
