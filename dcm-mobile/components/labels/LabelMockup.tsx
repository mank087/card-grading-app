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
  /** ['#start', '#mid', '#end'] for the slab label background gradient. */
  labelGradient?: string[]
  /** ['#start', '#mid', '#end'] for the outer slab frame (digital card-image only). */
  frameGradient?: string[]
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
    return <OneTouchMockup cardImageUrl={cardSrc} width={width} labelProps={labelProps} side={side} />
  }
  if (holder === 'toploader') {
    return (
      <ToploaderMockup
        cardImageUrl={cardSrc}
        width={width}
        variant={labelType === 'foldover' ? 'foldover' : 'front-back'}
        labelProps={labelProps}
        side={side}
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

/** WatermarkPattern — 8 sparse DCM logos at 8% opacity, used on foldover labels.
 *  Mirrors src/components/labels/LabelMockup.tsx:69-78. */
function WatermarkPattern() {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.08, padding: 3, flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' }} pointerEvents="none">
      {Array.from({ length: 8 }).map((_, i) => (
        <Image key={i} source={require('@/assets/images/dcm-logo.png')} style={{ width: 10, height: 10, marginRight: 6, marginBottom: 6 }} resizeMode="contain" />
      ))}
    </View>
  )
}

/** Dense DCM logo grid filling the toploader 8167 back label (8% opacity).
 *  Mirrors src/components/labels/LabelMockup.tsx:82-93. */
function DenseLogoGrid({ width, height }: { width: number; height: number }) {
  const logoSize = 6
  const stride = logoSize + 1
  const cols = Math.floor(width / stride)
  const rows = Math.floor(height / stride)
  const items: React.ReactNode[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      items.push(
        <Image
          key={`${r}-${c}`}
          source={require('@/assets/images/dcm-logo.png')}
          style={{ position: 'absolute', top: r * stride + 1, left: c * stride + 1, width: logoSize, height: logoSize, opacity: 0.08 }}
          resizeMode="contain"
        />
      )
    }
  }
  return <View style={{ position: 'absolute', top: 0, left: 0, width, height, overflow: 'hidden' }} pointerEvents="none">{items}</View>
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

function SlabFrontInline({ width, labelProps, slabStyle, customOverrides }: { width: number; labelProps?: LabelInlineProps; slabStyle: SlabStyle; customOverrides?: CustomColorOverrides }) {
  const grade = gradeStr(labelProps?.grade ?? null, labelProps?.isAlteredAuthentic)
  const dark = isDarkSlab(slabStyle, customOverrides)
  const gradient = getLabelGradient(slabStyle, customOverrides)

  const nameColor = dark ? 'rgba(255,255,255,0.95)' : '#1f2937'
  const contextColor = dark ? 'rgba(255,255,255,0.7)' : '#4b5563'
  const featuresColor = dark ? 'rgba(34,197,94,0.9)' : '#2563eb'
  const serialColor = dark ? 'rgba(255,255,255,0.5)' : '#6b7280'
  const gradeColor = dark ? '#ffffff' : '#7c3aed'
  const conditionColor = dark ? 'rgba(255,255,255,0.8)' : '#6b46c1'

  // Web's font sizes are cqw — scale to width.
  const nameLen = (labelProps?.displayName || '').length
  const namePct = nameLen <= 14 ? 0.065 : nameLen <= 20 ? 0.055 : nameLen <= 30 ? 0.048 : 0.042

  const condition = labelProps?.isAlteredAuthentic && labelProps?.grade === null
    ? 'AUTHENTIC' : (labelProps?.condition || '').toUpperCase()

  return (
    <LinearGradient
      colors={gradient as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: '100%', aspectRatio: 3.5, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', paddingHorizontal: width * 0.03, paddingVertical: width * 0.03 / 3.5 }}
    >
      {/* LEFT: DCM logo (12% width) */}
      <View style={{ width: width * 0.12, alignItems: 'center', justifyContent: 'center' }}>
        <Image
          source={require('@/assets/images/dcm-logo.png')}
          style={{ width: width * 0.10, height: width * 0.10, opacity: dark ? 0.95 : 1 }}
          resizeMode="contain"
          tintColor={dark ? 'rgba(255,255,255,0.9)' : undefined}
        />
      </View>

      {/* CENTER: card info */}
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: width * 0.015 }}>
        <Text style={{ fontSize: width * namePct, lineHeight: width * namePct * 1.15, fontWeight: '600', color: nameColor }} numberOfLines={1}>
          {labelProps?.displayName || 'Card Name'}
        </Text>
        {!!labelProps?.setLineText && (
          <Text style={{ fontSize: width * namePct * 0.76, lineHeight: width * namePct * 0.76 * 1.15, color: contextColor }} numberOfLines={1}>
            {labelProps.setLineText}
          </Text>
        )}
        {labelProps && labelProps.features.length > 0 && (
          <Text style={{ fontSize: width * namePct * 0.7, lineHeight: width * namePct * 0.7 * 1.15, fontWeight: '500', color: featuresColor }} numberOfLines={1}>
            {labelProps.features.join(' • ')}
          </Text>
        )}
        {!!labelProps?.serial && (
          <Text style={{ fontSize: width * namePct * 0.7, lineHeight: width * namePct * 0.7 * 1.15, fontFamily: 'Courier', color: serialColor }} numberOfLines={1}>
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
    </LinearGradient>
  )
}

function SlabBackInline({ width, labelProps, slabStyle, customOverrides, emblems }: { width: number; labelProps?: LabelInlineProps; slabStyle: SlabStyle; customOverrides?: CustomColorOverrides; emblems?: LabelEmblems }) {
  const grade = gradeStr(labelProps?.grade ?? null, labelProps?.isAlteredAuthentic)
  const dark = isDarkSlab(slabStyle, customOverrides)
  const gradient = getLabelGradient(slabStyle, customOverrides)

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
    <LinearGradient
      colors={gradient as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: '100%', aspectRatio: 3.5, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', paddingHorizontal: width * 0.03, paddingVertical: width * 0.03 / 3.5 }}
    >
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
    </LinearGradient>
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
function OneTouchMockup({ cardImageUrl, width, labelProps, side }: { cardImageUrl?: string | null; width: number; labelProps?: LabelInlineProps; side: 'front' | 'back' }) {
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
          ? <OneTouchLabelFront width={labelWidth} labelProps={labelProps} />
          : <OneTouchLabelBack width={labelWidth} qrUrl={labelProps?.qrUrl} />}
      </View>
    </View>
  )
}

// ============================================================================
// Toploader — photo 451×588
// ============================================================================
function ToploaderMockup({ cardImageUrl, width, variant, labelProps, side }: { cardImageUrl?: string | null; width: number; variant: 'front-back' | 'foldover'; labelProps?: LabelInlineProps; side: 'front' | 'back' }) {
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
          {side === 'front'
            ? <FoldoverLabelFront width={labelWidth} labelProps={labelProps} />
            : <FoldoverLabelBack width={labelWidth} qrUrl={labelProps?.qrUrl} />}
        </View>
      ) : (
        <View style={[s.slot, { top: 0, left: labelLeft, width: labelWidth }]}>
          {side === 'front'
            ? <ToploaderLabelFront width={labelWidth} labelProps={labelProps} />
            : <ToploaderLabelBack width={labelWidth} qrUrl={labelProps?.qrUrl} />}
        </View>
      )}
    </View>
  )
}

// ============================================================================
// INLINE SMALL-FORMAT LABELS (toploader 8167, foldover, one-touch 6871)
// Each mirrors web's JSX exactly (LabelMockup.tsx:479-628).
// ============================================================================

/** Toploader Avery 8167 standard front (3.5:1) */
function ToploaderLabelFront({ width, labelProps }: { width: number; labelProps?: LabelInlineProps }) {
  const grade = gradeStr(labelProps?.grade ?? null, labelProps?.isAlteredAuthentic)
  return (
    <View style={{ width: '100%', aspectRatio: 3.5, backgroundColor: '#fff', flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', borderBottomLeftRadius: 2, borderBottomRightRadius: 2, overflow: 'hidden' }}>
      <View style={{ width: 3, backgroundColor: '#7c3aed' }} />
      <View style={{ paddingHorizontal: 3, justifyContent: 'center' }}>
        <Image source={require('@/assets/images/dcm-logo.png')} style={{ height: 12, width: 12 }} resizeMode="contain" />
      </View>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 2 }}>
        <Text style={{ fontSize: 5, color: '#374151', fontWeight: '500' }} numberOfLines={1}>{labelProps?.displayName || 'Card Name'}</Text>
      </View>
      <View style={{ width: StyleSheet.hairlineWidth, marginVertical: 2, backgroundColor: 'rgba(124,58,237,0.3)' }} />
      <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#7c3aed', lineHeight: 9 }}>{grade}</Text>
        <View style={{ width: 7, height: StyleSheet.hairlineWidth, backgroundColor: '#7c3aed', marginTop: 0.5 }} />
        {!!labelProps?.condition && (
          <Text style={{ fontSize: 3, fontWeight: 'bold', color: '#6b46c1', textTransform: 'uppercase' }} numberOfLines={1}>{labelProps.condition}</Text>
        )}
      </View>
    </View>
  )
}

/** Toploader Avery 8167 standard back (3.5:1) — dense logo grid + real QR */
function ToploaderLabelBack({ width, qrUrl }: { width: number; qrUrl?: string }) {
  const height = width / 3.5
  return (
    <View style={{ width: '100%', aspectRatio: 3.5, backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', borderBottomLeftRadius: 2, borderBottomRightRadius: 2, overflow: 'hidden' }}>
      <DenseLogoGrid width={width} height={height} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <RealQR qrUrl={qrUrl} size={Math.max(12, height * 0.85)} />
      </View>
    </View>
  )
}

/** Foldover front (1.75:1) — DCM logo collage + grade + condition */
function FoldoverLabelFront({ width, labelProps }: { width: number; labelProps?: LabelInlineProps }) {
  const grade = gradeStr(labelProps?.grade ?? null, labelProps?.isAlteredAuthentic)
  return (
    <LinearGradient
      colors={['#ffffff', '#f9fafb']}
      style={{ width: '100%', aspectRatio: 1.75, alignItems: 'center', justifyContent: 'center', borderBottomLeftRadius: 2, borderBottomRightRadius: 2, overflow: 'hidden', position: 'relative' }}
    >
      <WatermarkPattern />
      <View style={{ alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#7c3aed', lineHeight: 14 }}>{grade}</Text>
        {!!labelProps?.condition && (
          <Text style={{ fontSize: 5, fontWeight: 'bold', color: '#6b46c1', textTransform: 'uppercase', marginTop: 2 }} numberOfLines={1}>{labelProps.condition}</Text>
        )}
      </View>
    </LinearGradient>
  )
}

/** Foldover back (1.75:1) — DCM logo collage + real QR */
function FoldoverLabelBack({ width, qrUrl }: { width: number; qrUrl?: string }) {
  return (
    <View style={{ width: '100%', aspectRatio: 1.75, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderBottomLeftRadius: 2, borderBottomRightRadius: 2, overflow: 'hidden', position: 'relative' }}>
      <WatermarkPattern />
      <View style={{ zIndex: 10 }}>
        <RealQR qrUrl={qrUrl} size={Math.max(14, width * 0.4)} />
      </View>
    </View>
  )
}

/** One-Touch Avery 6871 front (3.8:1) — logo + multi-line text + grade */
function OneTouchLabelFront({ width, labelProps }: { width: number; labelProps?: LabelInlineProps }) {
  const grade = gradeStr(labelProps?.grade ?? null, labelProps?.isAlteredAuthentic)
  const features = labelProps?.features ?? []
  return (
    <View style={{ width: '100%', aspectRatio: 3.8, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, overflow: 'hidden' }}>
      <Image source={require('@/assets/images/dcm-logo.png')} style={{ height: 12, width: 12, marginRight: 3 }} resizeMode="contain" />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={{ fontSize: 5, fontWeight: '600', color: '#111827', lineHeight: 6 }} numberOfLines={1}>{labelProps?.displayName || 'Card Name'}</Text>
        {!!labelProps?.setLineText && <Text style={{ fontSize: 3.5, color: '#6b7280', lineHeight: 4.2 }} numberOfLines={1}>{labelProps.setLineText}</Text>}
        {features.length > 0 && <Text style={{ fontSize: 3.5, fontWeight: '500', color: '#2563eb', lineHeight: 4.2 }} numberOfLines={1}>{features.join(' • ')}</Text>}
        {!!labelProps?.serial && <Text style={{ fontSize: 3, fontFamily: 'Courier', color: '#9ca3af', lineHeight: 4 }} numberOfLines={1}>{labelProps.serial}</Text>}
      </View>
      <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, marginLeft: 2 }}>
        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#7c3aed', lineHeight: 9 }}>{grade}</Text>
        <View style={{ width: 8, height: StyleSheet.hairlineWidth, backgroundColor: '#7c3aed', marginTop: 0.5 }} />
        {!!labelProps?.condition && (
          <Text style={{ fontSize: 3, fontWeight: 'bold', color: '#6b46c1', textTransform: 'uppercase', marginTop: 0.5 }} numberOfLines={1}>{labelProps.condition}</Text>
        )}
      </View>
    </View>
  )
}

/** One-Touch Avery 6871 back (3.8:1) — real QR + faded DCM logo */
function OneTouchLabelBack({ width, qrUrl }: { width: number; qrUrl?: string }) {
  return (
    <View style={{ width: '100%', aspectRatio: 3.8, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomLeftRadius: 2, borderBottomRightRadius: 2, overflow: 'hidden' }}>
      <RealQR qrUrl={qrUrl} size={16} />
      <Image source={require('@/assets/images/dcm-logo.png')} style={{ height: 10, width: 10, marginLeft: 4, opacity: 0.25 }} resizeMode="contain" />
    </View>
  )
}

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
