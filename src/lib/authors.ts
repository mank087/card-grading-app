/**
 * Blog authors (2026-09-11).
 *
 * Static registry keyed by blog_posts.author_name. Each entry backs an
 * /authors/{slug} page and the Person node in every post's BlogPosting
 * schema. Add a person here, then set author_name on their posts.
 */

import { SITE_URL } from '@/lib/seo/blogSchema'

export interface Author {
  slug: string
  name: string
  /** Shown under the name and used as schema jobTitle. */
  title: string
  /** One paragraph, answer-first. Used as the page summary and meta description source. */
  summary: string
  /** Markdown-free sections rendered as headed prose on the author page. */
  sections: { heading: string; paragraphs: string[]; image?: { src: string; alt: string; caption: string } }[]
  topics: string[]
  facts: string[]
  /** Public profile URLs for schema sameAs. Empty until the owner supplies them. */
  sameAs: string[]
  metaTitle: string
  metaDescription: string
}

export const AUTHORS: Author[] = [
  {
    slug: 'douglas-mankiewicz',
    name: 'Douglas Mankiewicz',
    title: 'Founder, Dynamic Collectibles Management',
    summary:
      'Douglas Mankiewicz is the founder of Dynamic Collectibles Management, the company behind DCM Grading, a card grading and collection platform based in Georgia. A lifelong collector of trading cards, sports memorabilia, comic books and pop-culture collectibles, he spent his career in advertising technology before building DCM Grading so that collectors could grade, label, showcase and sell their cards without mailing them away. He writes about card condition, grading standards, collecting with your family, and the practical side of the hobby.',
    sections: [
      {
        heading: 'A collector first',
        paragraphs: [
          'Doug grew up in a house where eBay deliveries were an event. His father would unwrap each package of autographed rookie cards with the same excitement every time, and that excitement was contagious. Weekends meant card shows, meet and greets, and long tables of binders. He met wrestlers, actors and sports icons along the way, and still has the jersey Joe Montana signed for him in person.',
          'That upbringing shaped how he sees the hobby. Cards were never spreadsheets of resale value. They were stories, players, artists and moments, and the fun was in finding them, holding them and sharing them with people who cared about the same things.',
          'When he became a parent, he wanted his own children to feel that. Opening packs together, sorting a stack of pulls, reading comics on the floor, arguing about which card in a box is the best one. DCM Grading started as a way to make that experience easier to keep, protect and pass on.',
        ],
        image: {
          src: 'https://zyxtqcvwkbpvsjsszbzg.supabase.co/storage/v1/object/public/blog-images/authors/doug-joe-montana-signing.jpg',
          alt: 'A young Doug Mankiewicz watches Joe Montana sign his jersey at a card show signing table',
          caption: 'Doug as a kid, watching Joe Montana sign the jersey he still has today.',
        },
      },
      {
        heading: 'Why he built DCM Grading',
        paragraphs: [
          'Doug spent his professional career in advertising technology, working across internet infrastructure, web development, AI integration, marketing platforms and creative production. He knew what it took to build software that real people use every day, and he watched the grading industry move in a direction that did not match how most collectors actually think.',
          'Traditional grading had become an investment product. Ship your cards away, wait months, pay per card, and hope the number that comes back justifies the cost. That model serves flippers well. It does not serve the collector who wants to protect a card, show its condition clearly, put a label on it that reflects their own collection, and trade it with friends without a middleman.',
          'DCM Grading is his answer. Photograph a card, get a grade in about a minute with four subgrades and a written reason for every deduction, print a slab label in the style you choose, track what your collection is worth, and list a card on eBay in one step. The card never leaves your hands. The grading engine, DCM Optic, applies the same published rubric to every card, every time.',
        ],
      },
    ],
    topics: [
      'How card condition is actually assessed: centering, corners, edges and surface, and what separates a 9 from a 10',
      'Which cards are worth grading and which are better left raw',
      'Collecting with kids and keeping the hobby fun',
      'Sports cards, Pokémon, Magic, Lorcana, One Piece and the sets he is chasing',
      'Slab labels, display and organizing a collection you actually look at',
    ],
    facts: [
      'Founder, Dynamic Collectibles Management, the company behind DCM Grading, Georgia, USA',
      'Collector of trading cards, sports memorabilia, comics and pop-culture collectibles since childhood',
      'Background: advertising technology, web development, AI integration and marketing platforms',
      'Favorite piece: a Joe Montana jersey, signed in person at a card show',
      'Grades cards with DCM Optic, the same engine every DCM member uses',
    ],
    sameAs: [],
    metaTitle: 'Douglas Mankiewicz, Founder of Dynamic Collectibles Management',
    metaDescription:
      'Douglas Mankiewicz founded Dynamic Collectibles Management, the company behind DCM Grading. A lifelong collector of trading cards, sports memorabilia and pop-culture collectibles, he writes about card condition, grading and collecting.',
  },
]

export const DEFAULT_AUTHOR_NAME = 'Douglas Mankiewicz'

export function getAuthorBySlug(slug: string): Author | null {
  return AUTHORS.find((a) => a.slug === slug) ?? null
}

export function getAuthorByName(name: string | null | undefined): Author | null {
  if (!name) return null
  return AUTHORS.find((a) => a.name.toLowerCase() === name.toLowerCase()) ?? null
}

export function authorUrl(author: Author): string {
  return `${SITE_URL}/authors/${author.slug}`
}

export function authorId(author: Author): string {
  return `${authorUrl(author)}#person`
}

/** Person node for schema graphs. */
export function personSchema(author: Author) {
  return {
    '@type': 'Person',
    '@id': authorId(author),
    name: author.name,
    jobTitle: author.title,
    description: author.summary,
    url: authorUrl(author),
    worksFor: { '@id': `${SITE_URL}/#organization` },
    ...(author.sameAs.length ? { sameAs: author.sameAs } : {}),
    ...(authorImage(author) ? { image: authorImage(author) } : {}),
  }
}

/** First section image, used as the Person schema image. */
export function authorImage(author: Author): string | null {
  return author.sections.find((s) => s.image)?.image?.src ?? null
}
