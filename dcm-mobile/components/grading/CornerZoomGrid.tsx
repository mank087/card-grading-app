import { useEffect, useState } from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { Colors } from '@/lib/constants'
import { resolveCornerTiles } from '@/lib/cornerTiles'

/**
 * CornerZoomGrid — 2x2 grid of close-ups of each CARD corner.
 *
 * Tiles are cropped around the card corners the grading engine detected
 * (cards.capture_quality — see lib/cornerTiles.ts). The old version zoomed the
 * photo's own corners, which on a typical phone shot (card ~50% of the frame,
 * on a mat) showed only the mat. With no detected corners the grid is hidden,
 * matching the web.
 */

interface CornerZoomGridProps {
  imageUrl: string
  side: 'Front' | 'Back'
  captureQuality?: unknown
}

export default function CornerZoomGrid({ imageUrl, side, captureQuality }: CornerZoomGridProps) {
  const tiles = resolveCornerTiles(captureQuality, side === 'Front' ? 'front' : 'back')
  // height / width of the photo — needed to lay the image out at square pixels.
  const [aspect, setAspect] = useState<number | null>(null)

  useEffect(() => {
    if (!tiles) return
    let cancelled = false
    setAspect(null)
    Image.getSize(
      imageUrl,
      (w, h) => { if (!cancelled && w > 0 && h > 0) setAspect(h / w) },
      () => {},
    )
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, !!tiles])

  if (!tiles || aspect === null) return null

  return (
    <View>
      <Text style={styles.title}>{side} Corners</Text>
      <View style={styles.grid}>
        {tiles.map((tile) => {
          // The square window spans `tile.size` of the image width, so the image
          // is drawn 1/size window-widths wide; percentages below are of the
          // (square) window.
          const widthPct = 100 / tile.size
          const heightPct = widthPct * aspect
          const left = (0.5 - tile.cx / tile.size) * 100
          const top = (0.5 - (tile.cy * aspect) / tile.size) * 100
          return (
            <View key={tile.key} style={styles.cornerCell}>
              <View style={styles.imageWrapper}>
                <Image
                  source={{ uri: imageUrl }}
                  style={[styles.zoomedImage, { width: `${widthPct}%`, height: `${heightPct}%`, left: `${left}%`, top: `${top}%` } as any]}
                  resizeMode="stretch"
                />
              </View>
              <Text style={styles.cornerLabel}>{tile.label}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.gray[800],
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cornerCell: {
    width: '48%' as any,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
    backgroundColor: Colors.gray[100],
  },
  zoomedImage: {
    position: 'absolute',
  },
  cornerLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.gray[500],
    textAlign: 'center',
    paddingVertical: 4,
    backgroundColor: Colors.gray[50],
  },
})
