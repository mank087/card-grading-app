import { completeMetadata } from './completeMetadata'
import type { Metadata } from 'next'

export function publicPageMetadata(path: string, title: string, description: string): Metadata {
  const url = `https://dcmgrading.com${path}`
  return completeMetadata({
    title, description, alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: 'DCM Grading', images: ['/DCM-logo.png'] },
    twitter: { card: 'summary', title, description, images: ['/DCM-logo.png'] },
  })
}

export function privatePageMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false, googleBot: { index: false, follow: false } } }
}

/** Never expose a private card's identity through public metadata. */
export function privateCardMetadata(): Metadata {
  const title = 'Private Card | DCM Grading'
  const description = 'This card report is private. Sign in with an authorized account to view it.'
  return {
    ...privatePageMetadata(title), title: { absolute: title }, description,
    openGraph: { title, description, images: ['/DCM-logo.png'] },
    twitter: { card: 'summary', title, description, images: ['/DCM-logo.png'] },
  }
}
