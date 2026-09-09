import { describe, it, expect } from 'vitest'
import { emailText, emailUrl } from './emailMarkup'
import { getFirstGradeEducationHtml, getLastChanceEmailHtml, getLastChanceEmailSubject, getSocialProofEmailSubject } from './postGradeEmailTemplates'

describe('subscriber email rendering', () => {
  it('escapes recipient text and rejects non-HTTPS image URLs', () => {
    expect(emailText('<img src=x onerror="alert(1)">')).not.toContain('<img')
    expect(emailUrl('javascript:alert(1)')).toBe('https://dcmgrading.com')
    expect(emailUrl('https://example.com/photo?a=1&b=2')).toContain('&amp;')
  })
  it('renders card data as text rather than markup', () => {
    const html = getFirstGradeEducationHtml({ card_name: '<script>bad</script>', front_image_url: 'https://example.com/" onerror="bad', final_grade: 9, category_slug: 'pokemon', card_id: 'example', centering_score: 9, corners_score: 9, edges_score: 9, surface_score: 9, credits_remaining: 1, unsubscribe_url: 'https://dcmgrading.com/unsubscribe' })
    expect(html).not.toContain('<script>bad</script>')
    expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;')
    expect(html).not.toContain(' onerror="bad')
  })
  it('does not invent a rolling offer deadline or current-week showcase', () => {
    expect(getLastChanceEmailSubject()).not.toMatch(/48 hours|expires/i)
    expect(getLastChanceEmailHtml({unsubscribe_url: 'https://dcmgrading.com/unsubscribe'})).not.toMatch(/48 hours|expires soon/i)
    expect(getSocialProofEmailSubject()).not.toMatch(/this week/i)
  })
})
