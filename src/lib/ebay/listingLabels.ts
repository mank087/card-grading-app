/**
 * Human labels for the raw enum tokens eBay hands back.
 *
 * `status` and `duration` come off the API (and out of our own columns) as
 * things like `Days_10` or `pending`, and several surfaces printed them at the
 * seller verbatim — including values no mapping covers, because eBay adds them
 * without asking. One fallback, used everywhere, so a new token degrades to
 * something readable instead of leaking an identifier into the UI.
 */

/** 'Days_21' → '21 days'; 'SomeNewValue' → 'Some New Value'; '' → '—'. */
export function humanizeEnum(raw: string | null | undefined): string {
  const value = (raw ?? '').trim();
  if (!value) return '—';
  const days = /^days[_-]?(\d+)$/i.exec(value);
  if (days) return `${days[1]} days`;
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase());
}
