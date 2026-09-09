import { describe, it, expect } from 'vitest'
import {
  getFollowUp24hEmailHtml,
  getFreeCreditsReminderEmailHtml,
  getFreeCreditsReminderEmailSubject,
} from './emailTemplates'

const unsub = 'https://dcmgrading.com/api/unsubscribe/abc123'

describe('free credits reminder email', () => {
  const html = getFreeCreditsReminderEmailHtml(unsub)

  it('sends the reader to grade, never to buy', () => {
    const hrefs = Array.from(html.matchAll(/href="([^"]+)"/g)).map(m => m[1])
    expect(hrefs.some(h => h.startsWith('https://dcmgrading.com/upload'))).toBe(true)
    expect(hrefs.some(h => h.includes('/credits'))).toBe(false)
    expect(hrefs.some(h => h.includes('/card-lovers'))).toBe(false)
    expect(html).not.toMatch(/Grade10|promo|% off/i)
  })

  it('states the offer as two free grades and carries the unsubscribe link', () => {
    expect(getFreeCreditsReminderEmailSubject()).toMatch(/2 free grades/)
    expect(html).toContain('Your 2 free grades are still here')
    expect(html).toContain(unsub)
    expect(html).not.toMatch(/—/)
  })
})

describe('24h follow-up email', () => {
  it('still points its primary buttons at /upload', () => {
    const html = getFollowUp24hEmailHtml(unsub)
    expect(html).toContain('https://dcmgrading.com/upload?utm_source=email&utm_medium=email&utm_campaign=followup_24h&utm_content=hero-cta')
    expect(html).toContain('utm_content=bottom-cta')
  })
})
