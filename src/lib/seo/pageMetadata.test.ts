import { describe, expect, it } from 'vitest'
import { blogPageNumber, blogPagePath } from './blogPagination'
import { privatePageMetadata, publicPageMetadata } from './pageMetadata'

describe('blog indexing URLs', () => {
  it('keeps later pages self-canonical while page one has a clean URL', () => {
    expect(blogPagePath('/blog', 1)).toBe('/blog')
    expect(blogPagePath('/blog', 2)).toBe('/blog?page=2')
    expect(blogPagePath('/blog/category/pokemon', 3)).toBe('/blog/category/pokemon?page=3')
  })
  it('normalizes invalid input before computing database offsets', () => {
    for (const value of [undefined, '', '0', '-1', 'NaN', '2garbage', '1.5', '9999999999999999999']) expect(blogPageNumber(value)).toBe(1)
    expect(blogPageNumber('12')).toBe(12)
  })
})
describe('route metadata policy', () => {
  it('overrides both general and inherited Google indexing on utility pages', () => {
    expect(privatePageMetadata('Account').robots).toEqual({ index: false, follow: false, googleBot: { index: false, follow: false } })
  })
  it('uses the same public URL and description for search and social previews', () => {
    const metadata = publicPageMetadata('/sports-database', 'Sports Card Database', 'Browse sports cards.')
    expect(metadata.alternates?.canonical).toBe('https://dcmgrading.com/sports-database')
    expect(metadata.openGraph).toMatchObject({ url: 'https://dcmgrading.com/sports-database', description: metadata.description })
    expect(metadata.twitter).toMatchObject({ title: 'Sports Card Database', description: metadata.description })
  })
})
