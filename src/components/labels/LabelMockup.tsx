'use client'

/**
 * LabelMockup — Realistic mockups using actual product photos as backgrounds.
 *
 * Toploader & One-Touch use real PNG photos with card composited inside.
 * Slab uses real slab case photo with label composited in the top slot.
 * Labels are positioned at real-world proportions relative to each holder.
 *
 * Physical references:
 *   Toploader:   ~3" × 4" holder, card 2.5" × 3.5", label 1.75" × 0.5" at top
 *   One-Touch:   ~3" × 4.25" holder, card 2.5" × 3.5", Avery 6871 (2.375" × 0.625" visible) at top
 *   Slab:        Photo 280×460px, label slot at top, card window below
 *   Card Image:  800 × 1328px digital (label 220px + sep 8px + card 1100px)
 */

import { useState } from 'react'
import type { LabelTypeInfo } from '@/lib/labelPresets'

interface LabelMockupProps {
  card: {
    front_url?: string | null
    back_url?: string | null
    card_name?: string
  }
  labelType: LabelTypeInfo
  labelProps: {
    displayName: string
    setLineText: string
    features: string[]
    serial: string
    grade: number | null
    condition: string
    isAlteredAuthentic: boolean
  }
  backLabelProps?: {
    serial: string
    grade: number | null
    condition: string
    qrCodeUrl?: string
    subScores?: { centering: number; corners: number; edges: number; surface: number }
    isAlteredAuthentic: boolean
    showFounderEmblem?: boolean
    showVipEmblem?: boolean
    showCardLoversEmblem?: boolean
  }
}

function gradeStr(grade: number | null, alt?: boolean): string {
  if (grade !== null) return Math.round(grade).toString()
  return alt ? 'A' : 'N/A'
}

function QRPlaceholder({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="8" height="8" rx="1" fill="#7c3aed" opacity="0.6" />
      <rect x="14" y="2" width="8" height="8" rx="1" fill="#7c3aed" opacity="0.6" />
      <rect x="2" y="14" width="8" height="8" rx="1" fill="#7c3aed" opacity="0.6" />
      <rect x="14" y="14" width="4" height="4" rx="0.5" fill="#7c3aed" opacity="0.4" />
      <rect x="18" y="18" width="4" height="4" rx="0.5" fill="#7c3aed" opacity="0.4" />
      <rect x="4" y="4" width="4" height="4" rx="0.5" fill="white" />
      <rect x="16" y="4" width="4" height="4" rx="0.5" fill="white" />
      <rect x="4" y="16" width="4" height="4" rx="0.5" fill="white" />
    </svg>
  )
}

function WatermarkPattern() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity: 0.08 }}>
      <div className="flex flex-wrap gap-[6px] p-[3px]">
        {Array.from({ length: 8 }).map((_, i) => (
          <img key={i} src="/DCM-logo.png" alt="" className="w-[10px] h-[10px]" />
        ))}
      </div>
    </div>
  )
}

/** Dense grid of DCM logos filling the entire label (matches 8167 back template) */
function DenseLogoGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity: 0.08 }}>
      <div className="grid gap-[2px] p-[1px] w-full h-full"
        style={{ gridTemplateColumns: 'repeat(auto-fill, 10px)', gridTemplateRows: 'repeat(auto-fill, 10px)', alignContent: 'center' }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <img key={i} src="/DCM-logo.png" alt="" className="w-[10px] h-[10px]" />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// SLAB LABEL — Inline components matching the canvas template exactly
//
// Layout from slabLabelGenerator.ts (2.8" × 0.8", ratio 3.5:1):
//   FRONT: [Logo ~12%] [Card Info ~68%] [Grade ~20%]
//   BACK:  [QR ~22%] [Badges?] [Grade center] [Sub-scores ~22%]
//
// Modern:      dark gradient #1a1625→#2d1f47, white/green text, white grade
// Traditional: light gradient #f9fafb→#ffffff, dark text, purple grade
//
// These use ONLY aspectRatio for height — NO fixed pixel heights — so they
// scale correctly into any container width.
// ============================================================================

function SlabFrontLabel({ labelProps, style }: {
  labelProps: LabelMockupProps['labelProps']
  style: 'modern' | 'traditional'
}) {
  const grade = gradeStr(labelProps.grade, labelProps.isAlteredAuthentic)
  const isModern = style === 'modern'
  const condition = labelProps.isAlteredAuthentic && labelProps.grade === null
    ? 'AUTHENTIC' : (labelProps.condition || '').toUpperCase()

  // All font sizes as % of container width for proper scaling
  // At 146px wide (73% of 200px slab), these produce readable text
  const nameLen = labelProps.displayName.length
  const namePct = nameLen <= 14 ? 6.5 : nameLen <= 20 ? 5.5 : nameLen <= 30 ? 4.8 : 4.2

  return (
    <div
      className="w-full relative overflow-hidden flex items-center"
      style={{
        aspectRatio: '3.5 / 1',
        background: isModern
          ? 'linear-gradient(135deg, #1a1625 0%, #2d1f47 50%, #1a1625 100%)'
          : 'linear-gradient(180deg, #f9fafb, #ffffff)',
        padding: '4% 3%',
        containerType: 'inline-size',
      }}
    >
      {/* Subtle inner glow (modern only) */}
      {isModern && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.1) 0%, transparent 70%)' }} />
      )}

      <div className="relative flex items-center w-full h-full gap-[4%]">
        {/* LEFT: DCM Logo — 55% of label height */}
        <div className="flex-shrink-0 flex items-center justify-center" style={{ width: '12%' }}>
          <img
            src={isModern ? '/DCM Logo white.png' : '/DCM-logo.png'}
            alt="DCM"
            className="w-full h-auto"
            style={{ maxHeight: '55%' }}
          />
        </div>

        {/* CENTER: Card Info — vertically centered, fills available space */}
        <div className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden" style={{ gap: '1%' }}>
          {/* Line 1: Card Name — wraps to 2 lines max */}
          <div className="font-semibold" style={{
            fontSize: `${namePct}cqw`,
            lineHeight: 1.15,
            color: isModern ? 'rgba(255,255,255,0.95)' : '#1f2937',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
          }}>
            {labelProps.displayName}
          </div>
          {/* Line 2: Set / Number / Year */}
          <div style={{
            fontSize: `${namePct * 0.76}cqw`,
            lineHeight: 1.15,
            color: isModern ? 'rgba(255,255,255,0.7)' : '#4b5563',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
          }}>
            {labelProps.setLineText}
          </div>
          {/* Line 3: Features */}
          {labelProps.features.length > 0 && (
            <div className="font-medium" style={{
              fontSize: `${namePct * 0.7}cqw`,
              lineHeight: 1.15,
              color: isModern ? 'rgba(34,197,94,0.9)' : '#2563eb',
            }}>
              {labelProps.features.join(' \u2022 ')}
            </div>
          )}
          {/* Line 4: Serial */}
          <div className="font-mono" style={{
            fontSize: `${namePct * 0.7}cqw`,
            lineHeight: 1.15,
            color: isModern ? 'rgba(255,255,255,0.5)' : '#6b7280',
          }}>
            {labelProps.serial}
          </div>
        </div>

        {/* RIGHT: Grade + Condition — vertically centered */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center" style={{ width: '18%' }}>
          <div className="font-bold leading-none" style={{
            fontSize: '12cqw',
            color: isModern ? '#ffffff' : '#7c3aed',
          }}>
            {grade}
          </div>
          {!isModern && (
            <div className="mx-auto mt-[1px]" style={{ width: '60%', height: '1px', background: '#7c3aed' }} />
          )}
          {condition && (
            <div className="font-bold uppercase text-center" style={{
              fontSize: '3cqw',
              lineHeight: 1.2,
              letterSpacing: '0.3px',
              marginTop: '1px',
              color: isModern ? 'rgba(255,255,255,0.8)' : '#6b46c1',
            }}>
              {condition}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SlabBackLabel({ labelProps, backLabelProps, style }: {
  labelProps: LabelMockupProps['labelProps']
  backLabelProps?: LabelMockupProps['backLabelProps']
  style: 'modern' | 'traditional'
}) {
  const grade = gradeStr(labelProps.grade, labelProps.isAlteredAuthentic)
  const isModern = style === 'modern'
  const condition = labelProps.isAlteredAuthentic && labelProps.grade === null
    ? 'AUTHENTIC' : (labelProps.condition || '').toUpperCase()
  const subScores = backLabelProps?.subScores

  return (
    <div
      className="w-full relative overflow-hidden flex items-center"
      style={{
        aspectRatio: '3.5 / 1',
        background: isModern
          ? 'linear-gradient(135deg, #1a1625 0%, #2d1f47 50%, #1a1625 100%)'
          : 'linear-gradient(180deg, #f9fafb, #ffffff)',
        padding: '4% 3%',
        containerType: 'inline-size',
      }}
    >
      {isModern && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.1) 0%, transparent 70%)' }} />
      )}

      <div className="relative flex items-center w-full h-full gap-[4%]">
        {/* LEFT: QR Code — 72% of label height */}
        <div className="flex-shrink-0 flex items-center justify-center" style={{ width: '18%' }}>
          <div className="rounded-sm" style={{
            padding: isModern ? '2px' : '1px',
            background: isModern ? '#1a1625' : '#ffffff',
            boxShadow: isModern ? '0 0 6px rgba(139,92,246,0.5)' : '0 1px 3px rgba(0,0,0,0.1)',
            border: isModern ? '1px solid rgba(139,92,246,0.4)' : '1px solid #e5e7eb',
          }}>
            <div className="bg-white rounded-[1px] p-[1px]">
              <QRPlaceholder size={22} />
            </div>
          </div>
        </div>

        {/* Badges — between QR and center grade, vertical layout matching ModernBackLabel */}
        {(backLabelProps?.showFounderEmblem || backLabelProps?.showVipEmblem || backLabelProps?.showCardLoversEmblem) && (
          <>
            {backLabelProps.showFounderEmblem && (
              <div className="flex-shrink-0 flex flex-col items-center justify-start h-full" style={{ paddingTop: '3%', paddingBottom: '3%' }}>
                <span style={{ fontSize: '5cqw', lineHeight: 1, color: '#FFD700' }}>&#9733;</span>
                <span style={{
                  fontWeight: 600,
                  fontSize: '2.5cqw',
                  color: isModern ? '#FFFFFF' : '#7c3aed',
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  marginTop: '1px',
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                } as React.CSSProperties}>
                  Founder
                </span>
              </div>
            )}
            {backLabelProps.showCardLoversEmblem && (
              <div className="flex-shrink-0 flex flex-col items-center justify-start h-full" style={{ paddingTop: '3%', paddingBottom: '3%' }}>
                <span style={{ fontSize: '5cqw', lineHeight: 1, color: '#f43f5e' }}>&#9829;</span>
                <span style={{
                  fontWeight: 600,
                  fontSize: '2.5cqw',
                  color: isModern ? '#FFFFFF' : '#f43f5e',
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  marginTop: '1px',
                  letterSpacing: '0.3px',
                  whiteSpace: 'nowrap',
                } as React.CSSProperties}>
                  Card Lover
                </span>
              </div>
            )}
            {backLabelProps.showVipEmblem && (
              <div className="flex-shrink-0 flex flex-col items-center justify-start h-full" style={{ paddingTop: '3%', paddingBottom: '3%' }}>
                <span style={{ fontSize: '5cqw', lineHeight: 1, color: '#6366f1' }}>&#9670;</span>
                <span style={{
                  fontWeight: 600,
                  fontSize: '2.5cqw',
                  color: isModern ? '#FFFFFF' : '#6366f1',
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  marginTop: '1px',
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                } as React.CSSProperties}>
                  VIP
                </span>
              </div>
            )}
          </>
        )}

        {/* CENTER: Large Grade + Condition */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="font-bold leading-none" style={{
            fontSize: '12cqw',
            color: isModern ? '#ffffff' : '#7c3aed',
          }}>
            {grade}
          </div>
          {condition && (
            <div className="font-bold uppercase text-center" style={{
              fontSize: '3cqw',
              lineHeight: 1.2,
              letterSpacing: '0.3px',
              marginTop: '1px',
              color: isModern ? 'rgba(255,255,255,0.8)' : '#6b46c1',
            }}>
              {condition}
            </div>
          )}
        </div>

        {/* RIGHT: Sub-scores */}
        {subScores && (
          <div className="flex-shrink-0 flex flex-col justify-center gap-0 text-right" style={{ width: '22%' }}>
            {(['centering', 'corners', 'edges', 'surface'] as const).map(key => (
              <div key={key} style={{
                fontSize: '3.5cqw',
                lineHeight: '1.5',
                color: isModern ? 'rgba(255,255,255,0.9)' : '#4b5563',
              }}>
                {key.charAt(0).toUpperCase() + key.slice(1)}: {Math.round(subScores[key])}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// 1. GRADED SLAB — Real slab case photo background
//    Photo: 280×460px (aspect 280/460 ≈ 0.609)
//    Label slot: top ~4%, left ~10%, width ~80%, height ~13.5%
//    Card window: top ~21%, left ~11%, width ~78%, height ~73%
// ============================================================================

function GradedSlabMockup({ card, labelProps, backLabelProps, style }: {
  card: LabelMockupProps['card']
  labelProps: LabelMockupProps['labelProps']
  backLabelProps: LabelMockupProps['backLabelProps']
  style: 'modern' | 'traditional'
}) {
  const [side, setSide] = useState<'front' | 'back'>('front')
  const cardImage = side === 'front' ? card.front_url : card.back_url
  const isModern = style === 'modern'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-full max-w-[200px] relative" style={{ aspectRatio: '280 / 460' }}>
        {/* Slab case photo background */}
        <img
          src="/labels/graded-card-slab.png"
          alt="Graded Card Slab"
          className="absolute inset-0 w-full h-full object-contain"
        />

        {/* LABEL — positioned in the top rectangle slot.
            Slot in photo: ~224×58px (ratio ~3.86:1). Label is 3.5:1.
            At width 73%, label height = 73%/3.5 ≈ 20.9% of width ≈ 12.7% of slab height.
            Slot height is ~12.6% — fits perfectly. Centered horizontally. */}
        <div className="absolute" style={{ top: '4.5%', left: '13.5%', width: '73%' }}>
          {side === 'front'
            ? <SlabFrontLabel labelProps={labelProps} style={isModern ? 'modern' : 'traditional'} />
            : <SlabBackLabel labelProps={labelProps} backLabelProps={backLabelProps} style={isModern ? 'modern' : 'traditional'} />
          }
        </div>

        {/* CARD — positioned in the lower window.
            Window in photo: ~y=92 to y=432, x=30 to x=250
            → top 20%, left 10.7%, width 78.6%, height 73.9% */}
        <div className="absolute overflow-hidden" style={{ top: '20%', left: '10.7%', width: '78.6%', height: '73.9%' }}>
          {cardImage ? (
            <img src={cardImage} alt={card.card_name || 'Card'}
              className="w-full h-full object-contain" loading="lazy" />
          ) : (
            <div className="w-full h-full" />
          )}
        </div>

        {/* Subtle gloss/reflection overlay on the slab */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.03) 100%)' }} />
      </div>
      <SideToggle side={side} onToggle={setSide} />
    </div>
  )
}

// ============================================================================
// 2. TOPLOADER — Real photo background with card composited inside
//    Photo: 451×588px (aspect 0.767)
//    Card area: inset ~5.5% left, ~3.7% top, ~89% width, ~91.2% height
//    Label (Avery 8167): 1.75" × 0.5" (3.5:1)
//    Label width relative to toploader: ~58% (1.75 / 3.0)
//    Label sits at the very top edge, centered
// ============================================================================

function ToploaderMockup({ card, labelProps, variant }: {
  card: LabelMockupProps['card']
  labelProps: LabelMockupProps['labelProps']
  variant: 'front-back' | 'foldover'
}) {
  const [side, setSide] = useState<'front' | 'back'>('front')
  const cardImage = side === 'front' ? card.front_url : card.back_url
  const grade = gradeStr(labelProps.grade, labelProps.isAlteredAuthentic)

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Container matching the toploader photo aspect ratio */}
      <div className="w-full max-w-[200px] relative" style={{ aspectRatio: '451 / 588' }}>
        {/* Toploader photo background */}
        <img
          src="/labels/top-loader-dcm.png"
          alt="Toploader"
          className="absolute inset-0 w-full h-full object-contain"
        />

        {/* Card image composited inside the toploader */}
        <div className="absolute" style={{ left: '7%', top: '4.5%', width: '86%', height: '90%' }}>
          {cardImage ? (
            <img src={cardImage} alt={card.card_name || 'Card'}
              className="w-full h-full object-contain rounded-[2px]" loading="lazy" />
          ) : (
            <div className="w-full h-full" />
          )}
        </div>

        {/* Label overlaid at the top edge */}
        {variant === 'foldover' ? (
          /* FOLD-OVER LABEL (8167 fold-over variant):
             The physical label is 1.75" × 0.5", folded along the CENTER VERTICAL line.
             Each folded half is 0.875" × 0.5" (aspect ~1.75:1).
             Left half = front (grade rotated 90° CW → right-side up when folded)
             Right half = back (QR rotated 90° CCW → right-side up when folded)
             Purple fold line sits on the toploader edge.
             Folded half width relative to toploader: 0.875" / 3.0" ≈ 29% */
          <div className="absolute" style={{ top: '0%', left: '35.5%', width: '29%' }}>
            {/* Thin purple fold crease at top — sits on the toploader edge */}
            <div className="rounded-t-[1px]" style={{ height: '3px', background: '#7c3aed' }} />
            {/* Visible folded half */}
            <div className="w-full rounded-b-[2px] overflow-hidden"
              style={{ aspectRatio: '1.75 / 1', boxShadow: '0 2px 5px rgba(0,0,0,0.15)' }}>
              {side === 'front' ? (
                /* FRONT: grade + condition, right-side up (after folding) */
                <div className="w-full h-full relative flex items-center justify-center"
                  style={{ background: 'linear-gradient(180deg, #ffffff, #f9fafb)' }}>
                  <WatermarkPattern />
                  <div className="text-center relative z-10">
                    <span className="text-[14px] font-bold leading-none" style={{ color: '#7c3aed' }}>{grade}</span>
                    {labelProps.condition && (
                      <div className="text-[5px] font-bold uppercase mt-[2px]" style={{ color: '#6b46c1' }}>
                        {labelProps.condition}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* BACK: QR code, right-side up (after folding) */
                <div className="w-full h-full relative flex items-center justify-center" style={{ background: '#ffffff' }}>
                  <WatermarkPattern />
                  <div className="relative z-10"><QRPlaceholder size={18} /></div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* STANDARD FRONT+BACK PAIR (8167):
             Label: 1.75" × 0.5" (aspect 3.5:1)
             Width relative to toploader: 1.75" / 3.0" ≈ 58% */
          <div className="absolute" style={{ top: '0%', left: '21%', width: '58%' }}>
            {side === 'front' ? (
              /* FRONT: accent bar | logo | card name | divider | grade */
              <div className="w-full rounded-b-[2px] overflow-hidden flex items-stretch"
                style={{ aspectRatio: '3.5 / 1', background: '#ffffff', boxShadow: '0 2px 5px rgba(0,0,0,0.15)', border: '0.5px solid #e5e7eb' }}>
                <div className="w-[3px] flex-shrink-0" style={{ background: '#7c3aed' }} />
                <div className="flex items-center px-[3px] flex-shrink-0">
                  <img src="/DCM-logo.png" alt="" className="h-[12px] w-auto" />
                </div>
                <div className="flex-1 min-w-0 flex items-center px-[2px]">
                  <span className="text-[5px] text-gray-700 font-medium truncate">{labelProps.displayName}</span>
                </div>
                <div className="w-[0.5px] my-[2px] flex-shrink-0" style={{ background: 'rgba(124,58,237,0.3)' }} />
                <div className="flex flex-col items-center justify-center px-[4px] flex-shrink-0">
                  <span className="text-[9px] font-bold leading-none" style={{ color: '#7c3aed' }}>{grade}</span>
                  <div className="mt-[0.5px]" style={{ width: '7px', height: '0.5px', background: '#7c3aed' }} />
                  {labelProps.condition && (
                    <span className="text-[3px] font-bold uppercase" style={{ color: '#6b46c1' }}>{labelProps.condition}</span>
                  )}
                </div>
              </div>
            ) : (
              /* BACK: centered QR with dense DCM logo grid filling the label */
              <div className="w-full rounded-b-[2px] overflow-hidden relative"
                style={{ aspectRatio: '3.5 / 1', background: '#ffffff', boxShadow: '0 2px 5px rgba(0,0,0,0.15)', border: '0.5px solid #e5e7eb' }}>
                <DenseLogoGrid />
                <div className="absolute inset-0 flex items-center justify-center">
                  <QRPlaceholder size={14} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <SideToggle side={side} onToggle={setSide} />
    </div>
  )
}

// ============================================================================
// 3. ONE-TOUCH MAGNETIC — Real photo background with card composited
//    Photo: 314×457px (aspect 0.687)
//    Card area: inset ~10% left, ~12% top, ~80% width, ~78% height
//    Avery 6871: 2.375" × 1.25" folds over top edge
//    Visible half: 2.375" × 0.625" (ratio ~3.8:1)
//    Purple bar sits at fold line (top edge of case)
//    Label width relative to case: ~79% (2.375 / 3.0)
// ============================================================================

function OneTouchMockup({ card, labelProps }: {
  card: LabelMockupProps['card']
  labelProps: LabelMockupProps['labelProps']
}) {
  const [side, setSide] = useState<'front' | 'back'>('front')
  const cardImage = side === 'front' ? card.front_url : card.back_url
  const grade = gradeStr(labelProps.grade, labelProps.isAlteredAuthentic)

  /* Avery 6871: 2.375" × 1.25" folds over the top edge.
     Visible half on each side: 2.375" × 0.625" (ratio ~3.8:1).
     One-touch holder width: ~3.0". Label width ratio: 2.375/3.0 ≈ 79%.
     Reduced to ~65% for visual balance. Purple fold line = thin strip at top. */

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-full max-w-[200px] relative" style={{ aspectRatio: '314 / 457' }}>
        {/* One-touch photo background */}
        <img
          src="/labels/mag-one-touch-DCM.png"
          alt="Magnetic One-Touch"
          className="absolute inset-0 w-full h-full object-contain"
        />

        {/* Card image composited inside the one-touch holder */}
        <div className="absolute" style={{ left: '11%', top: '13%', width: '78%', height: '76%' }}>
          {cardImage ? (
            <img src={cardImage} alt={card.card_name || 'Card'}
              className="w-full h-full object-contain" loading="lazy" />
          ) : (
            <div className="w-full h-full" />
          )}
        </div>

        {/* Label folded over the top edge of the case */}
        <div className="absolute" style={{ top: '0%', left: '17.5%', width: '65%' }}>
          {/* Thin purple fold crease — sits on the case edge, no text */}
          <div className="rounded-t-[1px]" style={{ height: '3px', background: '#7c3aed' }} />

          {/* Visible label half — 2.375" × 0.625" (ratio ~3.8:1) */}
          <div className="w-full overflow-hidden rounded-b-[2px]"
            style={{ boxShadow: '0 3px 8px rgba(0,0,0,0.2)' }}>
            {side === 'front' ? (
              /* FRONT: logo + card info + grade (bottom half of unfolded 6871) */
              <div className="w-full flex items-center gap-[3px] px-[4px]"
                style={{ aspectRatio: '3.8 / 1', background: '#ffffff' }}>
                <img src="/DCM-logo.png" alt="" className="h-[12px] w-[12px] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[5px] font-semibold text-gray-900 leading-tight truncate">{labelProps.displayName}</div>
                  <div className="text-[3.5px] text-gray-500 leading-tight truncate">{labelProps.setLineText}</div>
                  {labelProps.features.length > 0 && (
                    <div className="text-[3.5px] font-medium leading-tight truncate" style={{ color: '#2563eb' }}>
                      {labelProps.features.join(' • ')}
                    </div>
                  )}
                  <div className="text-[3px] font-mono text-gray-400 leading-tight">{labelProps.serial}</div>
                </div>
                <div className="flex-shrink-0 text-center px-[2px]">
                  <div className="text-[9px] font-bold leading-none" style={{ color: '#7c3aed' }}>{grade}</div>
                  <div className="mt-[0.5px] mx-auto" style={{ width: '8px', height: '0.5px', background: '#7c3aed' }} />
                  {labelProps.condition && (
                    <div className="text-[3px] font-bold uppercase mt-[0.5px]" style={{ color: '#6b46c1' }}>
                      {labelProps.condition}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* BACK: QR code centered + rotated DCM logo (top half of unfolded 6871) */
              <div className="w-full flex items-center justify-center gap-1"
                style={{ aspectRatio: '3.8 / 1', background: '#ffffff' }}>
                <QRPlaceholder size={16} />
                <img src="/DCM-logo.png" alt="" className="h-[10px] w-auto opacity-25" />
              </div>
            )}
          </div>
        </div>
      </div>
      <SideToggle side={side} onToggle={setSide} />
    </div>
  )
}

// ============================================================================
// 4. CARD IMAGE — Digital download
//    800 × 1328px (label=220px, sep=8px, card=1100px)
//    Label:card ratio = 220:1100 = 1:5
// ============================================================================

function CardImageMockup({ card, labelProps, backLabelProps, style }: {
  card: LabelMockupProps['card']
  labelProps: LabelMockupProps['labelProps']
  backLabelProps: LabelMockupProps['backLabelProps']
  style: 'modern' | 'traditional'
}) {
  const [side, setSide] = useState<'front' | 'back'>('front')
  const cardImage = side === 'front' ? card.front_url : card.back_url
  const isModern = style === 'modern'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-full max-w-[200px] rounded-[6px] overflow-hidden"
        style={{
          padding: '3px',
          background: isModern
            ? 'linear-gradient(180deg, #1a1625, #2d1f47, #1a1625)'
            : 'linear-gradient(180deg, #9333ea, #6b21a8, #a855f7, #7c3aed, #581c87)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
        <div className="rounded-[4px] overflow-hidden flex flex-col">
          {/* Label — forced to 3.5:1 */}
          <div className="w-full overflow-hidden flex-shrink-0">
            {side === 'front'
              ? <SlabFrontLabel labelProps={labelProps} style={isModern ? 'modern' : 'traditional'} />
              : <SlabBackLabel labelProps={labelProps} backLabelProps={backLabelProps} style={isModern ? 'modern' : 'traditional'} />
            }
          </div>
          {/* Separator */}
          <div className="flex-shrink-0" style={{
            height: '2px',
            background: isModern
              ? 'linear-gradient(90deg, #1a1625, #2d1f47, #1a1625)'
              : 'linear-gradient(90deg, #9333ea, #6b21a8, #a855f7, #7c3aed)',
          }} />
          {/* Card */}
          <div className="w-full overflow-hidden">
            {cardImage ? (
              <img src={cardImage} alt={card.card_name || 'Card'} className="w-full block"
                style={{ aspectRatio: '2.5 / 3.5', objectFit: 'contain' }} loading="lazy" />
            ) : (
              <div className="w-full" style={{ aspectRatio: '2.5 / 3.5', background: '#e5e7eb' }}>
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-gray-400 text-[9px]">No image</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <SideToggle side={side} onToggle={setSide} />
    </div>
  )
}

// ============================================================================
// SHARED
// ============================================================================

function SideToggle({ side, onToggle }: { side: 'front' | 'back'; onToggle: (s: 'front' | 'back') => void }) {
  return (
    <div className="flex gap-1">
      <button onClick={() => onToggle('front')}
        className={`text-xs px-2 py-0.5 rounded transition-colors ${side === 'front' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
        Front
      </button>
      <button onClick={() => onToggle('back')}
        className={`text-xs px-2 py-0.5 rounded transition-colors ${side === 'back' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
        Back
      </button>
    </div>
  )
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export function LabelMockup({ card, labelType, labelProps, backLabelProps }: LabelMockupProps) {
  const style = labelType.style || 'modern'
  switch (labelType.category) {
    case 'slab':
      return <GradedSlabMockup card={card} labelProps={labelProps} backLabelProps={backLabelProps} style={style} />
    case 'onetouch':
      return <OneTouchMockup card={card} labelProps={labelProps} />
    case 'toploader':
      return <ToploaderMockup card={card} labelProps={labelProps} variant={labelType.downloadType === 'foldover' ? 'foldover' : 'front-back'} />
    case 'digital':
      return <CardImageMockup card={card} labelProps={labelProps} backLabelProps={backLabelProps} style={style} />
    default:
      return null
  }
}

export default LabelMockup
