import { describe, expect, it } from 'vitest'
import { blogItemList, breadcrumbList, extractHeadings, faqPage, headingId, markdownWordCount, sanitizeFaq } from './blogSchema'

describe('extractHeadings', () => {
  it('returns h2 and h3 with ids matching the content renderer', () => {
    const md = '# Title\n\n## First Section\ntext\n### Sub *point*\n\n```\n## not a heading\n```\n\n## Second: Section?'
    expect(extractHeadings(md)).toEqual([
      { id: 'first-section', text: 'First Section', level: 2 },
      { id: 'sub-point', text: 'Sub point', level: 3 },
      { id: 'second-section', text: 'Second: Section?', level: 2 },
    ])
    expect(headingId('Second: Section?')).toBe('second-section')
  })
})

describe('markdownWordCount', () => {
  it('counts prose, not markup', () => {
    const md = '## Heading\n\nSome **bold** words and a [link](https://x.y) plus ![img](a.png).\n\n```js\nconst x = 1\n```'
    expect(markdownWordCount(md)).toBe(8)
  })
})

describe('sanitizeFaq', () => {
  it('drops incomplete rows, trims, and caps length and count', () => {
    const input = [
      { question: ' Q1 ', answer: ' A1 ' },
      { question: 'no answer' },
      { answer: 'no question' },
      'garbage',
      ...Array.from({ length: 12 }, (_, i) => ({ question: `Q${i}`, answer: 'A' })),
    ]
    const out = sanitizeFaq(input)
    expect(out[0]).toEqual({ question: 'Q1', answer: 'A1' })
    expect(out.length).toBe(10)
    expect(sanitizeFaq('nope')).toEqual([])
  })
})

describe('schema builders', () => {
  it('numbers breadcrumb and list positions from 1', () => {
    const b = breadcrumbList([{ name: 'Home', url: 'https://d' }, { name: 'Blog', url: 'https://d/blog' }])
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2])
    const l = blogItemList([{ slug: 'a', title: 'A' }, { slug: 'b', title: 'B' }], 'https://d/blog', 'Blog')
    expect(l.mainEntity.numberOfItems).toBe(2)
    expect(l.mainEntity.itemListElement[1]).toMatchObject({ position: 2, url: 'https://dcmgrading.com/blog/b' })
    const f = faqPage([{ question: 'Q', answer: 'A' }])
    expect(f.mainEntity[0]).toMatchObject({ '@type': 'Question', name: 'Q' })
  })
})
