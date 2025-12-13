'use client'

import { useState, useCallback } from 'react'
import {
  UserConditionReportInput,
  SideDefects,
  SurfaceDefects,
  CornerDefects,
  EdgeDefects,
  StructuralDefects,
  FactoryDefects,
  DefectTooltip,
  SURFACE_TOOLTIPS,
  CORNER_TOOLTIPS,
  EDGE_TOOLTIPS,
  STRUCTURAL_TOOLTIPS,
  FACTORY_TOOLTIPS,
  EMPTY_CONDITION_REPORT,
  hasAnyConditionData,
  countDefects,
} from '@/types/conditionReport'

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const MAX_NOTE_LENGTH = 500

// ═══════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

interface TooltipProps {
  tooltip: DefectTooltip
  children: React.ReactNode
}

function Tooltip({ tooltip, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none">
          <p className="font-semibold mb-1">{tooltip.label}</p>
          <p className="text-gray-300 mb-2">{tooltip.description}</p>
          {tooltip.examples && (
            <p className="text-gray-400 italic text-[11px]">
              Examples: {tooltip.examples}
            </p>
          )}
          <div className="absolute bottom-0 left-4 transform translate-y-full">
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900" />
          </div>
        </div>
      )}
    </div>
  )
}

interface CheckboxItemProps {
  id: string
  tooltip: DefectTooltip
  checked: boolean
  onChange: (checked: boolean) => void
}

function CheckboxItem({ id, tooltip, checked, onChange }: CheckboxItemProps) {
  return (
    <Tooltip tooltip={tooltip}>
      <label
        htmlFor={id}
        className="flex items-center gap-2 cursor-pointer group py-1 px-2 rounded-md hover:bg-gray-50 transition-colors"
      >
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        />
        <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
          {tooltip.label}
        </span>
        <span className="text-gray-400 text-xs ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          ?
        </span>
      </label>
    </Tooltip>
  )
}

interface NotesInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  maxLength?: number
}

function NotesInput({ value, onChange, placeholder, maxLength = MAX_NOTE_LENGTH }: NotesInputProps) {
  return (
    <div className="mt-3">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
      />
      <div className="text-xs text-gray-400 text-right mt-1">
        {value.length}/{maxLength}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// DEFECT SECTION COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

interface SurfaceSectionProps {
  side: 'front' | 'back'
  data: SurfaceDefects
  onChange: (data: SurfaceDefects) => void
}

function SurfaceSection({ side, data, onChange }: SurfaceSectionProps) {
  const update = (key: keyof SurfaceDefects, value: boolean) => {
    onChange({ ...data, [key]: value })
  }

  return (
    <div className="mb-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 px-2">
        Surface Defects
      </p>
      <div className="grid grid-cols-1 gap-0">
        <CheckboxItem
          id={`${side}-scratches`}
          tooltip={SURFACE_TOOLTIPS.scratches}
          checked={data.scratches}
          onChange={(v) => update('scratches', v)}
        />
        <CheckboxItem
          id={`${side}-print-lines`}
          tooltip={SURFACE_TOOLTIPS.print_lines}
          checked={data.print_lines}
          onChange={(v) => update('print_lines', v)}
        />
        <CheckboxItem
          id={`${side}-fingerprints`}
          tooltip={SURFACE_TOOLTIPS.fingerprints}
          checked={data.fingerprints}
          onChange={(v) => update('fingerprints', v)}
        />
        <CheckboxItem
          id={`${side}-holo-scratches`}
          tooltip={SURFACE_TOOLTIPS.holo_scratches}
          checked={data.holo_scratches}
          onChange={(v) => update('holo_scratches', v)}
        />
        <CheckboxItem
          id={`${side}-indentations`}
          tooltip={SURFACE_TOOLTIPS.indentations}
          checked={data.indentations}
          onChange={(v) => update('indentations', v)}
        />
        <CheckboxItem
          id={`${side}-white-spots`}
          tooltip={SURFACE_TOOLTIPS.white_spots}
          checked={data.white_spots}
          onChange={(v) => update('white_spots', v)}
        />
        <CheckboxItem
          id={`${side}-fish-eyes`}
          tooltip={SURFACE_TOOLTIPS.fish_eyes}
          checked={data.fish_eyes}
          onChange={(v) => update('fish_eyes', v)}
        />
        <CheckboxItem
          id={`${side}-staining`}
          tooltip={SURFACE_TOOLTIPS.staining}
          checked={data.staining}
          onChange={(v) => update('staining', v)}
        />
      </div>
    </div>
  )
}

interface CornerSectionProps {
  side: 'front' | 'back'
  data: CornerDefects
  onChange: (data: CornerDefects) => void
}

function CornerSection({ side, data, onChange }: CornerSectionProps) {
  const update = (key: keyof CornerDefects, value: boolean) => {
    onChange({ ...data, [key]: value })
  }

  return (
    <div className="mb-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 px-2">
        Corner Defects
      </p>
      <div className="grid grid-cols-1 gap-0">
        <CheckboxItem
          id={`${side}-corner-whitening`}
          tooltip={CORNER_TOOLTIPS.whitening}
          checked={data.whitening}
          onChange={(v) => update('whitening', v)}
        />
        <CheckboxItem
          id={`${side}-corner-soft`}
          tooltip={CORNER_TOOLTIPS.soft_rounded}
          checked={data.soft_rounded}
          onChange={(v) => update('soft_rounded', v)}
        />
        <CheckboxItem
          id={`${side}-corner-dings`}
          tooltip={CORNER_TOOLTIPS.dings}
          checked={data.dings}
          onChange={(v) => update('dings', v)}
        />
        <CheckboxItem
          id={`${side}-corner-creasing`}
          tooltip={CORNER_TOOLTIPS.creasing}
          checked={data.creasing}
          onChange={(v) => update('creasing', v)}
        />
      </div>
    </div>
  )
}

interface EdgeSectionProps {
  side: 'front' | 'back'
  data: EdgeDefects
  onChange: (data: EdgeDefects) => void
}

function EdgeSection({ side, data, onChange }: EdgeSectionProps) {
  const update = (key: keyof EdgeDefects, value: boolean) => {
    onChange({ ...data, [key]: value })
  }

  return (
    <div className="mb-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 px-2">
        Edge Defects
      </p>
      <div className="grid grid-cols-1 gap-0">
        <CheckboxItem
          id={`${side}-edge-whitening`}
          tooltip={EDGE_TOOLTIPS.whitening}
          checked={data.whitening}
          onChange={(v) => update('whitening', v)}
        />
        <CheckboxItem
          id={`${side}-edge-chipping`}
          tooltip={EDGE_TOOLTIPS.chipping}
          checked={data.chipping}
          onChange={(v) => update('chipping', v)}
        />
        <CheckboxItem
          id={`${side}-edge-rough`}
          tooltip={EDGE_TOOLTIPS.rough_cut}
          checked={data.rough_cut}
          onChange={(v) => update('rough_cut', v)}
        />
        <CheckboxItem
          id={`${side}-edge-peeling`}
          tooltip={EDGE_TOOLTIPS.peeling}
          checked={data.peeling}
          onChange={(v) => update('peeling', v)}
        />
        <CheckboxItem
          id={`${side}-edge-silvering`}
          tooltip={EDGE_TOOLTIPS.silvering}
          checked={data.silvering}
          onChange={(v) => update('silvering', v)}
        />
        <CheckboxItem
          id={`${side}-edge-white-dots`}
          tooltip={EDGE_TOOLTIPS.white_dots}
          checked={data.white_dots}
          onChange={(v) => update('white_dots', v)}
        />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// SIDE PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════════════

interface SidePanelProps {
  title: string
  side: 'front' | 'back'
  data: SideDefects
  onChange: (data: SideDefects) => void
}

function SidePanel({ title, side, data, onChange }: SidePanelProps) {
  const updateSurface = useCallback((surface: SurfaceDefects) => {
    onChange({ ...data, surface })
  }, [data, onChange])

  const updateCorners = useCallback((corners: CornerDefects) => {
    onChange({ ...data, corners })
  }, [data, onChange])

  const updateEdges = useCallback((edges: EdgeDefects) => {
    onChange({ ...data, edges })
  }, [data, onChange])

  return (
    <div className="flex-1 min-w-[260px]">
      <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 px-2">
        {side === 'front' ? '🎴' : '🔙'} {title}
      </h4>
      <SurfaceSection side={side} data={data.surface} onChange={updateSurface} />
      <CornerSection side={side} data={data.corners} onChange={updateCorners} />
      <EdgeSection side={side} data={data.edges} onChange={updateEdges} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// STRUCTURAL & FACTORY SECTIONS
// ═══════════════════════════════════════════════════════════════════════

interface StructuralSectionProps {
  data: StructuralDefects
  onChange: (data: StructuralDefects) => void
}

function StructuralSection({ data, onChange }: StructuralSectionProps) {
  const update = (key: keyof StructuralDefects, value: boolean) => {
    onChange({ ...data, [key]: value })
  }

  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0">
      <CheckboxItem
        id="structural-crease"
        tooltip={STRUCTURAL_TOOLTIPS.crease}
        checked={data.crease}
        onChange={(v) => update('crease', v)}
      />
      <CheckboxItem
        id="structural-bend"
        tooltip={STRUCTURAL_TOOLTIPS.bend}
        checked={data.bend}
        onChange={(v) => update('bend', v)}
      />
      <CheckboxItem
        id="structural-warp"
        tooltip={STRUCTURAL_TOOLTIPS.warp}
        checked={data.warp}
        onChange={(v) => update('warp', v)}
      />
      <CheckboxItem
        id="structural-water"
        tooltip={STRUCTURAL_TOOLTIPS.water_damage}
        checked={data.water_damage}
        onChange={(v) => update('water_damage', v)}
      />
    </div>
  )
}

interface FactorySectionProps {
  data: FactoryDefects
  onChange: (data: FactoryDefects) => void
}

function FactorySection({ data, onChange }: FactorySectionProps) {
  const update = (key: keyof FactoryDefects, value: boolean) => {
    onChange({ ...data, [key]: value })
  }

  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0">
      <CheckboxItem
        id="factory-crimping"
        tooltip={FACTORY_TOOLTIPS.crimping}
        checked={data.crimping}
        onChange={(v) => update('crimping', v)}
      />
      <CheckboxItem
        id="factory-miscut"
        tooltip={FACTORY_TOOLTIPS.miscut}
        checked={data.miscut}
        onChange={(v) => update('miscut', v)}
      />
      <CheckboxItem
        id="factory-ink-error"
        tooltip={FACTORY_TOOLTIPS.ink_error}
        checked={data.ink_error}
        onChange={(v) => update('ink_error', v)}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

interface UserConditionReportProps {
  value: UserConditionReportInput
  onChange: (value: UserConditionReportInput) => void
  defaultExpanded?: boolean
}

export default function UserConditionReport({
  value,
  onChange,
  defaultExpanded = false,
}: UserConditionReportProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const hasData = hasAnyConditionData(value)
  const defectCount = countDefects(value)

  const updateFront = useCallback((front: SideDefects) => {
    onChange({ ...value, front })
  }, [value, onChange])

  const updateBack = useCallback((back: SideDefects) => {
    onChange({ ...value, back })
  }, [value, onChange])

  const updateStructural = useCallback((structural: StructuralDefects) => {
    onChange({ ...value, structural })
  }, [value, onChange])

  const updateFactory = useCallback((factory: FactoryDefects) => {
    onChange({ ...value, factory })
  }, [value, onChange])

  const updateNotes = useCallback((notes: string) => {
    onChange({ ...value, notes })
  }, [value, onChange])

  const clearAll = useCallback(() => {
    onChange(EMPTY_CONDITION_REPORT)
  }, [onChange])

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Header - Always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
            <span className="text-lg">📋</span>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-800 text-sm">
              Report Card Condition
              <span className="ml-2 text-xs font-normal text-gray-500">(Optional)</span>
            </h3>
            <p className="text-xs text-gray-500">
              Help catch defects that photos might miss
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasData && (
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
              {defectCount} defect{defectCount !== 1 ? 's' : ''} reported
            </span>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Info Banner */}
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">ℹ️</span>
              <div className="text-xs text-blue-700">
                <p className="mb-1">
                  <strong>Tip:</strong> Hover over any option to see detailed descriptions and examples.
                </p>
                <p>
                  Your input helps guide inspection but cannot raise grades above what photos show.
                </p>
              </div>
            </div>
          </div>

          {/* Front and Back Panels */}
          <div className="px-4 py-4">
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
              <SidePanel
                title="Front of Card"
                side="front"
                data={value.front}
                onChange={updateFront}
              />
              <div className="hidden lg:block w-px bg-gray-200" />
              <SidePanel
                title="Back of Card"
                side="back"
                data={value.back}
                onChange={updateBack}
              />
            </div>
          </div>

          {/* Structural Issues */}
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 px-2">
              ⚠️ Structural Issues (Whole Card)
            </h4>
            <StructuralSection data={value.structural} onChange={updateStructural} />
          </div>

          {/* Factory Defects */}
          <div className="px-4 py-3 border-t border-gray-100 bg-amber-50/50">
            <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 px-2">
              🏭 Factory/Manufacturing Defects
            </h4>
            <FactorySection data={value.factory} onChange={updateFactory} />
          </div>

          {/* Additional Notes */}
          <div className="px-4 py-4 border-t border-gray-100">
            <h4 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
              📝 Additional Notes
            </h4>
            <p className="text-xs text-gray-500 mb-2">
              Describe any other defects or provide details about specific issues
            </p>
            <NotesInput
              value={value.notes}
              onChange={updateNotes}
              placeholder="E.g., 'Light scratch near center of front', 'Small white dot at top-left corner', 'Factory print line visible under certain lighting'..."
            />
          </div>

          {/* Footer */}
          {hasData && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={clearAll}
                className="text-sm text-gray-500 hover:text-red-600 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// COMPACT DISPLAY COMPONENT (for showing submitted report)
// ═══════════════════════════════════════════════════════════════════════

interface ConditionReportDisplayProps {
  report: UserConditionReportInput
  aiResponse?: {
    hints_confirmed: string[]
    hints_not_visible: string[]
    influenced_grade: boolean
  }
}

export function ConditionReportDisplay({ report, aiResponse }: ConditionReportDisplayProps) {
  const hasData = hasAnyConditionData(report)

  if (!hasData) {
    return null
  }

  // Collect all reported defects by category
  const frontDefects: string[] = []
  const backDefects: string[] = []
  const structuralDefects: string[] = []
  const factoryDefects: string[] = []

  // Front surface
  if (report.front.surface.scratches) frontDefects.push('Surface scratches')
  if (report.front.surface.print_lines) frontDefects.push('Print lines')
  if (report.front.surface.fingerprints) frontDefects.push('Fingerprints')
  if (report.front.surface.holo_scratches) frontDefects.push('Holofoil scratches')
  if (report.front.surface.indentations) frontDefects.push('Indentations')
  if (report.front.surface.white_spots) frontDefects.push('White dots/specks')
  if (report.front.surface.fish_eyes) frontDefects.push('Fish eyes')
  if (report.front.surface.staining) frontDefects.push('Staining')

  // Front corners
  if (report.front.corners.whitening) frontDefects.push('Corner whitening')
  if (report.front.corners.soft_rounded) frontDefects.push('Soft corners')
  if (report.front.corners.dings) frontDefects.push('Corner dings')
  if (report.front.corners.creasing) frontDefects.push('Corner creases')

  // Front edges
  if (report.front.edges.whitening) frontDefects.push('Edge whitening')
  if (report.front.edges.chipping) frontDefects.push('Edge chipping')
  if (report.front.edges.rough_cut) frontDefects.push('Rough cut')
  if (report.front.edges.peeling) frontDefects.push('Edge peeling')
  if (report.front.edges.silvering) frontDefects.push('Silvering')
  if (report.front.edges.white_dots) frontDefects.push('Edge white dots')

  // Back surface
  if (report.back.surface.scratches) backDefects.push('Surface scratches')
  if (report.back.surface.print_lines) backDefects.push('Print lines')
  if (report.back.surface.fingerprints) backDefects.push('Fingerprints')
  if (report.back.surface.holo_scratches) backDefects.push('Holofoil scratches')
  if (report.back.surface.indentations) backDefects.push('Indentations')
  if (report.back.surface.white_spots) backDefects.push('White dots/specks')
  if (report.back.surface.fish_eyes) backDefects.push('Fish eyes')
  if (report.back.surface.staining) backDefects.push('Staining')

  // Back corners
  if (report.back.corners.whitening) backDefects.push('Corner whitening')
  if (report.back.corners.soft_rounded) backDefects.push('Soft corners')
  if (report.back.corners.dings) backDefects.push('Corner dings')
  if (report.back.corners.creasing) backDefects.push('Corner creases')

  // Back edges
  if (report.back.edges.whitening) backDefects.push('Edge whitening')
  if (report.back.edges.chipping) backDefects.push('Edge chipping')
  if (report.back.edges.rough_cut) backDefects.push('Rough cut')
  if (report.back.edges.peeling) backDefects.push('Edge peeling')
  if (report.back.edges.silvering) backDefects.push('Silvering')
  if (report.back.edges.white_dots) backDefects.push('Edge white dots')

  // Structural
  if (report.structural.crease) structuralDefects.push('Crease')
  if (report.structural.bend) structuralDefects.push('Bend')
  if (report.structural.warp) structuralDefects.push('Warping')
  if (report.structural.water_damage) structuralDefects.push('Water damage')

  // Factory (with backwards compatibility check)
  if (report.factory) {
    if (report.factory.crimping) factoryDefects.push('Crimping')
    if (report.factory.miscut) factoryDefects.push('Miscut')
    if (report.factory.ink_error) factoryDefects.push('Ink/print error')
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <h4 className="font-semibold text-amber-800 text-sm mb-3 flex items-center gap-2">
        📋 User-Reported Condition
        {aiResponse?.influenced_grade && (
          <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-xs rounded-full">
            Influenced grade
          </span>
        )}
      </h4>

      <div className="space-y-3 text-sm">
        {frontDefects.length > 0 && (
          <div>
            <p className="font-medium text-amber-700">Front:</p>
            <p className="text-amber-600">{frontDefects.join(', ')}</p>
          </div>
        )}

        {backDefects.length > 0 && (
          <div>
            <p className="font-medium text-amber-700">Back:</p>
            <p className="text-amber-600">{backDefects.join(', ')}</p>
          </div>
        )}

        {structuralDefects.length > 0 && (
          <div>
            <p className="font-medium text-amber-700">Structural:</p>
            <p className="text-amber-600">{structuralDefects.join(', ')}</p>
          </div>
        )}

        {factoryDefects.length > 0 && (
          <div>
            <p className="font-medium text-amber-700">Factory:</p>
            <p className="text-amber-600">{factoryDefects.join(', ')}</p>
          </div>
        )}

        {report.notes && (
          <div>
            <p className="font-medium text-amber-700">Additional notes:</p>
            <p className="text-amber-600 italic">"{report.notes}"</p>
          </div>
        )}

        {/* AI Response Section */}
        {aiResponse && (
          <div className="mt-4 pt-3 border-t border-amber-200">
            <p className="font-medium text-amber-700 mb-2">AI Verification:</p>
            {aiResponse.hints_confirmed.length > 0 && (
              <div className="flex items-start gap-2 mb-1">
                <span className="text-green-600">✓</span>
                <span className="text-amber-600">
                  Confirmed: {aiResponse.hints_confirmed.join(', ')}
                </span>
              </div>
            )}
            {aiResponse.hints_not_visible.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-gray-400">○</span>
                <span className="text-amber-600">
                  Not visible in photos: {aiResponse.hints_not_visible.join(', ')}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
