/** Encode recipient/card data before inserting it into email HTML. */
export function emailText(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
}

export function emailUrl(value: string): string {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return 'https://dcmgrading.com'
    return emailText(url.href)
  } catch {
    return 'https://dcmgrading.com'
  }
}

/** Plain-text alternative for our generated templates; retain actionable links. */
export function emailPlainText(html: string): string {
  return html
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>|<\/(?:p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39|#x27);/gi, entity => ({
      '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ', '&#39;': "'", '&#x27;': "'",
    }[entity.toLowerCase()] ?? entity))
    .replace(/[\t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}
