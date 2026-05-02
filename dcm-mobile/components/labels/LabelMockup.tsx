import { View, Image, Text, StyleSheet } from 'react-native'
import { Colors } from '@/lib/constants'

/**
 * LabelMockup — picks the right holder mockup (graded slab, magnetic one-touch,
 * toploader, or digital card image) for a Label Studio gallery tile.
 *
 * Direct port of src/components/labels/LabelMockup.tsx — same holder photos,
 * same slot percentages, same per-holder label content. Critically: the
 * slab uses one rendered label image (the canvas-generated preview that also
 * drives downloads), but toploader and one-touch use COMPLETELY DIFFERENT
 * inline label layouts matching web's compact Avery sticker formats. They
 * are NOT shrunken slab labels — they have their own JSX with logo + grade
 * + minimal text per the actual physical Avery label dimensions.
 *
 * Holder PNG aspect ratios (preserved exactly via explicit width × height):
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
}

interface LabelMockupProps {
  labelType: LabelTypeId
  /** Pre-rendered slab label image (used for slab + digital only). */
  labelImageUrl?: string | null
  cardImageUrl?: string | null
  width?: number
  /** Label data used by inline toploader / one-touch labels. */
  labelProps?: LabelInlineProps
  /** Which side of the holder to display. */
  side?: 'front' | 'back'
}

export default function LabelMockup({
  labelType,
  labelImageUrl,
  cardImageUrl,
  width = 200,
  labelProps,
  side = 'front',
}: LabelMockupProps) {
  const holder = HOLDER_BY_TYPE[labelType] ?? 'slab'
  if (holder === 'slab') return <SlabMockup labelImageUrl={labelImageUrl} cardImageUrl={cardImageUrl} width={width} />
  if (holder === 'onetouch') return <OneTouchMockup cardImageUrl={cardImageUrl} width={width} labelProps={labelProps} side={side} />
  if (holder === 'toploader') return <ToploaderMockup cardImageUrl={cardImageUrl} width={width} variant={labelType === 'foldover' ? 'foldover' : 'front-back'} labelProps={labelProps} side={side} />
  return <DigitalMockup labelImageUrl={labelImageUrl} cardImageUrl={cardImageUrl} width={width} />
}

// ============================================================================
// HELPERS
// ============================================================================

function gradeStr(grade: number | null, alt?: boolean): string {
  if (grade !== null && grade !== undefined) return Math.round(grade).toString()
  return alt ? 'A' : 'N/A'
}

/** Tiny QR placeholder — gallery preview only; download generates a real QR. */
function QRPlaceholder({ size = 16 }: { size?: number }) {
  const corner = Math.max(2, size * 0.32)
  const inner = Math.max(1, corner * 0.5)
  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <View style={{ position: 'absolute', top: 1, left: 1, width: corner, height: corner, backgroundColor: 'rgba(124,58,237,0.6)', borderRadius: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: inner, height: inner, backgroundColor: '#fff', borderRadius: 0.5 }} />
      </View>
      <View style={{ position: 'absolute', top: 1, right: 1, width: corner, height: corner, backgroundColor: 'rgba(124,58,237,0.6)', borderRadius: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: inner, height: inner, backgroundColor: '#fff', borderRadius: 0.5 }} />
      </View>
      <View style={{ position: 'absolute', bottom: 1, left: 1, width: corner, height: corner, backgroundColor: 'rgba(124,58,237,0.6)', borderRadius: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: inner, height: inner, backgroundColor: '#fff', borderRadius: 0.5 }} />
      </View>
      <View style={{ position: 'absolute', bottom: 2, right: 2, width: corner * 0.5, height: corner * 0.5, backgroundColor: 'rgba(124,58,237,0.4)', borderRadius: 0.5 }} />
    </View>
  )
}

/** Dense DCM logo grid filling the toploader back label (8% opacity). */
function DenseLogoGrid({ width, height }: { width: number; height: number }) {
  const logoSize = 6
  const cols = Math.floor(width / (logoSize + 1))
  const rows = Math.floor(height / (logoSize + 1))
  const items: React.ReactNode[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      items.push(
        <Image
          key={`${r}-${c}`}
          source={require('@/assets/images/dcm-logo.png')}
          style={{ position: 'absolute', top: r * (logoSize + 1) + 1, left: c * (logoSize + 1) + 1, width: logoSize, height: logoSize, opacity: 0.08 }}
          resizeMode="contain"
        />
      )
    }
  }
  return <View style={{ position: 'absolute', top: 0, left: 0, width, height, overflow: 'hidden' }}>{items}</View>
}

// ============================================================================
// Graded Slab — photo 280×460
// Slot percentages measured directly from public/labels/graded-card-slab.png:
//   Label slot (gray rectangle): top 5.4% left 8.9% width 81.4% height 15.2%
//   Card window (white rectangle): top 28.3% left 11.8% width 75.7% height 60.9%
// ============================================================================
function SlabMockup({ labelImageUrl, cardImageUrl, width }: { labelImageUrl?: string | null; cardImageUrl?: string | null; width: number }) {
  const height = (width * 460) / 280
  // Slots use absolute pixel positions (not percentages) computed from the
  // measured photo coordinates. RN's percentage positioning + image
  // resizeMode:'contain' has known platform quirks where the actual rendered
  // bounds don't match what the slot percentages assume — using explicit
  // pixels eliminates the ambiguity entirely.
  const labelTop = height * 0.054, labelLeft = width * 0.089, labelW = width * 0.814, labelH = height * 0.152
  const cardTop = height * 0.283, cardLeft = width * 0.118, cardW = width * 0.757, cardH = height * 0.609
  return (
    <View style={[s.holder, { width, height }]}>
      <Image source={require('@/assets/images/graded-card-slab.png')} style={{ width, height }} resizeMode="contain" />

      {/* Label slot — fills the gray rectangle exactly */}
      <View style={[s.slot, { top: labelTop, left: labelLeft, width: labelW, height: labelH }]}>
        {labelImageUrl
          ? <Image source={{ uri: labelImageUrl }} style={{ width: labelW, height: labelH }} resizeMode="contain" />
          : <View style={{ width: labelW, height: labelH, backgroundColor: Colors.gray[200] }} />}
      </View>

      {/* Card window — fills the white rectangle exactly */}
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
// Per src/components/labels/LabelMockup.tsx:570-630:
//   Card:  top 13%, left 11%, width 78%, height 76%
//   Label: top 0%, left 17.5%, width 65%, aspectRatio 3.8 (Avery 6871 fold)
//   3px purple fold crease above the visible label half.
// ============================================================================
function OneTouchMockup({ cardImageUrl, width, labelProps, side }: { cardImageUrl?: string | null; width: number; labelProps?: LabelInlineProps; side: 'front' | 'back' }) {
  const height = (width * 457) / 314
  const labelWidth = width * 0.65
  const cardTop = height * 0.13, cardLeft = width * 0.11, cardW = width * 0.78, cardH = height * 0.76
  const labelLeft = width * 0.175
  return (
    <View style={[s.holder, { width, height }]}>
      <Image source={require('@/assets/images/mag-one-touch-DCM.png')} style={{ width, height }} resizeMode="contain" />

      {/* Card window */}
      <View style={[s.slot, { top: cardTop, left: cardLeft, width: cardW, height: cardH }]}>
        {cardImageUrl
          ? <Image source={{ uri: cardImageUrl }} style={{ width: cardW, height: cardH }} resizeMode="contain" />
          : <View style={{ width: cardW, height: cardH, backgroundColor: Colors.gray[100] }} />}
      </View>

      {/* Label folded over top edge */}
      <View style={[s.slot, { top: 0, left: labelLeft, width: labelWidth }]}>
        <View style={s.foldCrease} />
        {side === 'front'
          ? <OneTouchLabelFront width={labelWidth} labelProps={labelProps} />
          : <OneTouchLabelBack width={labelWidth} />}
      </View>
    </View>
  )
}

// ============================================================================
// Toploader — photo 451×588
// Per src/components/labels/LabelMockup.tsx:446-538:
//   Card:               top 4.5%, left 7%, width 86%, height 90%
//   Label front-back:   top 0%, left 21%, width 58%, aspectRatio 3.5 (Avery 8167)
//   Label foldover:     top 0%, left 35.5%, width 29%, aspectRatio 1.75
// ============================================================================
function ToploaderMockup({ cardImageUrl, width, variant, labelProps, side }: { cardImageUrl?: string | null; width: number; variant: 'front-back' | 'foldover'; labelProps?: LabelInlineProps; side: 'front' | 'back' }) {
  const height = (width * 588) / 451
  const labelWidth = width * (variant === 'foldover' ? 0.29 : 0.58)
  const cardTop = height * 0.045, cardLeft = width * 0.07, cardW = width * 0.86, cardH = height * 0.90
  const labelLeft = width * (variant === 'foldover' ? 0.355 : 0.21)
  return (
    <View style={[s.holder, { width, height }]}>
      <Image source={require('@/assets/images/top-loader-dcm.png')} style={{ width, height }} resizeMode="contain" />

      {/* Card window */}
      <View style={[s.slot, { top: cardTop, left: cardLeft, width: cardW, height: cardH }]}>
        {cardImageUrl
          ? <Image source={{ uri: cardImageUrl }} style={{ width: cardW, height: cardH, borderRadius: 2 }} resizeMode="contain" />
          : <View style={{ width: cardW, height: cardH, backgroundColor: Colors.gray[100] }} />}
      </View>

      {/* Label */}
      {variant === 'foldover' ? (
        <View style={[s.slot, { top: 0, left: labelLeft, width: labelWidth }]}>
          <View style={s.foldCrease} />
          {side === 'front'
            ? <FoldoverLabelFront width={labelWidth} labelProps={labelProps} />
            : <FoldoverLabelBack width={labelWidth} />}
        </View>
      ) : (
        <View style={[s.slot, { top: 0, left: labelLeft, width: labelWidth }]}>
          {side === 'front'
            ? <ToploaderLabelFront width={labelWidth} labelProps={labelProps} />
            : <ToploaderLabelBack width={labelWidth} />}
        </View>
      )}
    </View>
  )
}

// ============================================================================
// INLINE LABEL COMPONENTS — mirror src/components/labels/LabelMockup.tsx
// JSX exactly. These are NOT slab labels — they are compact Avery sticker
// designs with their own aspect ratios and content per type.
// ============================================================================

/** Toploader Avery 8167 standard front (3.5:1):
 *  [3px purple bar] [logo 12px] [card name 5px] [divider] [grade 9px + condition 3px]
 *  Mirrors src/components/labels/LabelMockup.tsx:508-526 */
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

/** Toploader Avery 8167 standard back (3.5:1):
 *  Dense DCM logo grid + centered QR placeholder.
 *  Mirrors src/components/labels/LabelMockup.tsx:529-536 */
function ToploaderLabelBack({ width }: { width: number }) {
  const height = width / 3.5
  return (
    <View style={{ width: '100%', aspectRatio: 3.5, backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', borderBottomLeftRadius: 2, borderBottomRightRadius: 2, overflow: 'hidden' }}>
      <DenseLogoGrid width={width} height={height} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <QRPlaceholder size={Math.max(10, height * 0.85)} />
      </View>
    </View>
  )
}

/** Foldover front (1.75:1) — folded half showing only grade + condition.
 *  Mirrors src/components/labels/LabelMockup.tsx:479-492 */
function FoldoverLabelFront({ width, labelProps }: { width: number; labelProps?: LabelInlineProps }) {
  const grade = gradeStr(labelProps?.grade ?? null, labelProps?.isAlteredAuthentic)
  return (
    <View style={{ width: '100%', aspectRatio: 1.75, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderBottomLeftRadius: 2, borderBottomRightRadius: 2, overflow: 'hidden' }}>
      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#7c3aed', lineHeight: 14 }}>{grade}</Text>
      {!!labelProps?.condition && (
        <Text style={{ fontSize: 5, fontWeight: 'bold', color: '#6b46c1', textTransform: 'uppercase', marginTop: 2 }} numberOfLines={1}>{labelProps.condition}</Text>
      )}
    </View>
  )
}

/** Foldover back (1.75:1) — centered QR.
 *  Mirrors src/components/labels/LabelMockup.tsx:494-498 */
function FoldoverLabelBack({ width }: { width: number }) {
  return (
    <View style={{ width: '100%', aspectRatio: 1.75, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderBottomLeftRadius: 2, borderBottomRightRadius: 2, overflow: 'hidden' }}>
      <QRPlaceholder size={Math.max(14, width * 0.4)} />
    </View>
  )
}

/** One-Touch Avery 6871 front (3.8:1):
 *  [logo 12×12] [multi-line: name 5px / context 3.5px / features 3.5px / serial 3px] [grade 9px + condition 3px]
 *  Mirrors src/components/labels/LabelMockup.tsx:596-620 */
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

/** One-Touch Avery 6871 back (3.8:1) — centered QR + faded DCM logo.
 *  Mirrors src/components/labels/LabelMockup.tsx:622-628 */
function OneTouchLabelBack({ width }: { width: number }) {
  return (
    <View style={{ width: '100%', aspectRatio: 3.8, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomLeftRadius: 2, borderBottomRightRadius: 2, overflow: 'hidden' }}>
      <QRPlaceholder size={16} />
      <Image source={require('@/assets/images/dcm-logo.png')} style={{ height: 10, width: 10, marginLeft: 4, opacity: 0.25 }} resizeMode="contain" />
    </View>
  )
}

// ============================================================================
// Card Image (digital) — vertical stack of label band + card.
// Mirrors src/components/labels/LabelMockup.tsx:653-695. Uses the canvas-rendered
// slab label since web's digital card image format reuses SlabFrontLabel.
// ============================================================================
function DigitalMockup({ labelImageUrl, cardImageUrl, width }: { labelImageUrl?: string | null; cardImageUrl?: string | null; width: number }) {
  const inner = width - 6
  return (
    <View style={{ width, alignSelf: 'center', padding: 3, backgroundColor: '#1a1625', borderRadius: 6 }}>
      <View style={{ width: inner, overflow: 'hidden', borderRadius: 4 }}>
        <View style={{ width: '100%', aspectRatio: 3.5, backgroundColor: '#1a1625' }}>
          {labelImageUrl
            ? <Image source={{ uri: labelImageUrl }} style={s.fill} resizeMode="contain" />
            : null}
        </View>
        <View style={{ height: 2, backgroundColor: '#2d1f47' }} />
        <View style={{ width: '100%', aspectRatio: 2.5 / 3.5, backgroundColor: '#0a0a12' }}>
          {cardImageUrl
            ? <Image source={{ uri: cardImageUrl }} style={s.fill} resizeMode="contain" />
            : null}
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  holder: { alignSelf: 'center', position: 'relative', overflow: 'hidden' },
  slot: { position: 'absolute', overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  // 3px purple fold crease shown above the label on fold-over variants.
  foldCrease: { height: 3, backgroundColor: '#7c3aed', borderTopLeftRadius: 1, borderTopRightRadius: 1 },
})
