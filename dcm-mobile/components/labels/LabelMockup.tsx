import { View, Text, Image, StyleSheet } from 'react-native'
import { Colors } from '@/lib/constants'

/**
 * LabelMockup — picks the right holder mockup (graded slab, magnetic one-touch,
 * toploader, or digital card image) for a gallery tile and overlays the user's
 * label preview (rendered upstream via LabelWebRenderer) at the right slot.
 *
 * Mirrors the web's src/components/labels/LabelMockup.tsx — same holder PNGs,
 * same relative slot positions. Mobile renders smaller and centered.
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
  labelImageUrl?: string | null   // PNG/JPEG of the label generated upstream (data URL is fine)
  cardImageUrl?: string | null    // signed URL for the card front (slab + digital types use it)
  width?: number                  // overall mockup width on screen (default 200px)
}

export default function LabelMockup({ labelType, labelImageUrl, cardImageUrl, width = 200 }: LabelMockupProps) {
  const holder = HOLDER_BY_TYPE[labelType] ?? 'slab'
  if (holder === 'slab') return <SlabMockup labelImageUrl={labelImageUrl} cardImageUrl={cardImageUrl} width={width} />
  if (holder === 'onetouch') return <OneTouchMockup labelImageUrl={labelImageUrl} cardImageUrl={cardImageUrl} width={width} />
  if (holder === 'toploader') return <ToploaderMockup labelImageUrl={labelImageUrl} cardImageUrl={cardImageUrl} width={width} />
  return <DigitalMockup labelImageUrl={labelImageUrl} cardImageUrl={cardImageUrl} width={width} />
}

function SlabMockup({ labelImageUrl, cardImageUrl, width }: { labelImageUrl?: string | null; cardImageUrl?: string | null; width: number }) {
  // graded-card-slab.png is ~280x460 — preserve aspect (~0.609)
  const height = width / (280 / 460)
  return (
    <View style={[s.holder, { width, height }]}>
      <Image source={require('@/assets/images/graded-card-slab.png')} style={StyleSheet.absoluteFill as any} resizeMode="contain" />
      {/* Label slot — top of slab */}
      <View style={[s.slot, { top: height * 0.045, left: width * 0.135, width: width * 0.73, height: height * 0.135 }]}>
        {labelImageUrl
          ? <Image source={{ uri: labelImageUrl }} style={s.fill} resizeMode="contain" />
          : <View style={[s.fill, { backgroundColor: Colors.gray[200] }]} />}
      </View>
      {/* Card slot — center bay */}
      <View style={[s.slot, { top: height * 0.21, left: width * 0.135, width: width * 0.73, height: height * 0.7 }]}>
        {cardImageUrl
          ? <Image source={{ uri: cardImageUrl }} style={s.fill} resizeMode="contain" />
          : <View style={[s.fill, { backgroundColor: Colors.gray[100] }]} />}
      </View>
    </View>
  )
}

function OneTouchMockup({ labelImageUrl, cardImageUrl, width }: { labelImageUrl?: string | null; cardImageUrl?: string | null; width: number }) {
  // mag-one-touch-DCM.png is ~314x457 — preserve aspect (~0.687)
  const height = width / (314 / 457)
  return (
    <View style={[s.holder, { width, height }]}>
      <Image source={require('@/assets/images/mag-one-touch-DCM.png')} style={StyleSheet.absoluteFill as any} resizeMode="contain" />
      {/* Card slot — main face area */}
      <View style={[s.slot, { top: height * 0.18, left: width * 0.13, width: width * 0.74, height: height * 0.77 }]}>
        {cardImageUrl
          ? <Image source={{ uri: cardImageUrl }} style={s.fill} resizeMode="contain" />
          : <View style={[s.fill, { backgroundColor: Colors.gray[100] }]} />}
      </View>
      {/* Label slot — small label at top */}
      <View style={[s.slot, { top: height * 0.04, left: width * 0.18, width: width * 0.64, height: height * 0.1 }]}>
        {labelImageUrl
          ? <Image source={{ uri: labelImageUrl }} style={s.fill} resizeMode="contain" />
          : <View style={[s.fill, { backgroundColor: Colors.gray[200] }]} />}
      </View>
    </View>
  )
}

function ToploaderMockup({ labelImageUrl, cardImageUrl, width }: { labelImageUrl?: string | null; cardImageUrl?: string | null; width: number }) {
  // top-loader-dcm.png is ~451x588 — preserve aspect (~0.767)
  const height = width / (451 / 588)
  return (
    <View style={[s.holder, { width, height }]}>
      <Image source={require('@/assets/images/top-loader-dcm.png')} style={StyleSheet.absoluteFill as any} resizeMode="contain" />
      {/* Card slot */}
      <View style={[s.slot, { top: height * 0.13, left: width * 0.1, width: width * 0.8, height: height * 0.78 }]}>
        {cardImageUrl
          ? <Image source={{ uri: cardImageUrl }} style={s.fill} resizeMode="contain" />
          : <View style={[s.fill, { backgroundColor: Colors.gray[100] }]} />}
      </View>
      {/* Top edge label */}
      <View style={[s.slot, { top: height * 0.025, left: width * 0.18, width: width * 0.64, height: height * 0.07 }]}>
        {labelImageUrl
          ? <Image source={{ uri: labelImageUrl }} style={s.fill} resizeMode="contain" />
          : <View style={[s.fill, { backgroundColor: Colors.gray[200] }]} />}
      </View>
    </View>
  )
}

function DigitalMockup({ labelImageUrl, cardImageUrl, width }: { labelImageUrl?: string | null; cardImageUrl?: string | null; width: number }) {
  // Pure digital composite — label band on top, card below. No holder PNG.
  const cardAspect = 2.5 / 3.5
  const labelHeight = Math.round(width * 0.18)
  const cardHeight = Math.round(width / cardAspect)
  const totalHeight = labelHeight + cardHeight + 4
  return (
    <View style={[s.holder, { width, height: totalHeight, backgroundColor: '#000', borderRadius: 6, overflow: 'hidden' }]}>
      <View style={{ width: '100%', height: labelHeight, backgroundColor: '#1a1625' }}>
        {labelImageUrl
          ? <Image source={{ uri: labelImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          : null}
      </View>
      <View style={{ height: 4, backgroundColor: 'rgba(139,92,246,0.4)' }} />
      <View style={{ width: '100%', height: cardHeight, backgroundColor: '#0a0a12' }}>
        {cardImageUrl
          ? <Image source={{ uri: cardImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          : null}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  holder: { alignSelf: 'center', position: 'relative' },
  slot: { position: 'absolute', overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
})
