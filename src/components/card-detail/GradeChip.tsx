'use client';

/**
 * The DCM grade chip: a black plate with the numeral in the grade's own
 * colour, and the rainbow foil numeral and keyline for a 10.
 *
 * This is the chip the Heritage label prints, brought onto the page so the
 * grade reads the same on screen as it does on the slab. Colours are not
 * defined here: they come from the black-plate ramp in labelPresets
 * (GRADE_CHIPS_PRINT, the inks designed to sit on GRADE_CHIP_BLACK) and the
 * foil from GRADE_10_FOIL_CSS, so a change to the label ramp changes this too.
 */

import type { CSSProperties } from 'react';
import { GRADE_10_FOIL_CSS, GRADE_CHIP_BLACK, resolveGradeChip } from '@/lib/labelPresets';

export interface GradeChipProps {
  /** The grade as the label prints it: '10', '9', 'A', 'N/A'. */
  gradeFormatted: string;
  /** Whole-number grade, or null for authentic / ungraded cards. */
  grade: number | null;
  /** Condition label under the numeral ("Mint"). Falls back to the ramp's own. */
  condition?: string | null;
  size?: 'hero' | 'compact';
}

export function GradeChip({ gradeFormatted, grade, condition, size = 'hero' }: GradeChipProps) {
  const chip = resolveGradeChip(grade, true);
  const isTen = grade !== null && Math.round(grade) === 10;
  const label = (condition || chip.label || '').toUpperCase();

  const style = {
    '--cd-chip-plate': GRADE_CHIP_BLACK,
    '--cd-chip-ink': chip.ink,
    '--cd-chip-foil': GRADE_10_FOIL_CSS,
  } as CSSProperties;

  return (
    <div
      className={`cd-grade-chip cd-grade-chip--${size}${isTen ? ' is-foil' : ''}`}
      style={style}
      role="img"
      aria-label={`DCM grade ${gradeFormatted}${grade !== null ? ' out of 10' : ''}${label ? `, ${label}` : ''}`}
    >
      <span className="cd-grade-chip-numeral" aria-hidden="true">{gradeFormatted}</span>
      {label && <span className="cd-grade-chip-label" aria-hidden="true">{label}</span>}
    </div>
  );
}

export default GradeChip;
