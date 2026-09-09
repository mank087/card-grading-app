import type { Metadata } from 'next'
export const SHARE_IMAGE = { url: '/opengraph-image', width: 1200, height: 630, alt: 'DCM Grading: card grades, condition reports and Heritage labels' }
export const cleanMetaText = (value: string) => value.replace(/\s*[—–]\s*/g, ': ').replace(/\s+/g, ' ').trim()

function cleanTitle(value: Metadata['title']): Exclude<Metadata['title'], null> {
  if (!value) return undefined
  if (typeof value === 'string') return cleanMetaText(value)
  return Object.fromEntries(Object.entries(value).map(([key, text]) => [key, typeof text === 'string' ? cleanMetaText(text) : text])) as Exclude<Metadata['title'], string | null | undefined>
}

/** Explicit defaults are required because Next replaces nested social metadata. */
export function completeMetadata(metadata: Metadata): Metadata {
  const title = cleanTitle(metadata.title)
  const description = metadata.description ? cleanMetaText(metadata.description) : metadata.description
  const graph = metadata.openGraph
  const twitter = metadata.twitter
  // Preserve article/product fields and custom images, replacing only the old square logo.
  const images = (value: unknown): NonNullable<NonNullable<Metadata['openGraph']>['images']> => {
    if (!value) return [SHARE_IMAGE]
    const list: unknown[] = Array.isArray(value) ? value : [value]
    return list.map(item => {
      const url = typeof item === 'string' ? item : item && typeof item === 'object' && 'url' in item ? item.url : undefined
      return typeof url === 'string' && /(?:^|\/)DCM-logo\.png$/.test(url) ? SHARE_IMAGE : item
    }) as NonNullable<NonNullable<Metadata['openGraph']>['images']>
  }
  return {
    ...metadata, title, description,
    openGraph: { ...(graph ?? { type: 'website' }), siteName: graph?.siteName ?? 'DCM Grading', locale: graph?.locale ?? 'en_US',
      title: cleanTitle(graph?.title ?? title),
      description: graph?.description ? cleanMetaText(graph.description) : description ?? undefined,
      images: images(graph?.images),
    },
    twitter: { card: 'summary_large_image', creator: twitter?.creator ?? '@DCM_Grading',
      site: twitter?.site, creatorId: twitter?.creatorId, siteId: twitter?.siteId,
      title: cleanTitle(twitter?.title ?? title),
      description: twitter?.description ? cleanMetaText(twitter.description) : description ?? undefined,
      images: images(twitter?.images),
    },
  }
}
