import { View, Image, Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors } from '@/lib/constants'

/**
 * LabelMockup — Label Studio gallery preview tile.
 *
 * Direct port of src/components/labels/LabelMockup.tsx. Each holder uses the
 * same photo background the user gets when downloading, and overlays inline
 * native components for the label. Real QR codes (via api.qrserver.com) are
 * shown on every back label and on the toploader 8167 / one-touch back +
 * foldover back, mirroring web's QRCodeCanvas/QRPlaceholder.
 *
 * Holder PNG aspect ratios:
 *   Slab:        280 / 460
 *   One-Touch:   314 / 457
 *   Toploader:   451 / 588
 */

export type LabelTypeId =
  | 'slab-modern'
  | 'slab-traditional'
  | 'onetouch'
  | 'toploader'
  | 'foldover'
  | 'card-image-modern'
  | 'card-image-traditional'
  | 'custom'

type Holder = 'slab' | 'onetouch' | 'toploader' | 'digital'

const HOLDER_BY_TYPE: Record<LabelTypeId, Holder> = {
  'slab-modern': 'slab',
  'slab-traditional': 'slab',
  'custom': 'slab',
  'onetouch': 'onetouch',
  'toploader': 'toploader',
  'foldover': 'toploader',
  'card-image-modern': 'digital',
  'card-image-traditional': 'digital',
}

export interface LabelInlineProps {
  displayName: string
  setLineText: string
  features: string[]
  serial: string
  grade: number | null
  condition: string
  isAlteredAuthentic?: boolean
  subScores?: { centering: number; corners: number; edges: number; surface: number }
  qrUrl?: string
}

export interface LabelEmblems {
  showFounderEmblem?: boolean
  showVipEmblem?: boolean
  showCardLoversEmblem?: boolean
}

export interface CustomColorOverrides {
  /** Slab label background gradient stops. */
  labelGradient?: string[]
  /** Slab frame gradient (digital card-image only). */
  frameGradient?: string[]
  /** Layout selector — affects how the gradient/border/pattern is drawn. */
  layoutStyle?: 'color-gradient' | 'card-extension' | 'neon-outline' | 'geometric' | 'team-colors' | string
  /** Top-edge gradient stops for card-extension. */
  topEdgeGradient?: string[]
  /** Whether the label has a visible border (auto-on for neon-outline). */
  borderEnabled?: boolean
  borderColor?: string
  /** Gradient sweep direction in degrees (0=horizontal, 90=down, 135=diag). */
  gradientAngle?: number
  /** Geometric pattern variant (0-4) per GEOMETRIC_PATTERNS. */
  geometricPattern?: number
}

interface LabelMockupProps {
  labelType: LabelTypeId
  cardImageUrl?: string | null
  cardBackImageUrl?: string | null
  width?: number
  labelProps?: LabelInlineProps
  side?: 'front' | 'back'
  emblems?: LabelEmblems
  /** Used when labelType === 'custom' to apply user-edited colors. */
  customOverrides?: CustomColorOverrides
}

export default function LabelMockup({
  labelType,
  cardImageUrl,
  cardBackImageUrl,
  width = 200,
  labelProps,
  side = 'front',
  emblems,
  customOverrides,
}: LabelMockupProps) {
  const holder = HOLDER_BY_TYPE[labelType] ?? 'slab'
  const cardSrc = side === 'back' ? (cardBackImageUrl || cardImageUrl) : cardImageUrl
  const styleFor = (t: LabelTypeId): SlabStyle => {
    if (t === 'slab-traditional' || t === 'card-image-traditional') return 'traditional'
    if (t === 'custom') return 'custom'
    return 'modern'
  }

  if (holder === 'slab') {
    return (
      <SlabMockup
        cardImageUrl={cardSrc}
        width={width}
        labelProps={labelProps}
        side={side}
        slabStyle={styleFor(labelType)}
        emblems={emblems}
        customOverrides={customOverrides}
      />
    )
  }
  if (holder === 'onetouch') {
    return <OneTouchMockup cardImageUrl={cardSrc} width={width} labelProps={labelProps} side={side} emblems={emblems} />
  }
  if (holder === 'toploader') {
    return (
      <ToploaderMockup
        cardImageUrl={cardSrc}
        width={width}
        variant={labelType === 'foldover' ? 'foldover' : 'front-back'}
        labelProps={labelProps}
        side={side}
        emblems={emblems}
      />
    )
  }
  return (
    <DigitalMockup
      cardImageUrl={cardSrc}
      width={width}
      labelProps={labelProps}
      side={side}
      slabStyle={styleFor(labelType)}
      emblems={emblems}
    />
  )
}

// ============================================================================
// HELPERS
// ============================================================================

type SlabStyle = 'modern' | 'traditional' | 'custom'

function gradeStr(grade: number | null | undefined, alt?: boolean): string {
  if (grade !== null && grade !== undefined) return Math.round(grade).toString()
  return alt ? 'A' : 'N/A'
}

/** Real QR code rendered via api.qrserver.com — same approach SlabCard uses
 *  for the card detail page. Black-on-white QR. */
function buildQrUrl(target: string | undefined, sizePx: number): string | null {
  if (!target) return null
  const px = Math.max(40, Math.min(480, Math.round(sizePx)))
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(target)}&size=${px}x${px}&format=png&ecc=H&margin=0`
}

function RealQR({ qrUrl, size }: { qrUrl?: string; size: number }) {
  const src = buildQrUrl(qrUrl, size * 2)
  if (!src) {
    return (
      <View style={{ width: size, height: size, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.gray[300] }}>
        <Text style={{ fontSize: size * 0.18, color: Colors.gray[400] }}>QR</Text>
      </View>
    )
  }
  return (
    <View style={{ width: size, height: size, backgroundColor: '#fff', padding: 1, borderRadius: 1 }}>
      <Image source={{ uri: src }} style={{ width: size - 2, height: size - 2 }} resizeMode="contain" />
    </View>
  )
}

// ============================================================================
// INLINE SLAB LABEL (shared by SlabMockup + DigitalMockup)
//
// Mirrors web's SlabFrontLabel/SlabBackLabel (LabelMockup.tsx:109-364), scaled
// proportionally to the passed width since RN doesn't support cqw units.
// Web's font-size 6cqw becomes width * 0.06, etc. Maintains 3.5:1 aspect.
// ============================================================================

const MODERN_LABEL_GRADIENT: readonly string[] = ['#1a1625', '#2d1f47', '#1a1625']
const TRADITIONAL_LABEL_GRADIENT: readonly string[] = ['#f9fafb', '#ffffff', '#f9fafb']

function getLabelGradient(slabStyle: SlabStyle, customOverrides?: CustomColorOverrides): readonly string[] {
  if (slabStyle === 'custom' && customOverrides?.labelGradient && customOverrides.labelGradient.length >= 2) {
    return customOverrides.labelGradient
  }
  if (slabStyle === 'traditional') return TRADITIONAL_LABEL_GRADIENT
  return MODERN_LABEL_GRADIENT
}

/** Whether the label should use light text (over a dark bg). For custom, infer
 *  from the gradient — if the average is dark, use light text. */
function isDarkSlab(slabStyle: SlabStyle, customOverrides?: CustomColorOverrides): boolean {
  if (slabStyle === 'modern') return true
  if (slabStyle === 'traditional') return false
  // Custom: read luminance from first color of override
  const first = customOverrides?.labelGradient?.[0]
  if (!first) return true
  const m = /^#?([0-9a-f]{6})$/i.exec(first)
  if (!m) return true
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum < 0.6
}

/** Convert gradientAngle (degrees) to RN LinearGradient {start, end}.
 *  0° = horizontal left→right, 90° = top→bottom, 135° = diagonal. */
function angleToStartEnd(angle?: number): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const a = ((angle ?? 135) % 360 + 360) % 360
  const rad = (a * Math.PI) / 180
  const cx = 0.5, cy = 0.5
  const dx = Math.cos(rad), dy = Math.sin(rad)
  return {
    start: { x: cx - dx * 0.5, y: cy - dy * 0.5 },
    end:   { x: cx + dx * 0.5, y: cy + dy * 0.5 },
  }
}

/** Geometric pattern background — full-fill multi-color regions matching
 *  web's customSlabLabelGenerator (lines 227-410). Each variant REPLACES
 *  the gradient with its own pattern of colored regions; the pattern is the
 *  background, not an overlay. Colors cycle through the user's customColors
 *  palette so palette changes flow through to the preview live.
 *
 *    0 Shattered  — 9 colored sectors radiating from a focal point
 *    1 Stripes    — 7 diagonal bands (skewed parallelograms)
 *    2 Fractured  — 5 angled regions split by 4 dividers
 *    3 Mosaic     — 5×2 grid of solid color tiles
 *    4 Lightning  — zigzag bolt with banded background
 */
function GeometricBackground({ variant, width, height, palette }: { variant: number; width: number; height: number; palette: string[] }) {
  const pick = (i: number) => palette[((i % palette.length) + palette.length) % palette.length] || '#7c3aed'
  const divider = 'rgba(0,0,0,0.18)'

  // ---- 3 Mosaic — 5 cols × 2 rows of solid tiles -----------------
  if (variant === 3) {
    return (
      <View style={{ position: 'absolute', top: 0, left: 0, width, height, flexDirection: 'column' }}>
        {[0, 1].map(r => (
          <View key={r} style={{ flex: 1, flexDirection: 'row' }}>
            {[0, 1, 2, 3, 4].map(c => (
              <View key={c} style={{
                flex: 1,
                backgroundColor: pick(r * 5 + c),
                borderRightWidth: c < 4 ? StyleSheet.hairlineWidth : 0,
                borderBottomWidth: r < 1 ? StyleSheet.hairlineWidth : 0,
                borderColor: divider,
              }} />
            ))}
          </View>
        ))}
      </View>
    )
  }

  // ---- 1 Stripes — 7 diagonal bands using skewX -----------------
  if (variant === 1) {
    // Each band is a skewed rect spanning the full height, positioned with
    // a -30° skew so they fan diagonally. Render in an overflow:hidden
    // container so the skewed edges clip cleanly to the label rect.
    const stripeCount = 7
    const skewDeg = -22
    // Width of each unskewed band, then over-extend to cover the slanted top/bottom
    const bandW = (width + height * Math.tan((Math.abs(skewDeg) * Math.PI) / 180)) / stripeCount
    return (
      <View style={{ position: 'absolute', top: 0, left: 0, width, height, overflow: 'hidden' }}>
        {Array.from({ length: stripeCount }).map((_, i) => (
          <View key={i} style={{
            position: 'absolute',
            top: 0,
            left: i * bandW - height * 0.5,
            width: bandW + 1,
            height: height,
            backgroundColor: pick(i + 1),
            transform: [{ skewX: `${skewDeg}deg` }],
            borderRightWidth: StyleSheet.hairlineWidth,
            borderColor: divider,
          }} />
        ))}
      </View>
    )
  }

  // ---- 2 Fractured — 5 angled vertical-ish regions --------------
  if (variant === 2) {
    // 5 regions split by 3 angled dividers + 1 horizontal split on the
    // right portion. Approximated with skewed rects covering the label.
    const c5 = [pick(0), pick(1), pick(2), pick(3), pick(4)]
    const skew = -7
    return (
      <View style={{ position: 'absolute', top: 0, left: 0, width, height, overflow: 'hidden' }}>
        {/* Region 0 — far left narrow */}
        <View style={{ position: 'absolute', top: 0, left: -width * 0.04, width: width * 0.18, height, backgroundColor: c5[0], transform: [{ skewX: `${skew}deg` }] }} />
        {/* Region 1 — left-center */}
        <View style={{ position: 'absolute', top: 0, left: width * 0.12, width: width * 0.28, height, backgroundColor: c5[1], transform: [{ skewX: `${skew}deg` }] }} />
        {/* Region 2 — center */}
        <View style={{ position: 'absolute', top: 0, left: width * 0.38, width: width * 0.26, height, backgroundColor: c5[2], transform: [{ skewX: `${skew + 2}deg` }] }} />
        {/* Region 3 — upper right */}
        <View style={{ position: 'absolute', top: 0, left: width * 0.62, width: width * 0.4, height: height * 0.45, backgroundColor: c5[3] }} />
        {/* Region 4 — lower right */}
        <View style={{ position: 'absolute', top: height * 0.45, left: width * 0.62, width: width * 0.4, height: height * 0.55, backgroundColor: c5[4] }} />
        {/* Divider lines */}
        <View style={{ position: 'absolute', top: height * 0.45, left: width * 0.6, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: divider }} />
      </View>
    )
  }

  // ---- 4 Lightning — banded background with zigzag bolt --------
  if (variant === 4) {
    // Background: 5 horizontal bands; foreground: zigzag yellow/white bolt
    return (
      <View style={{ position: 'absolute', top: 0, left: 0, width, height, overflow: 'hidden' }}>
        {[0, 1, 2, 3, 4].map(i => (
          <View key={i} style={{
            position: 'absolute',
            top: (i * height) / 5,
            left: 0,
            right: 0,
            height: height / 5,
            backgroundColor: pick(i),
          }} />
        ))}
        {/* Bolt — 6 alternating-angle segments */}
        {[
          { t: 0.00, l: 0.30, a: 38 },
          { t: 0.20, l: 0.50, a: -42 },
          { t: 0.40, l: 0.32, a: 38 },
          { t: 0.55, l: 0.55, a: -42 },
          { t: 0.70, l: 0.40, a: 38 },
        ].map((seg, i) => (
          <View key={i} style={{
            position: 'absolute',
            top: seg.t * height,
            left: seg.l * width,
            width: width * 0.18,
            height: height * 0.20,
            backgroundColor: '#fef9c3',
            transform: [{ rotate: `${seg.a}deg` }],
            borderRadius: 1,
            shadowColor: '#fde047',
            shadowOpacity: 0.8,
            shadowRadius: 2,
            elevation: 3,
          }} />
        ))}
      </View>
    )
  }

  // ---- 0 Shattered — colored sectors radiating from a focal point.
  // Each shard is a thin rectangle whose center is placed along the
  // direction vector from the focal point so its inner edge meets that
  // point when rotated. 12 shards cover 360°. Background filled with the
  // first palette color so any sliver gaps blend naturally.
  const cx = width * 0.35, cy = height * 0.4
  const shardLen = Math.hypot(width, height)
  const shardThickness = Math.max(8, height * 0.5)
  const NUM_SHARDS = 12
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, width, height, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', top: 0, left: 0, width, height, backgroundColor: pick(0) }} />
      {Array.from({ length: NUM_SHARDS }).map((_, i) => {
        const angleDeg = (360 / NUM_SHARDS) * i
        const rad = (angleDeg * Math.PI) / 180
        const cxShard = cx + (shardLen / 2) * Math.cos(rad)
        const cyShard = cy + (shardLen / 2) * Math.sin(rad)
        return (
          <View key={i} style={{
            position: 'absolute',
            left: cxShard - shardLen / 2,
            top: cyShard - shardThickness / 2,
            width: shardLen,
            height: shardThickness,
            backgroundColor: pick(i + 1),
            transform: [{ rotate: `${angleDeg}deg` }],
            borderTopWidth: StyleSheet.hairlineWidth,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderColor: divider,
          }} />
        )
      })}
    </View>
  )
}

/** Layout-aware background. Renders the appropriate visual for each
 *  layoutStyle on top of the slab dimensions. Children are positioned over
 *  the background. Mirrors web's slabLabelGenerator + customSlabLabelGenerator
 *  pattern handling — approximates canvas effects using LinearGradient + View
 *  overlays since RN doesn't have a 2D canvas. */
function SlabBackground({
  width,
  height,
  slabStyle,
  customOverrides,
  children,
}: {
  width: number
  height: number
  slabStyle: SlabStyle
  customOverrides?: CustomColorOverrides
  children: React.ReactNode
}) {
  const layout = customOverrides?.layoutStyle
  const gradient = getLabelGradient(slabStyle, customOverrides)
  const angle = customOverrides?.gradientAngle ?? 135
  const { start, end } = angleToStartEnd(angle)
  const colors = (gradient as string[]).length >= 2 ? gradient : [...gradient, gradient[gradient.length - 1]]

  // team-colors / split — two halves side-by-side using the first 2 customColors
  if (slabStyle === 'custom' && layout === 'team-colors') {
    const c1 = (gradient as string[])[0] || '#7c3aed'
    const c2 = (gradient as string[])[1] || '#4c1d95'
    return (
      <View style={{ width, height, flexDirection: 'row', overflow: 'hidden' }}>
        <View style={{ flex: 1, backgroundColor: c1 }} />
        <View style={{ flex: 1, backgroundColor: c2 }} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>{children}</View>
      </View>
    )
  }

  // neon-outline — dark gradient + visible accent border using borderColor
  if (slabStyle === 'custom' && layout === 'neon-outline') {
    const accent = customOverrides?.borderColor || (gradient as string[])[0] || '#7c3aed'
    return (
      <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#0a0a0a'] as any} start={start} end={end}
        style={{ width, height, borderWidth: 2, borderColor: accent, overflow: 'hidden' }}>
        {children}
      </LinearGradient>
    )
  }

  // card-extension — multi-stop gradient using topEdgeGradient
  if (slabStyle === 'custom' && layout === 'card-extension' && customOverrides?.topEdgeGradient && customOverrides.topEdgeGradient.length >= 2) {
    return (
      <LinearGradient colors={customOverrides.topEdgeGradient as any} start={start} end={end}
        style={{ width, height, overflow: 'hidden' }}>
        {children}
      </LinearGradient>
    )
  }

  // geometric — full-fill multi-color regions (NOT a gradient + overlay).
  // Web's customSlabLabelGenerator (lines 227-410) replaces the gradient with
  // a multi-region pattern that fills the entire label. Mobile mirrors that:
  //   0 Shattered, 1 Stripes, 2 Fractured, 3 Mosaic, 4 Lightning
  if (slabStyle === 'custom' && layout === 'geometric') {
    const variant = customOverrides?.geometricPattern ?? 0
    // Use customColors as the full palette (5+ colors); fall back to the
    // 2-color gradient if the user hasn't picked a custom palette.
    const palette = (gradient as string[]).length >= 2 ? (gradient as string[]) : ['#7c3aed', '#4c1d95']
    return (
      <View style={{ width, height, overflow: 'hidden' }}>
        <GeometricBackground variant={variant} width={width} height={height} palette={palette} />
        {children}
      </View>
    )
  }

  // Default — color-gradient / rainbow / modern / traditional / single-color presets
  return (
    <LinearGradient colors={colors as any} start={start} end={end} style={{ width, height, overflow: 'hidden' }}>
      {children}
    </LinearGradient>
  )
}

function SlabFrontInline({ width, labelProps, slabStyle, customOverrides }: { width: number; labelProps?: LabelInlineProps; slabStyle: SlabStyle; customOverrides?: CustomColorOverrides }) {
  const grade = gradeStr(labelProps?.grade ?? null, labelProps?.isAlteredAuthentic)
  const dark = isDarkSlab(slabStyle, customOverrides)

  const nameColor = dark ? 'rgba(255,255,255,0.95)' : '#1f2937'
  const contextColor = dark ? 'rgba(255,255,255,0.7)' : '#4b5563'
  const featuresColor = dark ? 'rgba(34,197,94,0.9)' : '#2563eb'
  const serialColor = dark ? 'rgba(255,255,255,0.5)' : '#6b7280'
  const gradeColor = dark ? '#ffffff' : '#7c3aed'
  const conditionColor = dark ? 'rgba(255,255,255,0.8)' : '#6b46c1'

  // Web's font sizes are cqw — scale to width. Slightly larger than web's
  // cqw values since RN can't auto-shrink to fit the container; we leave
  // headroom by allowing the name to wrap to 2 lines.
  const nameLen = (labelProps?.displayName || '').length
  const namePct = nameLen <= 14 ? 0.072 : nameLen <= 20 ? 0.062 : nameLen <= 30 ? 0.054 : 0.048

  const condition = labelProps?.isAlteredAuthentic && labelProps?.grade === null
    ? 'AUTHENTIC' : (labelProps?.condition || '').toUpperCase()

  const height = width / 3.5

  return (
    <SlabBackground width={width} height={height} slabStyle={slabStyle} customOverrides={customOverrides}>
      <View style={{ width: '100%', height: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: width * 0.03, paddingVertical: height * 0.06 }}>
        {/* LEFT: DCM logo (12% width) */}
        <View style={{ width: width * 0.12, alignItems: 'center', justifyContent: 'center' }}>
          <Image
            source={require('@/assets/images/dcm-logo.png')}
            style={{ width: width * 0.10, height: width * 0.10, opacity: dark ? 0.95 : 1 }}
            resizeMode="contain"
            tintColor={dark ? 'rgba(255,255,255,0.9)' : undefined}
          />
        </View>

        {/* CENTER: card info — name wraps to 2 lines like web's
            WebkitLineClamp:2; other lines stay single-line. */}
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: width * 0.015 }}>
          <Text style={{ fontSize: width * namePct, lineHeight: width * namePct * 1.05, fontWeight: '600', color: nameColor }} numberOfLines={2}>
            {labelProps?.displayName || 'Card Name'}
          </Text>
          {!!labelProps?.setLineText && (
            <Text style={{ fontSize: width * namePct * 0.76, lineHeight: width * namePct * 0.76 * 1.1, color: contextColor }} numberOfLines={1}>
              {labelProps.setLineText}
            </Text>
          )}
          {labelProps && labelProps.features.length > 0 && (
            <Text style={{ fontSize: width * namePct * 0.7, lineHeight: width * namePct * 0.7 * 1.1, fontWeight: '500', color: featuresColor }} numberOfLines={1}>
              {labelProps.features.join(' • ')}
            </Text>
          )}
          {!!labelProps?.serial && (
            <Text style={{ fontSize: width * namePct * 0.7, lineHeight: width * namePct * 0.7 * 1.1, fontFamily: 'Courier', color: serialColor }} numberOfLines={1}>
              {labelProps.serial}
            </Text>
          )}
        </View>

        {/* RIGHT: grade + condition (18% width) */}
        <View style={{ width: width * 0.18, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: width * 0.12, fontWeight: 'bold', lineHeight: width * 0.12, color: gradeColor }}>{grade}</Text>
          {!dark && <View style={{ width: width * 0.10, height: 1, backgroundColor: '#7c3aed', marginTop: 1 }} />}
          {!!condition && (
            <Text style={{ fontSize: width * 0.03, fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center', marginTop: 1, color: conditionColor, letterSpacing: 0.3 }} numberOfLines={1}>
              {condition}
            </Text>
          )}
        </View>
      </View>
    </SlabBackground>
  )
}

function SlabBackInline({ width, labelProps, slabStyle, customOverrides, emblems }: { width: number; labelProps?: LabelInlineProps; slabStyle: SlabStyle; customOverrides?: CustomColorOverrides; emblems?: LabelEmblems }) {
  const grade = gradeStr(labelProps?.grade ?? null, labelProps?.isAlteredAuthentic)
  const dark = isDarkSlab(slabStyle, customOverrides)
  const gradeColor = dark ? '#ffffff' : '#7c3aed'
  const conditionColor = dark ? 'rgba(255,255,255,0.8)' : '#6b46c1'
  const subScoreColor = dark ? 'rgba(255,255,255,0.9)' : '#4b5563'
  const subScores = labelProps?.subScores

  const condition = labelProps?.isAlteredAuthentic && labelProps?.grade === null
    ? 'AUTHENTIC' : (labelProps?.condition || '').toUpperCase()

  const qrSize = width * 0.16
  const showAnyEmblem = !!(emblems?.showFounderEmblem || emblems?.showVipEmblem || emblems?.showCardLoversEmblem)
  const labelHeight = width / 3.5

  return (
    <SlabBackground width={width} height={labelHeight} slabStyle={slabStyle} customOverrides={customOverrides}>
      <View style={{ width: '100%', height: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: width * 0.03, paddingVertical: labelHeight * 0.06 }}>
        {/* LEFT: QR code (18% width) */}
        <View style={{ width: width * 0.18, alignItems: 'center', justifyContent: 'center' }}>
          <RealQR qrUrl={labelProps?.qrUrl} size={qrSize} />
        </View>

        {/* MIDDLE: emblems (vertical) */}
        {showAnyEmblem && (
          <View style={{ flexDirection: 'row', alignItems: 'center', height: '100%', paddingVertical: 2 }}>
            {emblems?.showFounderEmblem && <VerticalEmblem icon="★" iconColor="#FFD700" label="Founder" textColor={dark ? '#ffffff' : '#7c3aed'} width={width} />}
            {emblems?.showCardLoversEmblem && <VerticalEmblem icon="♥" iconColor="#f43f5e" label="Card Lover" textColor={dark ? '#ffffff' : '#f43f5e'} width={width} />}
            {emblems?.showVipEmblem && <VerticalEmblem icon="◆" iconColor="#6366f1" label="VIP" textColor={dark ? '#ffffff' : '#6366f1'} width={width} />}
          </View>
        )}

        {/* CENTER: large grade + condition */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: width * 0.12, fontWeight: 'bold', lineHeight: width * 0.12, color: gradeColor }}>{grade}</Text>
          {!!condition && (
            <Text style={{ fontSize: width * 0.03, fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center', marginTop: 1, color: conditionColor, letterSpacing: 0.3 }} numberOfLines={1}>
              {condition}
            </Text>
          )}
        </View>

        {/* RIGHT: sub-scores (22% width) — show full names per web */}
        {subScores && (
          <View style={{ width: width * 0.22, justifyContent: 'center' }}>
            {([
              ['Centering', subScores.centering],
              ['Corners', subScores.corners],
              ['Edges', subScores.edges],
              ['Surface', subScores.surface],
            ] as const).map(([key, val]) => (
              <Text key={key} style={{ fontSize: width * 0.035, lineHeight: width * 0.035 * 1.5, color: subScoreColor, textAlign: 'right' }} numberOfLines={1}>
                {key}: {Math.round(val)}
              </Text>
            ))}
          </View>
        )}
      </View>
    </SlabBackground>
  )
}

function VerticalEmblem({ icon, iconColor, label, textColor, width }: { icon: string; iconColor: string; label: string; textColor: string; width: number }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 1, height: '100%', paddingVertical: 2 }}>
      <Text style={{ fontSize: width * 0.05, lineHeight: width * 0.05, color: iconColor }}>{icon}</Text>
      <View style={{ width: width * 0.025, height: width * 0.18, marginTop: 1 }}>
        <Text
          style={{
            fontSize: width * 0.025,
            fontWeight: '600',
            color: textColor,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
            position: 'absolute',
            width: width * 0.18,
            textAlign: 'center',
            transform: [{ rotate: '-90deg' }],
            top: width * 0.08,
            left: -width * 0.08,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </View>
  )
}

// ============================================================================
// Graded Slab — photo 280×460
// Slot percentages measured from public/labels/graded-card-slab.png:
//   Label slot: top 5.4% left 8.9% width 81.4% height 15.2%
//   Card window: top 28.3% left 11.8% width 75.7% height 60.9%
// ============================================================================
function SlabMockup({ cardImageUrl, width, labelProps, side, slabStyle, emblems, customOverrides }: { cardImageUrl?: string | null; width: number; labelProps?: LabelInlineProps; side: 'front' | 'back'; slabStyle: SlabStyle; emblems?: LabelEmblems; customOverrides?: CustomColorOverrides }) {
  const height = (width * 460) / 280
  const labelTop = height * 0.054, labelLeft = width * 0.089, labelW = width * 0.814, labelH = height * 0.152
  const cardTop = height * 0.283, cardLeft = width * 0.118, cardW = width * 0.757, cardH = height * 0.609
  return (
    <View style={[s.holder, { width, height }]}>
      <Image source={require('@/assets/images/graded-card-slab.png')} style={{ width, height }} resizeMode="contain" />

      {/* Label slot — render inline modern/traditional/custom slab label */}
      <View style={[s.slot, { top: labelTop, left: labelLeft, width: labelW, height: labelH }]}>
        {side === 'front'
          ? <SlabFrontInline width={labelW} labelProps={labelProps} slabStyle={slabStyle} customOverrides={customOverrides} />
          : <SlabBackInline width={labelW} labelProps={labelProps} slabStyle={slabStyle} customOverrides={customOverrides} emblems={emblems} />}
      </View>

      {/* Card window */}
      <View style={[s.slot, { top: cardTop, left: cardLeft, width: cardW, height: cardH }]}>
        {cardImageUrl
          ? <Image source={{ uri: cardImageUrl }} style={{ width: cardW, height: cardH }} resizeMode="contain" />
          : <View style={{ width: cardW, height: cardH, backgroundColor: Colors.gray[100] }} />}
      </View>
    </View>
  )
}

// ============================================================================
// One-Touch — photo 314×457
// ============================================================================
function OneTouchMockup({ cardImageUrl, width, labelProps, side, emblems }: { cardImageUrl?: string | null; width: number; labelProps?: LabelInlineProps; side: 'front' | 'back'; emblems?: LabelEmblems }) {
  const height = (width * 457) / 314
  const labelWidth = width * 0.65
  const cardTop = height * 0.13, cardLeft = width * 0.11, cardW = width * 0.78, cardH = height * 0.76
  const labelLeft = width * 0.175
  return (
    <View style={[s.holder, { width, height }]}>
      <Image source={require('@/assets/images/mag-one-touch-DCM.png')} style={{ width, height }} resizeMode="contain" />

      <View style={[s.slot, { top: cardTop, left: cardLeft, width: cardW, height: cardH }]}>
        {cardImageUrl
          ? <Image source={{ uri: cardImageUrl }} style={{ width: cardW, height: cardH }} resizeMode="contain" />
          : <View style={{ width: cardW, height: cardH, backgroundColor: Colors.gray[100] }} />}
      </View>

      <View style={[s.slot, { top: 0, left: labelLeft, width: labelWidth }]}>
        <View style={s.foldCrease} />
        {side === 'front'
          ? <SlabFrontInline width={labelWidth} labelProps={labelProps} slabStyle="modern" />
          : <SlabBackInline width={labelWidth} labelProps={labelProps} slabStyle="modern" emblems={emblems} />}
      </View>
    </View>
  )
}

// ============================================================================
// Toploader — photo 451×588
// ============================================================================
function ToploaderMockup({ cardImageUrl, width, variant, labelProps, side, emblems }: { cardImageUrl?: string | null; width: number; variant: 'front-back' | 'foldover'; labelProps?: LabelInlineProps; side: 'front' | 'back'; emblems?: LabelEmblems }) {
  const height = (width * 588) / 451
  const labelWidth = width * (variant === 'foldover' ? 0.29 : 0.58)
  const cardTop = height * 0.045, cardLeft = width * 0.07, cardW = width * 0.86, cardH = height * 0.90
  const labelLeft = width * (variant === 'foldover' ? 0.355 : 0.21)
  return (
    <View style={[s.holder, { width, height }]}>
      <Image source={require('@/assets/images/top-loader-dcm.png')} style={{ width, height }} resizeMode="contain" />

      <View style={[s.slot, { top: cardTop, left: cardLeft, width: cardW, height: cardH }]}>
        {cardImageUrl
          ? <Image source={{ uri: cardImageUrl }} style={{ width: cardW, height: cardH, borderRadius: 2 }} resizeMode="contain" />
          : <View style={{ width: cardW, height: cardH, backgroundColor: Colors.gray[100] }} />}
      </View>

      {variant === 'foldover' ? (
        <View style={[s.slot, { top: 0, left: labelLeft, width: labelWidth }]}>
          <View style={s.foldCrease} />
          <View style={{ width: '100%', aspectRatio: 1.75, overflow: 'hidden' }}>
            {side === 'front'
              ? <SlabFrontInline width={labelWidth} labelProps={labelProps} slabStyle="modern" />
              : <SlabBackInline width={labelWidth} labelProps={labelProps} slabStyle="modern" emblems={emblems} />}
          </View>
        </View>
      ) : (
        <View style={[s.slot, { top: 0, left: labelLeft, width: labelWidth }]}>
          {side === 'front'
            ? <SlabFrontInline width={labelWidth} labelProps={labelProps} slabStyle="modern" />
            : <SlabBackInline width={labelWidth} labelProps={labelProps} slabStyle="modern" emblems={emblems} />}
        </View>
      )}
    </View>
  )
}

// ============================================================================
// INLINE LABELS — every gallery preview reuses the same SlabFrontInline /
// SlabBackInline used by the slab tile so users see the FULL card details
// (name, set, features, serial, grade, sub-scores) on every label type
// regardless of holder. The actual downloaded PDF still gets generated as
// the proper compact Avery sticker format from the web export pipeline.
// ============================================================================

// ============================================================================
// Card Image (digital) — gradient frame + slab front/back label + card.
// Mirrors src/components/labels/LabelMockup.tsx:643-695 (CardImageMockup):
//   Modern frame:      ['#1a1625','#2d1f47','#1a1625']
//   Traditional frame: ['#9333ea','#6b21a8','#a855f7','#7c3aed','#581c87']
// ============================================================================
function DigitalMockup({ cardImageUrl, width, labelProps, side, slabStyle, emblems }: { cardImageUrl?: string | null; width: number; labelProps?: LabelInlineProps; side: 'front' | 'back'; slabStyle: SlabStyle; emblems?: LabelEmblems }) {
  const isModern = slabStyle === 'modern'
  const frameColors = isModern
    ? ['#1a1625', '#2d1f47', '#1a1625']
    : ['#9333ea', '#6b21a8', '#a855f7', '#7c3aed', '#581c87']
  const sepColors = isModern
    ? ['#1a1625', '#2d1f47', '#1a1625']
    : ['#9333ea', '#6b21a8', '#a855f7', '#7c3aed']
  const inner = width - 6
  return (
    <View style={{ width, alignSelf: 'center' }}>
      <LinearGradient
        colors={frameColors as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ padding: 3, borderRadius: 6 }}
      >
        <View style={{ width: inner, overflow: 'hidden', borderRadius: 4, backgroundColor: '#0a0a12' }}>
          {/* Slab label (3.5:1) — front/back follows side toggle */}
          <View style={{ width: '100%', overflow: 'hidden' }}>
            {side === 'front'
              ? <SlabFrontInline width={inner} labelProps={labelProps} slabStyle={slabStyle} />
              : <SlabBackInline width={inner} labelProps={labelProps} slabStyle={slabStyle} emblems={emblems} />}
          </View>
          {/* Separator */}
          <LinearGradient
            colors={sepColors as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 2 }}
          />
          {/* Card */}
          <View style={{ width: '100%', aspectRatio: 2.5 / 3.5, backgroundColor: '#0a0a12' }}>
            {cardImageUrl
              ? <Image source={{ uri: cardImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              : null}
          </View>
        </View>
      </LinearGradient>
    </View>
  )
}

const s = StyleSheet.create({
  holder: { alignSelf: 'center', position: 'relative', overflow: 'hidden' },
  slot: { position: 'absolute', overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  foldCrease: { height: 3, backgroundColor: '#7c3aed', borderTopLeftRadius: 1, borderTopRightRadius: 1 },
})
