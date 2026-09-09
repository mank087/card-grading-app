'use client'

import { useState } from 'react'
import { GRADE_10_FOIL_CSS, resolveGradeChip } from '@/lib/labelPresets'

export type StandardGrade = { grade: number; name: string; profile: string }
export function GradeScaleExplorer({ grades }: { grades: StandardGrade[] }) {
  const [selected, setSelected] = useState(10)
  const entry = grades.find(row => row.grade === selected) ?? grades[0]
  if (!entry) return null
  const chip = resolveGradeChip(entry.grade, true)
  return <div className="dcm-grade-explorer">
    <div className="dcm-grade-options" role="group" aria-label="Explore the grading scale">{grades.map(row => <button type="button" key={row.grade} onClick={() => setSelected(row.grade)} aria-pressed={selected === row.grade} aria-label={`Grade ${row.grade}: ${row.name}`}>{row.grade}</button>)}</div>
    <div className="dcm-grade-description" aria-live="polite">
      <div className={`dcm-reel-chip ${entry.grade === 10 ? 'dcm-reel-chip--foil' : ''}`} style={{ background: entry.grade === 10 ? `linear-gradient(${chip.fill}, ${chip.fill}) padding-box, ${GRADE_10_FOIL_CSS} border-box` : chip.fill, color: chip.ink }}>
        <strong style={entry.grade === 10 ? { backgroundImage: GRADE_10_FOIL_CSS, backgroundClip: 'text', color: 'transparent' } : undefined}>{entry.grade}</strong><span>{chip.label}</span>
      </div>
      <div><h3>{entry.name}</h3><p>{entry.profile}</p><a href="#published-standard">Read the full criteria →</a></div>
    </div>
  </div>
}
