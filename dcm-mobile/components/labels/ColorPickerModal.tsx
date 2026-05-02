import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  ScrollView, Image, LayoutChangeEvent, Dimensions,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { Colors } from '@/lib/constants'

// ---------------------------------------------------------------------------
// Color conversion helpers
// ---------------------------------------------------------------------------

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60)       { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else              { r = c; b = x }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!match) return { h: 0, s: 0, v: 0 }
  const r = parseInt(match[1], 16) / 255
  const g = parseInt(match[2], 16) / 255
  const b = parseInt(match[3], 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

// ---------------------------------------------------------------------------
// Quick preset colors
// ---------------------------------------------------------------------------

const QUICK_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#d946ef', '#ec4899', '#f43f5e', '#78716c', '#1f2937', '#ffffff',
]

// ---------------------------------------------------------------------------
// Pick from Card HTML — minimal WebView canvas for pixel sampling
// ---------------------------------------------------------------------------

function getPickerHtml(imageUrl: string) {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#f3f4f6;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden}
canvas{max-width:100%;max-height:100%;touch-action:none;border-radius:8px}</style></head><body>
<canvas id="c"></canvas>
<script>
var canvas=document.getElementById('c'),ctx=canvas.getContext('2d'),img=new Image();
img.crossOrigin='anonymous';
img.onload=function(){
  var scale=Math.min(300/img.width,400/img.height,1);
  canvas.width=Math.round(img.width*scale);
  canvas.height=Math.round(img.height*scale);
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}));
};
img.src='${imageUrl}';
function sample(e){
  var rect=canvas.getBoundingClientRect();
  var x=Math.floor((e.clientX-rect.left)*(canvas.width/rect.width));
  var y=Math.floor((e.clientY-rect.top)*(canvas.height/rect.height));
  if(x<0||y<0||x>=canvas.width||y>=canvas.height)return;
  var p=ctx.getImageData(x,y,1,1).data;
  var hex='#'+[p[0],p[1],p[2]].map(function(v){return v.toString(16).padStart(2,'0')}).join('');
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'color',hex:hex}));
}
canvas.addEventListener('click',sample);
canvas.addEventListener('touchend',function(e){e.preventDefault();var t=e.changedTouches[0];if(t)sample(t)});
</script></body></html>`
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ColorPickerModalProps {
  visible: boolean
  currentColor: string
  onSelectColor: (hex: string) => void
  onClose: () => void
  cardImageUrl?: string | null  // front card image for "Pick from Card" tab
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SCREEN_W = Dimensions.get('window').width

export default function ColorPickerModal({
  visible,
  currentColor,
  onSelectColor,
  onClose,
  cardImageUrl,
}: ColorPickerModalProps) {
  const [tab, setTab] = useState<'presets' | 'custom' | 'card'>('presets')
  const [hue, setHue] = useState(0)
  const [sat, setSat] = useState(0)
  const [val, setVal] = useState(0)
  const [hexInput, setHexInput] = useState(currentColor)
  const [pendingColor, setPendingColor] = useState(currentColor)

  const hueBarLayout = useRef({ x: 0, y: 0, width: 1 })
  const svBoxLayout = useRef({ x: 0, y: 0, width: 250, height: 250 })

  // Reset on open
  const lastColor = useRef(currentColor)
  if (visible && currentColor !== lastColor.current) {
    lastColor.current = currentColor
    const hsv = hexToHsv(currentColor)
    setHue(hsv.h); setSat(hsv.s); setVal(hsv.v)
    setHexInput(currentColor)
    setPendingColor(currentColor)
    setTab('presets')
  }

  const updateFromHsv = useCallback((h: number, s: number, v: number) => {
    setHue(h); setSat(s); setVal(v)
    const hex = hsvToHex(h, s, v)
    setHexInput(hex); setPendingColor(hex)
  }, [])

  const handleHueTouch = useCallback((pageX: number) => {
    const { x, width } = hueBarLayout.current
    const newHue = Math.max(0, Math.min(360, ((pageX - x) / width) * 360))
    updateFromHsv(newHue, sat, val)
  }, [sat, val, updateFromHsv])

  const handleSvTouch = useCallback((pageX: number, pageY: number) => {
    const { x, y, width, height } = svBoxLayout.current
    const newSat = Math.max(0, Math.min(1, (pageX - x) / width))
    const newVal = Math.max(0, Math.min(1, 1 - (pageY - y) / height))
    updateFromHsv(hue, newSat, newVal)
  }, [hue, updateFromHsv])

  const handleHexSubmit = useCallback(() => {
    let cleaned = hexInput.trim()
    if (!cleaned.startsWith('#')) cleaned = `#${cleaned}`
    if (/^#[a-fA-F0-9]{6}$/.test(cleaned)) {
      const hsv = hexToHsv(cleaned)
      setHue(hsv.h); setSat(hsv.s); setVal(hsv.v)
      setPendingColor(cleaned); setHexInput(cleaned)
    } else {
      setHexInput(pendingColor)
    }
  }, [hexInput, pendingColor])

  const pureHue = hsvToHex(hue, 1, 1)
  const SV_SIZE = Math.min(SCREEN_W - 80, 250)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        <View style={st.container}>
          {/* Header: preview + hex + buttons */}
          <View style={st.header}>
            <View style={[st.previewSwatch, { backgroundColor: pendingColor }]} />
            <Text style={st.previewHex}>{pendingColor}</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} style={st.headerBtn}>
              <Text style={st.headerBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onSelectColor(pendingColor)} style={[st.headerBtn, st.headerBtnDone]}>
              <Text style={st.headerBtnDoneText}>OK</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={st.tabs}>
            {(['presets', 'custom', ...(cardImageUrl ? ['card'] : [])] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[st.tab, tab === t && st.tabActive]}
                onPress={() => setTab(t as any)}
              >
                <Text style={[st.tabText, tab === t && st.tabTextActive]}>
                  {t === 'presets' ? 'Presets' : t === 'custom' ? 'Custom' : 'From Card'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={st.body} contentContainerStyle={{ paddingBottom: 16 }}>
            {/* Presets tab */}
            {tab === 'presets' && (
              <View style={st.presetsGrid}>
                {QUICK_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      st.presetSwatch,
                      { backgroundColor: c },
                      pendingColor === c && st.presetSwatchActive,
                    ]}
                    onPress={() => { setPendingColor(c); setHexInput(c); const hsv = hexToHsv(c); setHue(hsv.h); setSat(hsv.s); setVal(hsv.v) }}
                  />
                ))}
              </View>
            )}

            {/* Custom tab */}
            {tab === 'custom' && (
              <View style={{ alignItems: 'center', gap: 12 }}>
                {/* SV Square */}
                <View
                  style={[st.svBox, { width: SV_SIZE, height: SV_SIZE }]}
                  onLayout={(e) => {
                    e.target.measureInWindow((x: number, y: number, w: number, h: number) => {
                      svBoxLayout.current = { x, y, width: w, height: h }
                    })
                  }}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={(e) => handleSvTouch(e.nativeEvent.pageX, e.nativeEvent.pageY)}
                  onResponderMove={(e) => handleSvTouch(e.nativeEvent.pageX, e.nativeEvent.pageY)}
                >
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: pureHue }]} />
                  <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <View key={i} style={{ flex: 1, backgroundColor: `rgba(255,255,255,${1 - i / 11})` }} />
                    ))}
                  </View>
                  <View style={[StyleSheet.absoluteFill, { flexDirection: 'column' }]}>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <View key={i} style={{ flex: 1, backgroundColor: `rgba(0,0,0,${i / 11})` }} />
                    ))}
                  </View>
                  <View pointerEvents="none" style={[st.svIndicator, { left: sat * SV_SIZE - 10, top: (1 - val) * SV_SIZE - 10 }]} />
                </View>

                {/* Hue bar */}
                <View
                  style={st.hueBar}
                  onLayout={(e) => {
                    e.target.measureInWindow((x: number, _y: number, w: number) => {
                      hueBarLayout.current = { x, y: 0, width: w }
                    })
                  }}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={(e) => handleHueTouch(e.nativeEvent.pageX)}
                  onResponderMove={(e) => handleHueTouch(e.nativeEvent.pageX)}
                >
                  {Array.from({ length: 36 }).map((_, i) => (
                    <View key={i} style={{ flex: 1, backgroundColor: hsvToHex((i / 36) * 360, 1, 1) }} />
                  ))}
                  <View pointerEvents="none" style={[st.hueIndicator, { left: `${(hue / 360) * 100}%` as any }]} />
                </View>

                {/* Hex input */}
                <View style={st.hexRow}>
                  <Text style={st.hexLabel}>HEX</Text>
                  <TextInput
                    style={st.hexInput}
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
              </View>
            )}

            {/* Pick from Card tab */}
            {tab === 'card' && cardImageUrl && (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 11, color: Colors.purple[600], fontWeight: '600', textAlign: 'center' }}>
                  Tap the card to pick a color
                </Text>
                <View style={{ width: '100%', height: 300, borderRadius: 8, overflow: 'hidden' }}>
                  <WebView
                    source={{ html: getPickerHtml(cardImageUrl) }}
                    style={{ flex: 1, backgroundColor: '#f3f4f6' }}
                    javaScriptEnabled
                    originWhitelist={['*']}
                    scrollEnabled={false}
                    onMessage={(event) => {
                      try {
                        const msg = JSON.parse(event.nativeEvent.data)
                        if (msg.type === 'color' && msg.hex) {
                          setPendingColor(msg.hex)
                          setHexInput(msg.hex)
                          const hsv = hexToHsv(msg.hex)
                          setHue(hsv.h); setSat(hsv.s); setVal(hsv.v)
                        }
                      } catch {}
                    }}
                  />
                </View>
                {/* Show picked color preview */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: pendingColor, borderWidth: 1, borderColor: Colors.gray[300] }} />
                  <Text style={{ fontSize: 12, fontFamily: 'monospace', color: Colors.gray[600] }}>{pendingColor}</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  container: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.gray[200] },
  previewSwatch: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: Colors.gray[300] },
  previewHex: { fontSize: 13, fontFamily: 'monospace', color: Colors.gray[600] },
  headerBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: Colors.gray[300] },
  headerBtnText: { fontSize: 13, color: Colors.gray[600], fontWeight: '600' },
  headerBtnDone: { backgroundColor: Colors.purple[600], borderColor: Colors.purple[600] },
  headerBtnDoneText: { fontSize: 13, color: '#fff', fontWeight: '700' },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.gray[200] },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.purple[600] },
  tabText: { fontSize: 12, fontWeight: '600', color: Colors.gray[400] },
  tabTextActive: { color: Colors.purple[700] },

  body: { padding: 16 },

  // Presets — 5 columns × N rows of clearly visible color squares.
  // Was 6 cols at (SCREEN_W-80)/6 - 10 ≈ 40px each, which collapsed to thin
  // lines once the 2px border was applied.
  presetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  presetSwatch: { width: '18%', aspectRatio: 1, minHeight: 56, borderRadius: 10, borderWidth: 2, borderColor: Colors.gray[200] },
  presetSwatchActive: { borderColor: Colors.purple[600], borderWidth: 3 },

  // SV square
  svBox: { borderRadius: 8, overflow: 'hidden', position: 'relative' },
  svIndicator: { position: 'absolute', width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 2, elevation: 4 },

  // Hue bar
  hueBar: { width: '100%', height: 36, borderRadius: 8, overflow: 'hidden', flexDirection: 'row', position: 'relative' },
  hueIndicator: { position: 'absolute', top: -2, width: 8, height: 40, marginLeft: -4, borderRadius: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.3)', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 2, elevation: 3 },

  // Hex input
  hexRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  hexLabel: { fontSize: 13, fontWeight: '600', color: Colors.gray[500], marginRight: 8 },
  hexInput: { flex: 1, height: 38, backgroundColor: Colors.gray[50], borderRadius: 8, paddingHorizontal: 12, color: Colors.gray[900], fontSize: 14, fontFamily: 'monospace', borderWidth: 1, borderColor: Colors.gray[200] },
})
