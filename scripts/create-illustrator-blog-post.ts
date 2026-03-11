/**
 * Create Blog Post: Logan Paul's Pikachu Illustrator Card
 * Run with: npx ts-node scripts/create-illustrator-blog-post.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const content = `The most expensive trading card in history just changed hands. On February 16, 2026, Logan Paul's 1998 Pikachu Illustrator — graded PSA 10 Gem Mint — sold for **$16,492,000** at a Goldin Auctions live event, shattering the previous record of $12.9 million held by a 2007–08 Michael Jordan/Kobe Bryant autograph card.

We ran the card through DCM Optic to see how our AI grading compares to PSA's assessment — and the results tell an interesting story about what "perfect" really means.

## What Is the Pikachu Illustrator Card?

The Pikachu Illustrator is not a card you could ever pull from a booster pack. In late 1997, Japan's CoroCoro Comic magazine launched the "Pokémon Card Game Illust Artist Contest," inviting readers to draw their own Pokémon card designs and mail them in. Winners received a card that exists nowhere else in the hobby: a promo featuring Pikachu holding a paintbrush, credited not to a trainer but to an *illustrator*.

Three contests were held across 1997–1998. The first awarded 23 copies; the second and third awarded 8 each. In total, **only 39 Pikachu Illustrator cards were ever produced**. They were never sold in stores, never included in sets, and never reprinted.

The card itself is unlike any other in the Pokémon TCG. Where a normal card says "Trainer" or shows a Pokémon type, this one reads **"ILLUSTRATOR"** — the only card in history to carry that designation. The artwork, by original Pokémon card artist Atsuko Nishida, shows Pikachu mid-sketch with a painter's beret and brush, a tribute to the young fans whose artwork earned them one of collecting's ultimate prizes.

Of the 39 copies distributed, an estimated 20–25 are believed to still exist. Many are in lower grades or ungraded. Only one has ever achieved a **PSA 10 Gem Mint** rating — and that's the card Logan Paul just sold.

## Logan Paul's Journey with the Card

Paul acquired the PSA 10 Illustrator in July 2021 through a private deal: he traded a PSA 9 copy (valued at $1.275 million) plus $4 million in cash, putting his total investment at approximately **$5.275 million**.

He didn't keep it locked away. Paul had the PSA slab fitted with an $80,000 custom gold chain and wore the card around his neck at **WrestleMania 38** in 2022, generating massive media coverage and introducing the hobby's rarest card to millions who had never heard of it.

The Goldin auction ran for 42 days before a dramatic live-streamed finale. After 97 total bids and an extended bidding session, the hammer fell at $16.49 million — a return of roughly **3x his original investment** in under five years. A Guinness World Records official was on-site to confirm the new record.

## The Buyer

**A.J. Scaramucci**, founder of Solari Capital and son of former White House communications director Anthony Scaramucci, placed the winning bid. When asked about his plans, Scaramucci revealed he's on what he calls a "planetary treasure hunt" — assembling a collection of the world's rarest objects, including T-Rex fossils and an ultra-rare copy of the Declaration of Independence. The Pikachu Illustrator joins that pursuit.

## How DCM Graded It: PSA Slab vs. Raw Card

We ran the Pikachu Illustrator through DCM Optic twice — once [in the PSA slab](https://www.dcmgrading.com/pokemon/73df6a20-0abc-4f2b-a52c-e95672b0968f) and once using [images of the raw card without the graded label](https://www.dcmgrading.com/pokemon/842af127-3d32-4e6a-b2a6-ec285abcda27).

### In the PSA Slab — DCM 10

When graded through the case, DCM Optic returned a **10/10 Gem Mint**, aligning with PSA's assessment. The AI noted excellent centering, sharp corners, and a card that presents at the highest possible standard — even when evaluated through the plastic of a graded holder.

### Raw Card (No Label) — DCM 9

When the same card was evaluated from raw images — no slab, no PSA label, no grade visible — DCM Optic returned a **9/10 Mint**. The AI described the card as having sharp corners and clean edges, but without the context of a controlled slab environment, it applied slightly more conservative scoring.

### Why the Difference Matters

This one-point gap is actually revealing. It shows that:

1. **The PSA slab preserves condition** — the controlled environment of a graded holder protects against micro-damage that might affect scoring of a raw card's surface or edges.
2. **DCM doesn't defer to labels** — when the PSA 10 label was visible, DCM didn't simply parrot the grade. It evaluated the card's physical attributes and arrived at 10 independently. When the label was removed, it scored what it saw: a card that's extraordinary but shows the faintest signs of handling that a Gem Mint slab would protect against.
3. **A 9 from DCM on a raw vintage card is exceptional** — for a card produced in 1998 and distributed to contest-winning children in Japan, maintaining Mint condition across nearly three decades is remarkable.

The takeaway? Professional grading and proper encapsulation aren't just about authentication — they actively preserve the condition that commands these prices. A PSA 10 Illustrator sold for $16.49 million. A PSA 9 sold for $4 million in 2024. That one-grade difference represents over **$12 million in value**.

## What This Means for the Hobby

The $16.49 million sale isn't just a headline — it's a benchmark that redefines what trading cards can be worth. For context:

- **1952 Topps Mickey Mantle PSA 10** — sold for $12.6 million (2022)
- **2007–08 Jordan/Kobe Dual Auto** — sold for $12.9 million (2025)
- **1998 Pikachu Illustrator PSA 10** — $16.49 million (2026)

Pokémon now holds the all-time record across all trading card categories — sports, TCG, and everything in between. The Illustrator has become the hobby's Mona Lisa: a singular object whose cultural significance, extreme rarity, and perfect preservation create a value that transcends the market.

For collectors at every level, the lesson is clear: **condition is king, rarity is queen, and provenance is the throne they sit on**. Whether you're grading a $5 card or a $5 million card, the fundamentals don't change — centering, corners, edges, and surface tell the story.

---

*Want to see how your cards measure up? [Grade your cards with DCM Optic](https://www.dcmgrading.com) — the same AI technology we used to evaluate the most expensive trading card ever sold.*
`;

async function createPost() {
  // Get the "card-spotlights" category
  const { data: category } = await supabase
    .from('blog_categories')
    .select('id')
    .eq('slug', 'card-spotlights')
    .single();

  // Fall back to "news" if card-spotlights doesn't exist
  let categoryId = category?.id;
  if (!categoryId) {
    const { data: newsCategory } = await supabase
      .from('blog_categories')
      .select('id')
      .eq('slug', 'news')
      .single();
    categoryId = newsCategory?.id;
  }

  const { data: post, error } = await supabase
    .from('blog_posts')
    .insert({
      title: "The $16.49 Million Pikachu: Inside the Most Expensive Trading Card Ever Sold",
      subtitle: "Logan Paul's PSA 10 Illustrator sets a new world record — and we graded it with DCM Optic",
      slug: "pikachu-illustrator-16-million-record-sale",
      excerpt: "Logan Paul's 1998 Pikachu Illustrator — the only PSA 10 in existence — just sold for $16.49 million at Goldin Auctions. We ran the card through DCM Optic to see how our AI grading compares.",
      content,
      category_id: categoryId || null,
      tags: ['pokemon', 'pikachu illustrator', 'record sale', 'logan paul', 'psa 10', 'dcm optic', 'vintage cards'],
      meta_title: "Pikachu Illustrator Sells for $16.49M — DCM Grading Analysis",
      meta_description: "Logan Paul's 1998 Pikachu Illustrator PSA 10 sold for $16.49 million, setting a new world record. See how DCM Optic graded the most expensive trading card ever.",
      status: 'draft',
      author_name: 'DCM Team',
    })
    .select('id, title, slug, status')
    .single();

  if (error) {
    console.error('Error creating post:', error);
    return;
  }

  console.log('Blog post created as draft!');
  console.log('ID:', post.id);
  console.log('Title:', post.title);
  console.log('Slug:', post.slug);
  console.log('Status:', post.status);
  console.log('\nPreview at: /admin/blog/' + post.id + '/edit');
  console.log('Once published: /blog/' + post.slug);
}

createPost();
