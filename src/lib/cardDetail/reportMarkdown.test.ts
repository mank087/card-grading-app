import { describe, it, expect } from 'vitest';
import {
  cleanMarkdown,
  extractMeta,
  extractStep,
  parseTable,
  readReportSections,
  REPORT_STEPS,
} from './reportMarkdown';

const REPORT = [
  '[STEP 1] CARD INFORMATION',
  '- **Card Name**: Charizard',
  '- Rarity Tier: Holo Rare',
  '',
  '[STEP 2] IMAGE QUALITY',
  'Sharp, evenly lit.',
  '',
  ':::META',
  'Prompt Version: v9.26',
  'Evaluation Date: 2026-09-01',
].join('\n');

describe('extractStep', () => {
  it('takes the body up to the next step', () => {
    expect(extractStep(REPORT, 1)).toBe('- **Card Name**: Charizard\n- Rarity Tier: Holo Rare');
  });

  it('stops at the meta marker', () => {
    expect(extractStep(REPORT, 2)).toBe('Sharp, evenly lit.');
  });

  it('returns an empty string for a step that is not there', () => {
    expect(extractStep(REPORT, 7)).toBe('');
  });
});

describe('extractMeta', () => {
  it('reads the prompt version and evaluation date', () => {
    expect(extractMeta(REPORT)).toEqual({
      promptVersion: 'v9.26',
      evaluationDate: '2026-09-01',
    });
  });

  it('is null when there is no meta block', () => {
    expect(extractMeta('[STEP 1] X\nbody')).toBeNull();
  });
});

describe('parseTable', () => {
  it('flattens a Field/Description table without header labels', () => {
    const table = ['| Field | Description |', '| --- | --- |', '| Corners | Sharp |'].join('\n');
    expect(parseTable(table)).toBe('Corners: Sharp');
  });

  it('labels the cells of any other table', () => {
    const table = ['| Side | Score |', '|---|---|', '| Front | 9 |'].join('\n');
    expect(parseTable(table)).toBe('Side: Front\nScore: 9\n');
  });

  it('leaves non-table lines alone', () => {
    expect(parseTable('just prose')).toBe('just prose');
  });
});

describe('cleanMarkdown', () => {
  it('drops bold, italic, heading and block markers', () => {
    expect(cleanMarkdown('## Heading\n**bold** and *italic*\n:::BLOCK_A')).toBe(
      'Heading\nbold and italic'
    );
  });

  it('turns list markers into bullets, the first line losing its indent to the trim', () => {
    expect(cleanMarkdown('- one\n* two\n+ three')).toBe('• one\n  • two\n  • three');
  });

  it('removes any line mentioning the deprecated Rarity Tier field', () => {
    expect(cleanMarkdown('Card: Charizard\n- Rarity Tier: Holo')).toBe('Card: Charizard');
  });

  it('collapses runs of blank lines', () => {
    expect(cleanMarkdown('a\n\n\n\nb')).toBe('a\n\nb');
  });
});

describe('readReportSections', () => {
  it('returns only the steps with content, in the legacy order', () => {
    const sections = readReportSections(REPORT);
    expect(sections.map((s) => s.title)).toEqual([
      'Card Information Details',
      'Image Quality & Confidence Assessment',
    ]);
    // Front/Back evaluation come before image quality in the order table.
    expect(REPORT_STEPS.map((s) => s.step)).toEqual([1, 3, 4, 2, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('cleans each body', () => {
    expect(readReportSections(REPORT)[0].body).toBe('• Card Name: Charizard');
  });

  it('is empty for a report with no steps', () => {
    expect(readReportSections('nothing here')).toEqual([]);
  });
});
