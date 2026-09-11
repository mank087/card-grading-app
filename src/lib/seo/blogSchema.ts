/**
 * Structured-data helpers for the blog (2026-09-11).
 * Pure functions, no React, safe on the server.
 */

import type { BlogFaqItem, BlogPost } from '@/types/blog'

export const SITE_URL = 'https://dcmgrading.com'

export interface Crumb {
  name: string
  url: string
}

export function breadcrumbList(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  }
}

/** Blog index or category page: the posts shown on this page, in order. */
export function blogItemList(posts: Pick<BlogPost, 'slug' | 'title'>[], pageUrl: string, name: string, description?: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': pageUrl,
    name,
    ...(description ? { description } : {}),
    url: pageUrl,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      numberOfItems: posts.length,
      itemListElement: posts.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/blog/${p.slug}`,
        name: p.title,
      })),
    },
  }
}

export function faqPage(faq: BlogFaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }
}

/** Rough word count of a markdown body: strips code fences, links and tags. */
export function markdownWordCount(md: string): number {
  const text = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_>|-]+/g, ' ')
  return text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length
}

/** Shared slug rule for heading anchors: must match BlogPostContent. */
export function headingId(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
}

export interface TocItem {
  id: string
  text: string
  level: number
}

/** Extract h2/h3 headings from markdown, ignoring code fences. */
export function extractHeadings(md: string): TocItem[] {
  const noCode = md.replace(/```[\s\S]*?```/g, '')
  const re = /^\s*(#{2,3})\s+(.+?)\s*#*\s*$/gm
  const out: TocItem[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(noCode))) {
    const text = m[2].replace(/[*_`]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    out.push({ id: headingId(text), text, level: m[1].length })
  }
  return out
}

/** Sanitize an incoming FAQ array from the admin editor. */
export function sanitizeFaq(input: unknown, max = 10): BlogFaqItem[] {
  if (!Array.isArray(input)) return []
  const out: BlogFaqItem[] = []
  for (const item of input) {
    const q = typeof item?.question === 'string' ? item.question.trim() : ''
    const a = typeof item?.answer === 'string' ? item.answer.trim() : ''
    if (q && a) out.push({ question: q.slice(0, 300), answer: a.slice(0, 2000) })
    if (out.length >= max) break
  }
  return out
}
