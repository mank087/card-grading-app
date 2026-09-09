import { describe, expect, it } from 'vitest'
import { completeMetadata, SHARE_IMAGE } from './completeMetadata'

describe('complete social metadata', () => {
  it('preserves canonical and private robots while supplying a landscape share image', () => {
    const result = completeMetadata({ title: { absolute: 'Card — condition' }, robots: { index: false }, alternates: { canonical: 'https://dcmgrading.com/example' } })
    expect(result.title).toEqual({ absolute: 'Card: condition' })
    expect(result.robots).toEqual({ index: false })
    expect(result.alternates?.canonical).toBe('https://dcmgrading.com/example')
    expect(result.openGraph).toMatchObject({ locale: 'en_US', images: [SHARE_IMAGE] })
    expect(result.twitter).toMatchObject({ creator: '@DCM_Grading', card: 'summary_large_image' })
  })
  it('preserves article fields and real article images while replacing only the square default', () => {
    const result = completeMetadata({ title: 'Article', openGraph: { type: 'article', publishedTime: '2026-09-09', images: ['https://dcmgrading.com/blog/photo.png'] }, twitter: { card: 'summary', images: ['/DCM-logo.png'] } })
    expect(result.openGraph).toMatchObject({ type: 'article', publishedTime: '2026-09-09', images: ['https://dcmgrading.com/blog/photo.png'] })
    expect(result.twitter).toMatchObject({ images: [SHARE_IMAGE], card: 'summary_large_image' })
  })
})
