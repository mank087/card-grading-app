/**
 * eBay's links policy, client side.
 *
 * eBay forbids links AND bare web addresses anywhere in a listing, even
 * non-clickable ones. The server enforces it for real: the bulk item PATCH
 * refuses a TITLE that carries one (there is nothing to repair in 80
 * characters) and REPAIRS a description by stripping them.
 *
 * This is the title half of `containsLinkOrUrl` in
 * src/lib/ebay/listingDescription.ts, ported so the row editor can say "that
 * won't be accepted" before spending a round trip on a 400. The patterns are
 * copied verbatim from that file; what is deliberately NOT ported is the
 * <img src> masking, which exists so a description's own photo URLs survive —
 * a title has no HTML in it, so there is nothing to protect.
 *
 * The server remains the authority. A miss here costs a 400 with the server's
 * own sentence, which the sheet renders inline.
 */

/**
 * Bare domains, with or without a path. The TLD list is an ALLOW-list on
 * purpose — a generic `\w+\.\w+` would eat "9.5" and "Mr. Smith" out of an
 * ordinary card title.
 */
const BARE_DOMAIN_PATTERN =
  /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|net|org|io|co|us|uk|ca|au|de|jp|shop|store|gg|tv|xyz|info|biz|dev|app|me|online|site|link)\b(?:\/[^\s"'<>]*)?/gi

/** Email addresses are a contact route off eBay, forbidden the same way. */
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g

/** Does this text carry a link or a web address the links policy forbids? */
export function containsLinkOrUrl(text: string | null | undefined): boolean {
  if (!text) return false
  // Both patterns are /g, so lastIndex survives a call and the next .test()
  // would resume mid-string and answer false for the same input.
  EMAIL_PATTERN.lastIndex = 0
  BARE_DOMAIN_PATTERN.lastIndex = 0
  return (
    /<a\b/i.test(text) ||
    /\bhttps?:\/\//i.test(text) ||
    /\bwww\./i.test(text) ||
    EMAIL_PATTERN.test(text) ||
    BARE_DOMAIN_PATTERN.test(text)
  )
}
