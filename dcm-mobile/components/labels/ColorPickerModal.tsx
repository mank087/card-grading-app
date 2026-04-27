import { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native'
import { Colors } from '@/lib/constants'

// ---------------------------------------------------------------------------
// Color conversion helpers
// ---------------------------------------------------------------------------

/** Convert HSV (h: 0-360, s: 0-1, v: 0-1) to a hex color string */
function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0, g = 0, b = 0

  if (h < 60)       { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else              { r = c; g = 0; b = x }

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** Convert a hex color string to HSV { h: 0-360, s: 0-1, v: 0-1 } */
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!match) return { h: 0, s: 0, v: 0 }

  const r = parseInt(match[1], 16) / 255
  const g = parseInt(match[2], 16) / 255
  const b = parseInt(match[3], 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  let h = 0
  if (d !== 0) {
    if (max === r)      h = ((g - b) / d + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else                h = (r - g) / d + 4
    h *= 60
  }

  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ColorPickerModalProps {
  visible: boolean
  currentColor: string
  onSelectColor: (hex: string) => void
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SV_SIZE = 250
const HUE_BAR_HEIGHT = 40

export default function ColorPickerModal({
  visible,
  currentColor,
  onSelectColor,
  onClose,
}: ColorPickerModalProps) {
  // Parse incoming color once on open
  const initial = hexToHsv(currentColor)
  const [hue, setHue] = useState(initial.h)
  const [sat, setSat] = useState(initial.s)
  const [val, setVal] = useState(initial.v)
  const [hexInput, setHexInput] = useState(currentColor)

  // Track layout positions for accurate touch mapping
  const hueBarLayout = useRef({ x: 0, y: 0, width: 1 })
  const svBoxLayout = useRef({ x: 0, y: 0, width: SV_SIZE, height: SV_SIZE })

  const selectedHex = hsvToHex(hue, sat, val)

  // Keep hex input in sync when dragging
  const updateFromHsv = useCallback((h: number, s: number, v: number) => {
    setHue(h)
    setSat(s)
    setVal(v)
    setHexInput(hsvToHex(h, s, v))
  }, [])

  // ---------- Hue bar touch handling ----------

  const handleHueTouch = useCallback(
    (pageX: number) => {
      const { x, width } = hueBarLayout.current
      const ratio = Math.max(0, Math.min(1, (pageX - x) / width))
      const newHue = ratio * 360
      updateFromHsv(newHue, sat, val)
    },
    [sat, val, updateFromHsv],
  )

  const onHueBarLayout = useCallback((e: LayoutChangeEvent) => {
    e.target.measureInWindow((x: number, y: number, width: number) => {
      hueBarLayout.current = { x, y, width }
    })
  }, [])

  // ---------- SV square touch handling ----------

  const handleSvTouch = useCallback(
    (pageX: number, pageY: number) => {
      const { x, y, width, height } = svBoxLayout.current
      const newSat = Math.max(0, Math.min(1, (pageX - x) / width))
      const newVal = Math.max(0, Math.min(1, 1 - (pageY - y) / height))
      updateFromHsv(hue, newSat, newVal)
    },
    [hue, updateFromHsv],
  )

  const onSvBoxLayout = useCallback((e: LayoutChangeEvent) => {
    e.target.measureInWindow((x: number, y: number, width: number, height: number) => {
      svBoxLayout.current = { x, y, width, height }
    })
  }, [])

  // ---------- Hex input ----------

  const handleHexSubmit = useCallback(() => {
    let cleaned = hexInput.trim()
    if (!cleaned.startsWith('#')) cleaned = `#${cleaned}`
    if (/^#[a-fA-F0-9]{6}$/.test(cleaned)) {
      const hsv = hexToHsv(cleaned)
      setHue(hsv.h)
      setSat(hsv.s)
      setVal(hsv.v)
      setHexInput(cleaned)
    } else {
      // Revert to current selection if invalid
      setHexInput(selectedHex)
    }
  }, [hexInput, selectedHex])

  // ---------- Done ----------

  const handleDone = useCallback(() => {
    onSelectColor(selectedHex)
    onClose()
  }, [selectedHex, onSelectColor, onClose])

  // Reset state when modal opens with a new color
  const lastColor = useRef(currentColor)
  if (visible && currentColor !== lastColor.current) {
    lastColor.current = currentColor
    const hsv = hexToHsv(currentColor)
    setHue(hsv.h)
    setSat(hsv.s)
    setVal(hsv.v)
    setHexInput(currentColor)
  }

  // Pure hue color for the SV square background
  const pureHue = hsvToHex(hue, 1, 1)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Title */}
          <Text style={styles.title}>Pick a Color</Text>

          {/* Current color swatch */}
          <View style={[styles.swatch, { backgroundColor: selectedHex }]}>
            <Text style={[styles.swatchText, { color: val > 0.55 && sat < 0.4 ? '#000' : '#fff' }]}>
              {selectedHex.toUpperCase()}
            </Text>
          </View>

          {/* Saturation / Brightness square */}
          <View
            style={[styles.svBox, { width: SV_SIZE, height: SV_SIZE }]}
            onLayout={onSvBoxLayout}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => handleSvTouch(e.nativeEvent.pageX, e.nativeEvent.pageY)}
            onResponderMove={(e) => handleSvTouch(e.nativeEvent.pageX, e.nativeEvent.pageY)}
          >
            {/* Base hue layer */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: pureHue }]} />
            {/* White-to-transparent gradient (saturation: left = white, right = full color) */}
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  // Simulated with two overlapping layers
                  // Left side white overlay fading to transparent
                  backgroundColor: 'transparent',
                },
              ]}
            >
              {/* Horizontal white overlay */}
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    // Use a row of sub-views to approximate the gradient
                    flexDirection: 'row',
                  },
                ]}
              >
                {Array.from({ length: 10 }).map((_, i) => (
                  <View
                    key={`sat-${i}`}
                    style={{
                      flex: 1,
                      backgroundColor: `rgba(255,255,255,${1 - i / 9})`,
                    }}
                  />
                ))}
              </View>
              {/* Vertical black overlay (bottom = dark) */}
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { flexDirection: 'column' },
                ]}
              >
                {Array.from({ length: 10 }).map((_, i) => (
                  <View
                    key={`val-${i}`}
                    style={{
                      flex: 1,
                      backgroundColor: `rgba(0,0,0,${i / 9})`,
                    }}
                  />
                ))}
              </View>
            </View>
            {/* Selection indicator */}
            <View
              pointerEvents="none"
              style={[
                styles.svIndicator,
                {
                  left: sat * SV_SIZE - 10,
                  top: (1 - val) * SV_SIZE - 10,
                },
              ]}
            />
          </View>

          {/* Hue bar */}
          <View
            style={[styles.hueBar, { height: HUE_BAR_HEIGHT }]}
            onLayout={onHueBarLayout}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => handleHueTouch(e.nativeEvent.pageX)}
            onResponderMove={(e) => handleHueTouch(e.nativeEvent.pageX)}
          >
            {/* Render 36 slices to approximate the hue spectrum */}
            {Array.from({ length: 36 }).map((_, i) => (
              <View
                key={`hue-${i}`}
                style={{
                  flex: 1,
                  backgroundColor: hsvToHex((i / 36) * 360, 1, 1),
                }}
              />
            ))}
            {/* Hue indicator */}
            <View
              pointerEvents="none"
              style={[
                styles.hueIndicator,
                {
                  left: (hue / 360) * 100 + '%' as any,
                },
              ]}
            />
          </View>

          {/* Hex input */}
          <View style={styles.hexRow}>
            <Text style={styles.hexLabel}>HEX</Text>
            <TextInput
              style={styles.hexInput}
              value={hexInput}
              onChangeText={setHexInput}
              onEndEditing={handleHexSubmit}
              onSubmitEditing={handleHexSubmit}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={7}
              placeholder="#000000"
              placeholderTextColor={Colors.gray[500]}
            />
          </View>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: 300,
    backgroundColor: Colors.gray[900],
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 16,
  },
  swatch: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  swatchText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  // SV square
  svBox: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  svIndicator: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 4,
  },
  // Hue bar
  hueBar: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 16,
    position: 'relative',
  },
  hueIndicator: {
    position: 'absolute',
    top: -2,
    width: 8,
    height: '115%' as any,
    marginLeft: -4,
    borderRadius: 4,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 3,
  },
  // Hex input row
  hexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  hexLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[400],
    marginRight: 10,
  },
  hexInput: {
    flex: 1,
    height: 40,
    backgroundColor: Colors.gray[800],
    borderRadius: 8,
    paddingHorizontal: 12,
    color: Colors.white,
    fontSize: 16,
    fontFamily: 'monospace',
    borderWidth: 1,
    borderColor: Colors.gray[700],
  },
  // Buttons
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    borderWidth: 1,
    borderColor: Colors.gray[700],
  },
  cancelText: {
    color: Colors.gray[300],
    fontSize: 16,
    fontWeight: '600',
  },
  doneButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.purple[600],
  },
  doneText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
})
