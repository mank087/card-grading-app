/**
 * Strip fields that must never reach a public card-API response.
 *
 * The card detail/label/pop routes run with the service role (to bypass RLS)
 * and historically spread the whole `cards` row into their JSON, which leaked
 * the owner's email to any viewer. Run every outward card payload through this
 * before returning it. `user_id` is intentionally NOT stripped here — the card
 * detail client still uses it for owner-only UI; that removal is a separate
 * change tied to the ownership-check refactor.
 */
const SENSITIVE_CARD_FIELDS = ['user_email'] as const

export function stripSensitiveCardFields<T extends Record<string, any>>(card: T): T {
  if (!card || typeof card !== 'object') return card
  const clone = { ...card }
  for (const f of SENSITIVE_CARD_FIELDS) delete (clone as any)[f]
  return clone
}
