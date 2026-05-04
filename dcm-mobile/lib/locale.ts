import { getLocales } from 'expo-localization'

// Device locale — falls back to en-US if expo-localization can't determine
// (rare; happens on some emulators with no locale set).
function deviceLocale(): string {
  try {
    return getLocales()[0]?.languageTag || 'en-US'
  } catch {
    return 'en-US'
  }
}

/**
 * Locale-aware date formatter. Uses the device locale so a user in Germany
 * sees "5. Mai 2026" while a US user sees "May 5, 2026". Use this for
 * timestamps the user owns (created_at, updated_at) — not for things that
 * must be unambiguous to all users (legal cutoff dates, support messages).
 */
export function formatDate(
  input: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
): string {
  if (input == null) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(deviceLocale(), options).format(d)
  } catch {
    return d.toLocaleDateString()
  }
}

/**
 * Locale-aware number formatter (thousands separators, decimal mark).
 * Use for counts, populations, etc. — NOT for currency.
 */
export function formatNumber(n: number, options: Intl.NumberFormatOptions = {}): string {
  try {
    return new Intl.NumberFormat(deviceLocale(), options).format(n)
  } catch {
    return String(n)
  }
}

/**
 * Always renders USD as "$X.YY" regardless of device locale. DCM prices
 * are denominated in USD; auto-converting the symbol/format would imply
 * the user's local currency, which is misleading. Use this everywhere a
 * dollar sign is currently hardcoded.
 */
export function formatUSD(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `$${value.toFixed(2)}`
}
