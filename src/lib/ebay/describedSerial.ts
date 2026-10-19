/**
 * Which card a listing description talks about. The standard layout prints
 * "Serial: NNNNNN"; a description whose serial is not the card's own (or its
 * org serial) was rendered for another card (a finished description saved as
 * the account template, Oct 19 2026). Pure, so the admin repair tool's test
 * does not have to load the eBay auth and Trading API modules.
 */
export function describedSerial(descriptionHtml: string): string | null {
  const m = String(descriptionHtml || '')
    .replace(/<[^>]+>/g, ' ')
    .match(/Serial:\s*([A-Za-z0-9-]{4,})/);
  return m ? m[1] : null;
}

export function describesAnotherCard(
  descriptionHtml: string,
  card: { serial?: string | null; org_serial_display?: string | null }
): boolean {
  const s = describedSerial(descriptionHtml);
  if (!s) return false;
  return s !== String(card.serial || '') && s !== String(card.org_serial_display || '');
}
