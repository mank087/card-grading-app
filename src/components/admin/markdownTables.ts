/**
 * GFM pipe-table helpers for the blog editor.
 *
 * The rich pane (TipTap + tiptap-markdown) can show and edit tables, but it
 * re-serializes them in its own shape: `| a | b |` rows, a plain `| --- |`
 * delimiter row (alignment colons are dropped), and an HTML <table> for
 * anything with spans or multi-paragraph cells. The public blog renders
 * markdown without raw HTML, so a table that does not come back out of the
 * rich pane as the same pipe table must not be edited there.
 *
 * tablesSurviveRoundTrip compares the tables in the source markdown with the
 * tables in what the rich pane would write back, ignoring padding and
 * backslash escapes.
 */

const ROW = /^\s*\|.*\|\s*$/
const DELIMITER = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/

// Backslash escapes render as the bare character (the rich pane writes `\-46%`
// for `-46%`), so they are not a change. `\|` stays escaped: it is part of
// the cell, not a column break.
const unescape = (cell: string) => cell.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]^_`{}~])/g, '$1')

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => unescape(c.trim()))
}

/** Each GFM table in the markdown, normalized for padding only. */
export function markdownTables(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/)
  const tables: string[] = []
  for (let i = 0; i < lines.length - 1; i++) {
    if (!ROW.test(lines[i]) || !DELIMITER.test(lines[i + 1])) continue
    const rows: string[] = []
    let j = i
    while (j < lines.length && ROW.test(lines[j])) {
      const row = cells(lines[j])
      // Keep alignment colons, collapse dash runs: `:---:` stays distinct from `---`.
      rows.push((j === i + 1 ? row.map(c => c.replace(/-+/, '-')) : row).join(' | '))
      j++
    }
    tables.push(rows.join('\n'))
    i = j - 1
  }
  return tables
}

export function hasMarkdownTable(markdown: string): boolean {
  return markdownTables(markdown).length > 0
}

/** True when every table in `source` comes back unchanged in `roundTripped`. */
export function tablesSurviveRoundTrip(source: string, roundTripped: string): boolean {
  const before = markdownTables(source)
  if (!before.length) return true
  if (/<table[\s>]/i.test(roundTripped) && !/<table[\s>]/i.test(source)) return false
  const after = markdownTables(roundTripped)
  return before.length === after.length && before.every((t, i) => t === after[i])
}
