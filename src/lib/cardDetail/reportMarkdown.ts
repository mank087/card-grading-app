/**
 * The markdown-report reader used by the full DCM Optic&trade; analysis.
 *
 * EXTRACTED VERBATIM FROM `src/app/pokemon/[id]/CardDetailClient.tsx`
 * 6729-6853 [sports 6436-6560, identical]:
 *
 *   extractStep     6731-6735
 *   extractMeta     6738-6744
 *   parseTable      6747-6797
 *   cleanMarkdown   6800-6825
 *   REPORT_STEPS    6856-6868 (the render order and the section titles)
 *
 * Pre-v4.0 reports are markdown; v4.0+ are JSON and never reach this file.
 * The regexes are unchanged, including `cleanMarkdown`'s blanket removal of
 * any line mentioning "Rarity Tier" (6819) — a deprecated field the report
 * still emits.
 */

/** The body of one `[STEP n]` block, up to the next step or the meta marker. */
export function extractStep(report: string, stepNum: number | string): string {
  const regex = new RegExp(
    `\\[STEP ${stepNum}\\][^\\n]*\\n([\\s\\S]*?)(?=\\[STEP |:::META|$)`,
    'i'
  );
  const match = report.match(regex);
  return match ? match[1].trim() : '';
}

export interface ReportMeta {
  promptVersion: string;
  evaluationDate: string;
}

/** The `:::META` footer, or null when the report has none. */
export function extractMeta(report: string): ReportMeta | null {
  const metaMatch = report.match(
    /:::META[\s\S]*?Prompt Version:\s*([^\n]+)[\s\S]*?Evaluation Date:\s*([^\n]+)/i
  );
  return metaMatch
    ? { promptVersion: metaMatch[1].trim(), evaluationDate: metaMatch[2].trim() }
    : null;
}

/**
 * Flatten markdown pipe tables into "Header: cell" lines. A two-column
 * Field/Description table becomes "Field: Description" with no header labels.
 */
export function parseTable(text: string): string {
  const lines = text.split('\n');
  const tableLines: string[] = [];
  let inTable = false;
  let headers: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c);

      // Skip separator rows.
      if (cells.every((cell) => /^[-:]+$/.test(cell))) continue;

      if (!inTable) {
        headers = cells;
        inTable = true;
      } else if (cells.length === headers.length) {
        if (
          headers.length === 2 &&
          headers[0].toLowerCase().includes('field') &&
          headers[1].toLowerCase().includes('description')
        ) {
          if (cells[0] && cells[1]) tableLines.push(`${cells[0]}: ${cells[1]}`);
        } else {
          for (let i = 0; i < headers.length; i++) {
            if (cells[i]) tableLines.push(`${headers[i]}: ${cells[i]}`);
          }
          tableLines.push('');
        }
      }
    } else {
      if (inTable && tableLines.length > 0) inTable = false;
      tableLines.push(line);
    }
  }

  return tableLines.join('\n');
}

/** Tables first, then the markdown artefacts, then whitespace. */
export function cleanMarkdown(text: string): string {
  return parseTable(text)
    .replace(/:::[\w_]+/gi, '')
    .replace(/^##\s*$/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[-*+]\s+/gm, '  • ')
    // Deprecated field the report still emits.
    .replace(/^.*Rarity Tier.*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The order and titles legacy renders the steps in (6856-6868). */
export const REPORT_STEPS: Array<{ step: number; title: string }> = [
  { step: 1, title: 'Card Information Details' },
  { step: 3, title: 'Front Evaluation' },
  { step: 4, title: 'Back Evaluation' },
  { step: 2, title: 'Image Quality & Confidence Assessment' },
  { step: 5, title: 'Centering Analysis' },
  { step: 6, title: 'Defect Pattern Analysis' },
  { step: 7, title: 'Sub-Score Guidelines' },
  { step: 8, title: 'Final Grade Calculation' },
  { step: 9, title: 'Grade Cap Enforcement' },
  { step: 10, title: 'Final Grade' },
  { step: 11, title: 'Condition Label' },
];

export interface ReportSectionText {
  title: string;
  body: string;
}

/** Every step that had content, cleaned, in legacy's render order. */
export function readReportSections(report: string): ReportSectionText[] {
  return REPORT_STEPS.map(({ step, title }) => ({ title, body: extractStep(report, step) }))
    .filter((section) => !!section.body)
    .map((section) => ({ title: section.title, body: cleanMarkdown(section.body) }));
}
