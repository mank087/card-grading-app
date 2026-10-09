import { describe, expect, it } from 'vitest'
import { hasMarkdownTable, markdownTables, tablesSurviveRoundTrip } from './markdownTables'

const SOURCE = `Intro.

| Card | DCM sold | vs raw |
|---|---|---|
| Arceus V | **$15.00** | +348% |
| Pikachu | **$100.00** | -23% |

Outro.`

describe('markdownTables', () => {
  it('finds a table and normalizes padding', () => {
    expect(markdownTables(SOURCE)).toEqual(['Card | DCM sold | vs raw\n- | - | -\nArceus V | **$15.00** | +348%\nPikachu | **$100.00** | -23%'])
    expect(hasMarkdownTable('no | table here')).toBe(false)
  })

  it('treats the rich pane output (padded, --- delimiter) as the same table', () => {
    const rich = SOURCE.replace('|---|---|---|', '| --- | --- | --- |').replace('| Arceus V |', '|  Arceus V  |')
    expect(tablesSurviveRoundTrip(SOURCE, rich)).toBe(true)
  })

  it('refuses when alignment would be lost', () => {
    const aligned = SOURCE.replace('|---|---|---|', '|---|:---:|---:|')
    expect(tablesSurviveRoundTrip(aligned, SOURCE)).toBe(false)
  })

  it('refuses when a table comes back as HTML or goes missing', () => {
    expect(tablesSurviveRoundTrip(SOURCE, 'Intro.\n\n<table><tr><td>x</td></tr></table>')).toBe(false)
    expect(tablesSurviveRoundTrip(SOURCE, 'Intro.\n\nOutro.')).toBe(false)
  })

  it('accepts the backslash escapes the rich pane adds', () => {
    expect(tablesSurviveRoundTrip(SOURCE, SOURCE.replace('-23%', '\\-23%'))).toBe(true)
  })

  it('refuses when cell text changes', () => {
    expect(tablesSurviveRoundTrip(SOURCE, SOURCE.replace('+348%', '+349%'))).toBe(false)
  })

  it('does not split a cell on an escaped pipe', () => {
    const piped = SOURCE.replace('Arceus V', 'A \\| B')
    expect(markdownTables(piped)[0].split('\n')[2]).toBe('A \\| B | **$15.00** | +348%')
  })

  it('passes markdown with no tables', () => {
    expect(tablesSurviveRoundTrip('just text', 'just text')).toBe(true)
  })
})
