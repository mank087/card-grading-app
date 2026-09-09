import { describe, expect, it } from 'vitest'
import { emailPlainText } from './emailMarkup'
import { getWelcomeEmailHtml } from './welcomeEmailTemplate'
import { getFollowUp24hEmailHtml } from './emailTemplates'

describe('email text alternatives and unsubscribe links', () => {
  it('keeps readable paragraphs and actionable links without CSS or markup', () => {
    expect(emailPlainText('<style>body{color:red}</style><p>Hello &amp; welcome</p><p><a href="https://dcmgrading.com/upload?a=1&amp;b=2">Grade a card</a></p>')).toBe('Hello & welcome\nGrade a card (https://dcmgrading.com/upload?a=1&b=2)')
  })
  it('escapes unsubscribe links in both welcome and follow-up templates', () => {
    const url = 'https://dcmgrading.com/unsubscribe?a=1&b=2'
    for (const html of [getWelcomeEmailHtml({ unsubscribeUrl: url }), getFollowUp24hEmailHtml(url)]) {
      expect(html).toContain('href="https://dcmgrading.com/unsubscribe?a=1&amp;b=2"')
      expect(emailPlainText(html)).toContain('Unsubscribe (https://dcmgrading.com/unsubscribe?a=1&b=2)')
    }
  })
})
