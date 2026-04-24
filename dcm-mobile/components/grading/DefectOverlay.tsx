import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '@/lib/constants'

/**
 * DefectOverlay — Renders colored circles at defect locations
 * overlaid on top of a card image. Matches the web's DefectOverlay.
 *
 * Expects defect data with x_percent/y_percent coordinates from
 * the grading JSON.
 */

interface DefectMarker {
  id: number
  type: string
  severity: 'minor' | 'moderate' | 'heavy'
  description: string
  x_percent: number
  y_percent: number
}

interface DefectOverlayProps {
  defects: DefectMarker[]
}

const SEVERITY_COLORS = {
  minor: { bg: Colors.green[500], border: Colors.green[600] },
  moderate: { bg: Colors.amber[500], border: Colors.amber[600] },
  heavy: { bg: Colors.red[500], border: Colors.red[600] },
}

export default function DefectOverlay({ defects }: DefectOverlayProps) {
  if (!defects || defects.length === 0) return null

  return (
    <View style={styles.container} pointerEvents="none">
      {defects.map((defect) => {
        const colors = SEVERITY_COLORS[defect.severity] || SEVERITY_COLORS.minor
        return (
          <View
            key={defect.id}
            style={[
              styles.marker,
              {
                left: `${defect.x_percent}%` as any,
                top: `${defect.y_percent}%` as any,
                backgroundColor: colors.bg,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={styles.markerText}>{defect.id}</Text>
          </View>
        )
      })}
    </View>
  )
}

/**
 * Parse defect markers from the conversational_grading JSON.
 * Extracts defects with coordinates for overlay positioning.
 */
export function extractDefectMarkers(gradingJson: string | null, side: 'front' | 'back'): DefectMarker[] {
  if (!gradingJson) return []

  try {
    const json = typeof gradingJson === 'string' ? JSON.parse(gradingJson) : gradingJson
    const markers: DefectMarker[] = []
    let id = 1

    // Check corners
    const corners = json.corners?.[side]
    if (corners) {
      for (const [pos, data] of Object.entries(corners) as [string, any][]) {
        if (data?.defects && Array.isArray(data.defects) && data.defects.length > 0) {
          // Corner positions as percentages
          const coords: Record<string, { x: number; y: number }> = {
            top_left: { x: 8, y: 8 },
            top_right: { x: 92, y: 8 },
            bottom_left: { x: 8, y: 92 },
            bottom_right: { x: 92, y: 92 },
          }
          const coord = coords[pos] || { x: 50, y: 50 }
          for (const d of data.defects) {
            markers.push({
              id: id++,
              type: `Corner (${pos.replace('_', ' ')})`,
              severity: d.severity || 'minor',
              description: d.description || d,
              x_percent: coord.x,
              y_percent: coord.y,
            })
          }
        }
      }
    }

    // Check edges
    const edges = json.edges?.[side]
    if (edges) {
      for (const [pos, data] of Object.entries(edges) as [string, any][]) {
        if (data?.defects && Array.isArray(data.defects) && data.defects.length > 0) {
          const coords: Record<string, { x: number; y: number }> = {
            top: { x: 50, y: 5 },
            bottom: { x: 50, y: 95 },
            left: { x: 5, y: 50 },
            right: { x: 95, y: 50 },
          }
          const coord = coords[pos] || { x: 50, y: 50 }
          for (const d of data.defects) {
            markers.push({
              id: id++,
              type: `Edge (${pos})`,
              severity: d.severity || 'minor',
              description: d.description || d,
              x_percent: coord.x,
              y_percent: coord.y,
            })
          }
        }
      }
    }

    // Check surface
    const surface = json.surface?.[side]
    if (surface?.defects && Array.isArray(surface.defects)) {
      for (const d of surface.defects) {
        markers.push({
          id: id++,
          type: 'Surface',
          severity: d.severity || 'minor',
          description: d.description || d,
          x_percent: d.x_percent || 50,
          y_percent: d.y_percent || 50,
        })
      }
    }

    return markers
  } catch {
    return []
  }
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  marker: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -11,
    marginTop: -11,
  },
  markerText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
})
