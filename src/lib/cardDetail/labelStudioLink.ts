/**
 * The Label Studio handoff (plan gap G3).
 *
 * The EXISTING contract is `/labels?card=<SERIAL>` — a serial, not a card id
 * (`LabelStudioClient.tsx:2979-2986` matches `c.serial === preselectedSerial`).
 * That is kept exactly. Phase 2 adds three OPTIONAL parameters:
 *
 *   holder   'slab' | 'toploader' | 'onetouch' — which holder the reader was
 *            looking at. APPLIED by the five-step wizard at /labels, which has
 *            a Holder step to preselect (LabelWizard.tsx, SET_HOLDER). NOT
 *            applied by the classic studio at /labels/classic, whose gallery
 *            renders every LABEL_TYPE at once so there is nowhere to put it.
 *   style    the label style id. Read but deliberately NOT applied anywhere:
 *            the studio's style is the signed-in account's own preference and
 *            its style step WRITES that preference, so honouring an override
 *            from a query string would silently change what every other card
 *            prints. It travels so the link is self-describing.
 *   return   where a "Back to card" link should go.
 *
 * `return` is the only one that could be abused, so it is validated here and
 * nowhere else: a same-origin, category-scoped card path and nothing else. No
 * protocol, no host, no protocol-relative `//evil`, no query, no fragment.
 * Anything that does not match is dropped silently.
 */

export const CARD_RETURN_PATH_RE =
  /^\/(pokemon|sports|mtg|lorcana|onepiece|yugioh|starwars|other)\/[0-9a-f-]{36}$/;

export type LabelStudioHolder = 'slab' | 'toploader' | 'onetouch';

const HOLDERS: readonly string[] = ['slab', 'toploader', 'onetouch'];

/**
 * Is this a same-origin card path we are willing to send a reader back to?
 *
 * Deliberately strict. It must start with a single slash, name one of the
 * eight categories, and end with a 36-character uuid-shaped id.
 */
export function isValidCardReturnPath(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return false;
  // `//host` and `/\host` are protocol-relative URLs, not paths.
  if (value.startsWith('//') || value.startsWith('/\\')) return false;
  return CARD_RETURN_PATH_RE.test(value);
}

/** The validated path, or null. Use this at the reading end. */
export function readCardReturnPath(value: string | null | undefined): string | null {
  return isValidCardReturnPath(value) ? (value as string) : null;
}

/** A holder id from a query string, or null. */
export function readHolderParam(value: string | null | undefined): LabelStudioHolder | null {
  return typeof value === 'string' && HOLDERS.includes(value)
    ? (value as LabelStudioHolder)
    : null;
}

export interface LabelStudioLinkOptions {
  holder?: LabelStudioHolder | null;
  style?: string | null;
  /** Where "Back to card" goes. Dropped unless it passes the validator. */
  returnPath?: string | null;
}

/**
 * `/labels?card=<serial>` plus whichever optional params are supplied.
 * With no options this is byte-for-byte the link the app already builds.
 */
export function buildLabelStudioHref(
  serial: string | null | undefined,
  options: LabelStudioLinkOptions = {},
): string {
  if (!serial) return '/labels';
  const params = new URLSearchParams({ card: serial });
  if (options.holder && HOLDERS.includes(options.holder)) params.set('holder', options.holder);
  if (options.style) params.set('style', options.style);
  const back = readCardReturnPath(options.returnPath);
  if (back) params.set('return', back);
  return `/labels?${params.toString()}`;
}
