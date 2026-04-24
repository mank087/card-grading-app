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
  { label: 'Top Left', position: { top: 0, left: 0 } },
  { label: 'Top Right', position: { top: 0, right: 0 } },
  { label: 'Bottom Left', position: { bottom: 0, left: 0 } },
  { label: 'Bottom Right', position: { bottom: 0, right: 0 } },
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
                style={[
                  styles.zoomedImage,
                  corner.position.top !== undefined && { top: corner.position.top === 0 ? 0 : undefined },
                  corner.position.bottom !== undefined && { bottom: corner.position.bottom === 0 ? 0 : undefined },
                  corner.position.left !== undefined && { left: corner.position.left === 0 ? 0 : undefined },
                  corner.position.right !== undefined && { right: corner.position.right === 0 ? 0 : undefined },
                ]}
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
