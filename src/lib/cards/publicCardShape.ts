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
/**
 * `sold_price` / `sold_note` are the SELLER's private business details. The
 * card detail page is public (and indexed), and these routes run with the
 * service role, so returning them would publish what every card sold for to
 * anyone who opens devtools. The owner still sees both on the authenticated
 * collection endpoint, which is where the sold view reads them from.
 */
const SENSITIVE_CARD_FIELDS = ['user_email', 'sold_price', 'sold_note'] as const

export function stripSensitiveCardFields<T extends Record<string, any>>(card: T): T {
  if (!card || typeof card !== 'object') return card
  const clone = { ...card }
  for (const f of SENSITIVE_CARD_FIELDS) delete (clone as any)[f]
  return clone
}
