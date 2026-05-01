import { View, Image, StyleSheet } from 'react-native'
import { Colors } from '@/lib/constants'

/**
 * LabelMockup — picks the right holder mockup (graded slab, magnetic one-touch,
 * toploader, or digital card image) for a gallery tile and overlays the user's
 * label preview (rendered upstream via LabelWebRenderer) at the right slot.
 *
 * 1:1 with src/components/labels/LabelMockup.tsx — same holder photos, same
 * slot percentages. All positions are expressed as percentage strings so the
 * mockup scales correctly to any container width on phones AND tablets, and
 * the label slot uses aspectRatio (not a hardcoded height) so the label image
 * always fits its real-world rectangle no matter the device aspect ratio.
 *
 * Holder PNG aspect ratios (preserved exactly via the parent View's aspectRatio):
 *   Slab:        280 / 460  (≈ 0.609)
 *   One-Touch:   314 / 457  (≈ 0.687)
 *   Toploader:   451 / 588  (≈ 0.767)
 *
 * Slot percentages copied from src/components/labels/LabelMockup.tsx so the two
 * stay in lockstep — the same numbers that line up with the photo on web will
 * line up on mobile.
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

interface LabelMockupProps {
  labelType: LabelTypeId
  labelImageUrl?: string | null
  cardImageUrl?: string | null
  width?: number
}

export default function LabelMockup({ labelType, labelImageUrl, cardImageUrl, width = 200 }: LabelMockupProps) {
  const holder = HOLDER_BY_TYPE[labelType] ?? 'slab'
  if (holder === 'slab') return <SlabMockup labelImageUrl={labelImageUrl} cardImageUrl={cardImageUrl} width={width} />
  if (holder === 'onetouch') return <OneTouchMockup labelImageUrl={labelImageUrl} cardImageUrl={cardImageUrl} width={width} />
  if (holder === 'toploader') return <ToploaderMockup labelImageUrl={labelImageUrl} cardImageUrl={cardImageUrl} width={width} variant={labelType === 'foldover' ? 'foldover' : 'front-back'} />
  return <DigitalMockup labelImageUrl={labelImageUrl} cardImageUrl={cardImageUrl} width={width} />
}

// ============================================================================
// Graded Slab — photo 280×460, label slot at top, card window below
// Web (src/components/labels/LabelMockup.tsx:397-414):
//   Label: top 4.5%, left 13.5%, width 73% (height via aspectRatio 3.5)
//   Card:  top 20%,  left 10.7%, width 78.6%, height 73.9%
// ============================================================================
function SlabMockup({ labelImageUrl, cardImageUrl, width }: { labelImageUrl?: string | null; cardImageUrl?: string | null; width: number }) {
  // Photo aspect 280/460 — explicit pixel height keeps the View from
  // expanding under any parent flex/aspectRatio quirks.
  const height = (width * 460) / 280
  return (
    <View style={[s.holder, { width, height }]}>
      <Image source={require('@/assets/images/graded-card-slab.png')} style={StyleSheet.absoluteFill as any} resizeMode="contain" />

      {/* Label slot — width-only; aspectRatio derives the 3.5:1 height. */}
      <View style={[s.slot, { top: '4.5%', left: '13.5%', width: '73%', aspectRatio: 3.5 }]}>
        {labelImageUrl
          ? <Image source={{ uri: labelImageUrl }} style={s.fill} resizeMode="contain" />
          : <View style={[s.fill, { backgroundColor: Colors.gray[200] }]} />}
      </View>

      {/* Card window */}
      <View style={[s.slot, { top: '20%', left: '10.7%', width: '78.6%', height: '73.9%' }]}>
        {cardImageUrl
          ? <Image source={{ uri: cardImageUrl }} style={s.fill} resizeMode="contain" />
          : <View style={[s.fill, { backgroundColor: Colors.gray[100] }]} />}
      </View>
    </View>
  )
}

// ============================================================================
// One-Touch — photo 314×457
// Web (src/components/labels/LabelMockup.tsx:570-630):
//   Card:  top 13%,  left 11%,   width 78%, height 76%
//   Label: top 0%,   left 17.5%, width 65% (height via aspectRatio 3.8)
//   3px purple fold crease sits at the top edge — drawn here as a thin bar
//   above the label image so the look matches the photo's case edge.
// ============================================================================
function OneTouchMockup({ labelImageUrl, cardImageUrl, width }: { labelImageUrl?: string | null; cardImageUrl?: string | null; width: number }) {
  // Photo aspect 314/457
  const height = (width * 457) / 314
  return (
    <View style={[s.holder, { width, height }]}>
      <Image source={require('@/assets/images/mag-one-touch-DCM.png')} style={StyleSheet.absoluteFill as any} resizeMode="contain" />

      {/* Card slot */}
      <View style={[s.slot, { top: '13%', left: '11%', width: '78%', height: '76%' }]}>
        {cardImageUrl
          ? <Image source={{ uri: cardImageUrl }} style={s.fill} resizeMode="contain" />
          : <View style={[s.fill, { backgroundColor: Colors.gray[100] }]} />}
      </View>

      {/* Label folded over the top edge — wrapper holds the purple fold crease + label */}
      <View style={[s.slot, { top: '0%', left: '17.5%', width: '65%' }]}>
        <View style={s.foldCrease} />
        <View style={{ width: '100%', aspectRatio: 3.8, overflow: 'hidden', borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }}>
          {labelImageUrl
            ? <Image source={{ uri: labelImageUrl }} style={s.fill} resizeMode="contain" />
            : <View style={[s.fill, { backgroundColor: '#fff' }]} />}
        </View>
      </View>
    </View>
  )
}

// ============================================================================
// Toploader — photo 451×588
// Web (src/components/labels/LabelMockup.tsx:446-538):
//   Card:               top 4.5%,  left 7%,    width 86%, height 90%
//   Label front-back:   top 0%,    left 21%,   width 58% (aspectRatio 3.5)
//   Label foldover:     top 0%,    left 35.5%, width 29% (aspectRatio 1.75 — folded half)
// ============================================================================
function ToploaderMockup({ labelImageUrl, cardImageUrl, width, variant }: { labelImageUrl?: string | null; cardImageUrl?: string | null; width: number; variant: 'front-back' | 'foldover' }) {
  // Photo aspect 451/588
  const height = (width * 588) / 451
  return (
    <View style={[s.holder, { width, height }]}>
      <Image source={require('@/assets/images/top-loader-dcm.png')} style={StyleSheet.absoluteFill as any} resizeMode="contain" />

      {/* Card */}
      <View style={[s.slot, { top: '4.5%', left: '7%', width: '86%', height: '90%' }]}>
        {cardImageUrl
          ? <Image source={{ uri: cardImageUrl }} style={[s.fill, { borderRadius: 2 }]} resizeMode="contain" />
          : <View style={[s.fill, { backgroundColor: Colors.gray[100] }]} />}
      </View>

      {/* Label */}
      {variant === 'foldover' ? (
        <View style={[s.slot, { top: '0%', left: '35.5%', width: '29%' }]}>
          <View style={s.foldCrease} />
          <View style={{ width: '100%', aspectRatio: 1.75, overflow: 'hidden', borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }}>
            {labelImageUrl
              ? <Image source={{ uri: labelImageUrl }} style={s.fill} resizeMode="contain" />
              : <View style={[s.fill, { backgroundColor: '#fff' }]} />}
          </View>
        </View>
      ) : (
        <View style={[s.slot, { top: '0%', left: '21%', width: '58%', aspectRatio: 3.5, overflow: 'hidden', borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }]}>
          {labelImageUrl
            ? <Image source={{ uri: labelImageUrl }} style={s.fill} resizeMode="contain" />
            : <View style={[s.fill, { backgroundColor: '#fff' }]} />}
        </View>
      )}
    </View>
  )
}

// ============================================================================
// Card Image (digital) — vertical stack of label (3.5:1) + card (2.5:3.5)
// Web (src/components/labels/LabelMockup.tsx:653-695): label 220px, separator
// 8px, card 1100px ≈ 3.5:1 + 2.5:3.5 stacked inside a 3px gradient frame.
// ============================================================================
function DigitalMockup({ labelImageUrl, cardImageUrl, width }: { labelImageUrl?: string | null; cardImageUrl?: string | null; width: number }) {
  // Inner content width = container - 6 (3px border each side).
  const inner = width - 6
  return (
    <View style={{ width, alignSelf: 'center', padding: 3, backgroundColor: '#1a1625', borderRadius: 6 }}>
      <View style={{ width: inner, overflow: 'hidden', borderRadius: 4 }}>
        {/* Label band — 3.5:1 */}
        <View style={{ width: '100%', aspectRatio: 3.5, backgroundColor: '#1a1625' }}>
          {labelImageUrl
            ? <Image source={{ uri: labelImageUrl }} style={s.fill} resizeMode="contain" />
            : null}
        </View>
        {/* Separator */}
        <View style={{ height: 2, backgroundColor: '#2d1f47' }} />
        {/* Card — 2.5:3.5 */}
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
  // overflow:hidden hard-clips the holder PNG to the View bounds so the photo
  // never bleeds into the neighboring slider panels regardless of resizeMode
  // behavior.
  holder: { alignSelf: 'center', position: 'relative', overflow: 'hidden' },
  slot: { position: 'absolute', overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  // 3px purple fold crease shown above the label on fold-over variants —
  // visually matches the photo's case-edge fold line. Same purple as web.
  foldCrease: { height: 3, backgroundColor: '#7c3aed', borderTopLeftRadius: 1, borderTopRightRadius: 1 },
})
