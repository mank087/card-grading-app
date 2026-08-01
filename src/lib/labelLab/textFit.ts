/**
 * Shrink-then-wrap text fitting for the slab label. Never truncates.
 *
 * Shared by the @react-pdf lab renderer and the mockup generator, for the same
 * reason the band geometry is shared: two implementations of the same fitting
 * meant the lab happily overflowed on cards the mockups handled.
 *
 * Measured against ~8,000 real graded cards:
 *
 *   name     median 12  p90 17  p99 36  max 119   (an 8-player Leaf Trinity)
 *   context  median 26  p90 40  p99 55  max 128   (a Japanese set line with a
 *                                                  parenthetical explaining the
 *                                                  English name is not printed)
 *
 * At the floor this OVERFLOWS rather than dropping characters. For a label
 * whose job is identification, a slightly cramped line beats one silently
 * missing four of the eight players on the card.
 */

/**
 * Width of a string at 1em, approximated per character class.
 *
 * A flat "0.55em per char" is wrong by ~40% on strings that are mostly capitals
 * or mostly narrow letters, and the names that break the layout are exactly the
 * unusual ones. CJK is treated as full-width.
 */
export function textWidthEm(t: string): number {
  let w = 0
  for (const ch of t) {
    if (/[　-鿿＀-￯]/.test(ch)) w += 1.0
    else if (/[MW@%]/.test(ch)) w += 0.90
    else if (/[mw]/.test(ch)) w += 0.85
    else if (/[A-Z0-9#&]/.test(ch)) w += 0.64
    else if (/[iljtfrI1.,'’!\[\]()|]/.test(ch)) w += 0.30
    else if (ch === ' ') w += 0.28
    else w += 0.53
  }
  return w
}

/**
 * Rendered width including letter-spacing.
 *
 * Leaving tracking out is not a rounding error: the context line is caps with
 * 4pt tracking, so a 64-character row gains 256 units — a quarter of the box.
 * That is precisely how a long set name ended up running under the grade chip.
 */
export function widthOf(t: string, size: number, tracking: number): number {
  return textWidthEm(t) * size + Math.max(0, t.length - 1) * tracking
}

/**
 * The whole point is that nothing is dropped, so prove it. A dropped backslash
 * once turned the word split into /s+/ — splitting on the LETTER "s" — and
 * "Ted Williams" rendered as "Ted William" with no error anywhere.
 */
function assertLossless(original: string, rows: string[]): void {
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim()
  if (norm(rows.join(' ')) !== norm(original)) {
    throw new Error(
      `Text wrapping lost characters.\n  in:  ${JSON.stringify(original)}\n  out: ${JSON.stringify(rows.join(' '))}`
    )
  }
}

export interface FitResult { size: number; rows: string[] }

export function fitLines(
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  maxLines: number,
  tracking: (size: number) => number = () => 0
): FitResult {
  const words = String(text ?? '').split(/\s+/).filter(Boolean)
  if (!words.length) return { size: maxSize, rows: [] }

  const wrapAt = (size: number) => {
    const tr = tracking(size)
    const rows: string[] = []
    let cur = ''
    for (const word of words) {
      const next = cur ? cur + ' ' + word : word
      if (widthOf(next, size, tr) <= maxWidth || !cur) cur = next
      else { rows.push(cur); cur = word }
    }
    if (cur) rows.push(cur)
    return rows
  }

  for (let lines = 1; lines <= maxLines; lines++) {
    for (let size = maxSize; size >= minSize; size -= 1) {
      const rows = wrapAt(size)
      if (rows.length <= lines && rows.every(r => widthOf(r, size, tracking(size)) <= maxWidth)) {
        assertLossless(text, rows)
        return { size, rows }
      }
    }
  }
  const rows = wrapAt(minSize)
  assertLossless(text, rows)
  return { size: minSize, rows }
}
