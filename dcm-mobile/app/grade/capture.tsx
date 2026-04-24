import { useState, useRef, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Platform } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Colors } from '@/lib/constants'
import { compressImage, cropToCardAspect, assessQuality, hashImage, QualityResult, CompressedImage } from '@/lib/imageUtils'
import Button from '@/components/ui/Button'

export default function CaptureScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ category: string; subCategory?: string }>()
  const cameraRef = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<'front' | 'back'>('back')
  const [currentSide, setCurrentSide] = useState<'front' | 'back'>('front')
  const [isCapturing, setIsCapturing] = useState(false)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')

  // Captured images
  const [frontUri, setFrontUri] = useState<string | null>(null)
  const [backUri, setBackUri] = useState<string | null>(null)
  const [frontCompressed, setFrontCompressed] = useState<CompressedImage | null>(null)
  const [backCompressed, setBackCompressed] = useState<CompressedImage | null>(null)
  const [frontQuality, setFrontQuality] = useState<QualityResult | null>(null)
  const [backQuality, setBackQuality] = useState<QualityResult | null>(null)
  const [frontHash, setFrontHash] = useState<string | null>(null)
  const [backHash, setBackHash] = useState<string | null>(null)

  // Preview state
  const insets = useSafeAreaInsets()
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [previewQuality, setPreviewQuality] = useState<QualityResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  if (!permission) return <View style={styles.container} />

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color={Colors.gray[400]} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>We need camera access to photograph your card for grading.</Text>
        <Button title="Grant Camera Access" onPress={requestPermission} />
      </View>
    )
  }

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return
    setIsCapturing(true)

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92 })
      if (!photo?.uri) throw new Error('Capture failed')

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setIsProcessing(true)

      // Crop to card aspect ratio
      const croppedUri = await cropToCardAspect(photo.uri, orientation)

      // Compress
      const compressed = await compressImage(croppedUri)

      // Quality assessment
      const quality = assessQuality(compressed)

      // Hash for duplicate detection
      const hash = await hashImage(compressed.uri)

      setPreviewUri(compressed.uri)
      setPreviewQuality(quality)

      // Store for current side
      if (currentSide === 'front') {
        setFrontUri(compressed.uri)
        setFrontCompressed(compressed)
        setFrontQuality(quality)
        setFrontHash(hash)
      } else {
        // Check for duplicate
        if (frontHash && hash === frontHash) {
          Alert.alert('Duplicate Image', 'Front and back images appear to be the same. Please capture the other side of the card.')
          setPreviewUri(null)
          setPreviewQuality(null)
          setIsProcessing(false)
          setIsCapturing(false)
          return
        }
        setBackUri(compressed.uri)
        setBackCompressed(compressed)
        setBackQuality(quality)
        setBackHash(hash)
      }
    } catch (err) {
      console.error('Capture error:', err)
      Alert.alert('Capture Failed', 'Please try again.')
    } finally {
      setIsCapturing(false)
      setIsProcessing(false)
    }
  }

  const handleUseImage = () => {
    if (currentSide === 'front' && !backUri) {
      // Advance to back capture
      setCurrentSide('back')
      setPreviewUri(null)
      setPreviewQuality(null)
    } else if (currentSide === 'back' && !frontUri) {
      // Go back to front
      setCurrentSide('front')
      setPreviewUri(null)
      setPreviewQuality(null)
    } else {
      // Both captured — go to review
      router.push({
        pathname: '/grade/review',
        params: {
          category: params.category,
          subCategory: params.subCategory || '',
          frontUri: frontUri || previewUri || '',
          backUri: currentSide === 'back' ? (previewUri || backUri || '') : (backUri || ''),
          frontWidth: String(frontCompressed?.width || 0),
          frontHeight: String(frontCompressed?.height || 0),
          backWidth: String(backCompressed?.width || 0),
          backHeight: String(backCompressed?.height || 0),
        },
      })
    }
  }

  const handleRetake = () => {
    setPreviewUri(null)
    setPreviewQuality(null)
    if (currentSide === 'front') {
      setFrontUri(null)
      setFrontCompressed(null)
      setFrontQuality(null)
      setFrontHash(null)
    } else {
      setBackUri(null)
      setBackCompressed(null)
      setBackQuality(null)
      setBackHash(null)
    }
  }

  const gradeColor = previewQuality?.grade === 'A' ? Colors.green[500]
    : previewQuality?.grade === 'B' ? Colors.blue[500]
    : previewQuality?.grade === 'C' ? Colors.amber[500]
    : Colors.red[500]

  // Preview mode
  if (previewUri && previewQuality) {
    return (
      <View style={styles.container}>
        <View style={[styles.previewHeader, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.previewSideLabel}>{currentSide === 'front' ? 'Front' : 'Back'} Image</Text>
          <View style={[styles.qualityBadge, { backgroundColor: gradeColor }]}>
            <Text style={styles.qualityBadgeText}>{previewQuality.grade} ({previewQuality.score}/100)</Text>
          </View>
        </View>

        <View style={styles.previewImageContainer}>
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
        </View>

        <View style={styles.qualityDetails}>
          <View style={styles.qualityRow}>
            <Ionicons name="eye" size={16} color={Colors.gray[500]} />
            <Text style={styles.qualityLabel}>Sharpness: {previewQuality.blurLabel}</Text>
          </View>
          <View style={styles.qualityRow}>
            <Ionicons name="sunny" size={16} color={Colors.gray[500]} />
            <Text style={styles.qualityLabel}>Brightness: {previewQuality.brightnessLabel}</Text>
          </View>
          <Text style={styles.uncertaintyText}>Grade uncertainty: {previewQuality.uncertainty}</Text>
          {previewQuality.suggestions.map((s, i) => (
            <Text key={i} style={styles.suggestionText}>{s}</Text>
          ))}
        </View>

        <View style={[styles.previewActions, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
            <Ionicons name="refresh" size={20} color={Colors.gray[700]} />
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.useButton, { backgroundColor: gradeColor }]} onPress={handleUseImage}>
            <Ionicons name="checkmark" size={20} color={Colors.white} />
            <Text style={styles.useText}>
              {(currentSide === 'front' && !backUri) ? 'Use — Capture Back' :
               (currentSide === 'back' && !frontUri) ? 'Use — Capture Front' :
               'Use — Review'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Camera mode
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.cameraHeader, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="close" size={28} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Image source={require('@/assets/images/dcm-logo.png')} style={styles.headerLogo} resizeMode="contain" tintColor="white" />
          <Text style={styles.headerSide}>{currentSide === 'front' ? 'FRONT' : 'BACK'}</Text>
        </View>
        <TouchableOpacity onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')} style={styles.headerButton}>
          <Ionicons name="camera-reverse" size={28} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Camera */}
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
          {/* Guide overlay */}
          <View style={styles.guideContainer}>
            <View style={[styles.guide, { aspectRatio: orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5 }]}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              <Text style={styles.guideLabel}>{currentSide === 'front' ? 'FRONT' : 'BACK'}</Text>
            </View>
          </View>
        </CameraView>
      </View>

      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={styles.capturedIndicators}>
          <View style={[styles.indicator, frontUri && styles.indicatorDone]}>
            <Text style={styles.indicatorText}>Front {frontUri ? '✓' : ''}</Text>
          </View>
          <View style={[styles.indicator, backUri && styles.indicatorDone]}>
            <Text style={styles.indicatorText}>Back {backUri ? '✓' : ''}</Text>
          </View>
        </View>
      </View>

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          onPress={() => setOrientation(o => o === 'portrait' ? 'landscape' : 'portrait')}
          style={styles.controlButton}
        >
          <Ionicons name="phone-landscape" size={22} color={Colors.white} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.captureButton}
          onPress={handleCapture}
          disabled={isCapturing || isProcessing}
          activeOpacity={0.7}
        >
          <View style={[styles.captureInner, (isCapturing || isProcessing) && { opacity: 0.5 }]} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setCurrentSide(s => s === 'front' ? 'back' : 'front')}
          style={styles.controlButton}
        >
          <Ionicons name="swap-horizontal" size={22} color={Colors.white} />
          <Text style={styles.controlLabel}>{currentSide === 'front' ? 'Back' : 'Front'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[900] },

  // Permission
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: Colors.gray[50], gap: 16 },
  permissionTitle: { fontSize: 20, fontWeight: '700', color: Colors.gray[900] },
  permissionText: { fontSize: 14, color: Colors.gray[500], textAlign: 'center' },

  // Camera header
  cameraHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.6)' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLogo: { width: 28, height: 28 },
  headerSide: { color: Colors.white, fontSize: 16, fontWeight: '700', letterSpacing: 1 },

  // Camera
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },

  // Guide
  guideContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  guide: { width: '70%', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 4, position: 'relative' },
  guideLabel: { position: 'absolute', alignSelf: 'center', top: '45%', color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: '600', letterSpacing: 2 },
  corner: { position: 'absolute', width: 20, height: 20, borderColor: Colors.white },
  cornerTL: { top: -1, left: -1, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: -1, right: -1, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: -1, left: -1, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: -1, right: -1, borderBottomWidth: 3, borderRightWidth: 3 },

  // Status
  statusBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.6)' },
  capturedIndicators: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  indicator: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: Colors.gray[600] },
  indicatorDone: { borderColor: Colors.green[500], backgroundColor: 'rgba(34,197,94,0.2)' },
  indicatorText: { color: Colors.white, fontSize: 12, fontWeight: '600' },

  // Controls
  controls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 20, backgroundColor: 'rgba(0,0,0,0.8)' },
  captureButton: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: Colors.white, padding: 4 },
  captureInner: { flex: 1, borderRadius: 30, backgroundColor: Colors.white },
  controlButton: { alignItems: 'center', gap: 4, width: 60 },
  controlLabel: { color: Colors.gray[400], fontSize: 10, fontWeight: '500' },

  // Preview
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: Colors.gray[900] },
  previewSideLabel: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  qualityBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  qualityBadgeText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  previewImageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.gray[900], padding: 16 },
  previewImage: { width: '80%', aspectRatio: 0.714, borderRadius: 8 },
  qualityDetails: { padding: 16, backgroundColor: Colors.gray[800], gap: 6 },
  qualityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qualityLabel: { color: Colors.gray[300], fontSize: 13 },
  uncertaintyText: { color: Colors.gray[400], fontSize: 12, marginTop: 4 },
  suggestionText: { color: Colors.amber[500], fontSize: 12 },
  previewActions: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: Colors.gray[900] },
  retakeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.gray[200] },
  retakeText: { fontSize: 15, fontWeight: '600', color: Colors.gray[700] },
  useButton: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  useText: { fontSize: 15, fontWeight: '600', color: Colors.white },
})
