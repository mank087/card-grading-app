import { View, Text, Image, StyleSheet } from 'react-native'
import { Colors } from '@/lib/constants'

/**
 * CornerZoomGrid — 2x2 grid showing zoomed-in views of each corner.
 * Uses Image component with specific crop regions to simulate
 * the web's CSS backgroundSize/backgroundPosition technique.
 */

interface CornerZoomGridProps {
  imageUrl: string
  side: 'Front' | 'Back'
}

const corners = [
  { label: 'Top Left', offset: { top: 0, left: 0 } },
  { label: 'Top Right', offset: { top: 0, left: '-150%' } },
  { label: 'Bottom Left', offset: { top: '-150%', left: 0 } },
  { label: 'Bottom Right', offset: { top: '-150%', left: '-150%' } },
]

export default function CornerZoomGrid({ imageUrl, side }: CornerZoomGridProps) {
  return (
    <View>
      <Text style={styles.title}>{side} Corners</Text>
      <View style={styles.grid}>
        {corners.map((corner) => (
          <View key={corner.label} style={styles.cornerCell}>
            <View style={styles.imageWrapper}>
              {/* Overflow hidden container shows only corner region */}
              <Image
                source={{ uri: imageUrl }}
                style={[styles.zoomedImage, { top: corner.offset.top, left: corner.offset.left }]}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.cornerLabel}>{corner.label}</Text>
          </View>
        ))}
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
    width: '250%',
    height: '250%',
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
