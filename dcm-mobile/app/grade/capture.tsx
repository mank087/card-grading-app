import { useState, useRef, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Platform, ScrollView } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { StatusBar } from 'expo-status-bar'
import { Colors } from '@/lib/constants'
import { assessQuality, compressImage, hashImage, processCardCapture, QualityResult, CompressedImage } from '@/lib/imageUtils'
import Button from '@/components/ui/Button'
import PhotoTipsModal, { shouldShowPhotoTips } from '@/components/PhotoTipsModal'
import { useResponsive } from '@/hooks/useResponsive'

export default function CaptureScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ category: string; subCategory?: string; mode?: string; tipsAcked?: string }>()
  const cameraRef = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<'front' | 'back'>('back')
  const [currentSide, setCurrentSide] = useState<'front' | 'back'>('front')
  const [isCapturing, setIsCapturing] = useState(false)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const { isTablet } = useResponsive()
  // expo-camera's default pictureSize is conservative (often 1920x1080 or
  // lower). On large screens like iPad that looks visibly soft. After the
  // camera is ready we ask the device for its full list of available sizes
  // and pin pictureSize to the highest one. Undefined on first render so
  // the camera initializes with its safe default; flips to the max once
  // onCameraReady fires.
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined)

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

  // Method (camera vs gallery) — pre-selected from the main grade screen, defaults to camera
  const [mode, setMode] = useState<'camera' | 'gallery'>(params.mode === 'gallery' ? 'gallery' : 'camera')

  // Pro Tip modal — only gates here when the main grade screen didn't already show it
  // (signaled by tipsAcked=1 in query params). Otherwise users would see the tips twice.
  const [tipsVisible, setTipsVisible] = useState(false)
  const [tipsLoaded, setTipsLoaded] = useState(false)
  const [shouldGateOnTips, setShouldGateOnTips] = useState(true)
  const [pendingAction, setPendingAction] = useState<'capture' | 'gallery' | null>(null)

  useEffect(() => {
    if (params.tipsAcked === '1') {
      // Main grade screen already showed (or skipped) the tips
      setShouldGateOnTips(false)
      setTipsLoaded(true)
      return
    }
    shouldShowPhotoTips().then(should => {
      setShouldGateOnTips(should)
      setTipsLoaded(true)
    })
  }, [params.tipsAcked])

  // Run a picked image through the compress → quality → hash pipeline
  // and stash it as the current side. GALLERY PATH ONLY — the camera path
  // uses processCardCapture directly in handleCapture.
  const processImage = async (rawUri: string) => {
    setIsProcessing(true)
    try {
      // Gallery images are NEVER auto-cropped. The center-band + card-aspect
      // crop in processCardCapture exists solely to compensate for the
      // camera preview's aspect-fill; applied to a user-framed photo
      // (e.g. a DSLR shot transferred to the phone) it slices off parts of
      // the card — especially when the photo's aspect differs from 2.5:3.5.
      // Resize + compress only, exactly like the web gallery path.
      const compressed = await compressImage(rawUri)

      // v8.9 MINIMUM-RESOLUTION GATE (matches web): below ~1000px the grading AI
      // physically cannot resolve edge whitening, corner wear, or fine print.
      if (Math.max(compressed.width, compressed.height) < 1000) {
        Alert.alert(
          'Image Too Small',
          `This image is ${compressed.width}×${compressed.height} — too small to grade accurately. Please pick the original photo (at least 1000px on the long side). Screenshots and thumbnails lose the detail needed for corner and edge inspection.`
        )
        setPreviewUri(null)
        setPreviewQuality(null)
        return
      }
      const quality = assessQuality(compressed)
      const hash = await hashImage(compressed.uri)

      setPreviewUri(compressed.uri)
      setPreviewQuality(quality)

      if (currentSide === 'front') {
        setFrontUri(compressed.uri)
        setFrontCompressed(compressed)
        setFrontQuality(quality)
        setFrontHash(hash)
      } else {
        if (frontHash && hash === frontHash) {
          Alert.alert('Duplicate Image', 'Front and back images appear to be the same. Please pick the other side.')
          setPreviewUri(null)
          setPreviewQuality(null)
          return
        }
        setBackUri(compressed.uri)
        setBackCompressed(compressed)
        setBackQuality(quality)
        setBackHash(hash)
      }
    } catch (err) {
      console.error('[capture] processImage error:', err)
      Alert.alert('Processing Failed', 'Could not process that image. Try a different one.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Gallery selection
  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to choose card images.')
      return
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 1,
        exif: false,
      })
      if (result.canceled) return
      const asset = result.assets?.[0]
      if (!asset?.uri) return
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      await processImage(asset.uri)
    } catch (err) {
      console.warn('[capture] picker error:', err)
      Alert.alert('Picker failed', String((err as any)?.message || err))
    }
  }

  // Gate the first capture/gallery action behind the Pro Tip modal
  const requestCapture = () => {
    if (shouldGateOnTips && tipsLoaded) {
      setPendingAction('capture')
      setTipsVisible(true)
    } else {
      handleCapture()
    }
  }
  const requestGallery = () => {
    if (shouldGateOnTips && tipsLoaded) {
      setPendingAction('gallery')
      setTipsVisible(true)
    } else {
      pickFromGallery()
    }
  }

  // When the camera initializes, query supported picture sizes and pick the
  // largest by total pixel count. Sizes come back as strings like "1920x1080"
  // or "3840x2160"; we parse, rank, and apply. Silently no-op if the device
  // returns an empty list (rare — has happened on some older Androids).
  // Defined before early returns to keep hook order stable across renders.
  const handleCameraReady = useCallback(async () => {
    if (!cameraRef.current || pictureSize) return
    try {
      const sizes = await cameraRef.current.getAvailablePictureSizesAsync()
      if (!sizes || sizes.length === 0) return
      const ranked = sizes
        .map(label => {
          const m = /^(\d+)x(\d+)$/.exec(label)
          return { label, px: m ? Number(m[1]) * Number(m[2]) : 0 }
        })
        .sort((a, b) => b.px - a.px)
      const best = ranked[0]?.label
      if (best) setPictureSize(best)
    } catch {
      // Fall back to default if querying fails — capture still works,
      // just at the camera's stock resolution.
    }
  }, [pictureSize])

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
      // Always give the lens ~200ms to settle before the shutter fires.
      // The previous version delayed only on iPad because iPhones
      // autofocus quickly; in practice Android phones land somewhere in
      // between and the user can tap shutter mid-focus-sweep. A small
      // universal delay catches all the focus-sweep blur cases without
      // a perceptible UI hitch. shutterSound: false suppresses the
      // system camera click (Japanese/Korean Android devices force it
      // on by law, so the flag is ignored there).
      await new Promise(r => setTimeout(r, isTablet ? 250 : 180))
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92, shutterSound: false })
      if (!photo?.uri) throw new Error('Capture failed')

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setIsProcessing(true)

      // Single ImageManipulator pass — see processCardCapture for the
      // crop/resize/compress math. Replaces the previous chain of
      // probe → cropToCardAspect → compressImage which compounded
      // JPEG re-encodes and softened the final photo.
      const compressed = await processCardCapture(
        photo.uri,
        orientation,
        photo.width && photo.height ? { width: photo.width, height: photo.height } : undefined,
      )

      // v8.9 MINIMUM-RESOLUTION GATE (matches web/gallery)
      if (Math.max(compressed.width, compressed.height) < 1000) {
        Alert.alert(
          'Capture Too Small',
          'The captured photo resolution is too low for accurate grading. Move closer to the card and retake.'
        )
        setIsCapturing(false)
        setIsProcessing(false)
        return
      }

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
    if (currentSide === 'front') {
      // Front just captured — advance to back camera
      if (__DEV__) console.log('[Capture] Front captured, advancing to back')
      setCurrentSide('back')
      setPreviewUri(null)
      setPreviewQuality(null)
    } else {
      // Back just captured — both sides done, go to review
      // Use previewUri for the back since state may not have flushed yet
      const finalFrontUri = frontUri!
      const finalBackUri = previewUri!
      if (__DEV__) {
        console.log('[Capture] Both captured, navigating to review')
        console.log('[Capture] Front URI:', finalFrontUri?.substring(0, 50))
        console.log('[Capture] Back URI:', finalBackUri?.substring(0, 50))
      }

      router.push({
        pathname: '/grade/review',
        params: {
          category: params.category,
          subCategory: params.subCategory || '',
          frontUri: finalFrontUri,
          backUri: finalBackUri,
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
    const isFront = currentSide === 'front'
    return (
      <View style={styles.container}>
        <View style={[styles.previewHeader, { paddingTop: insets.top + 8 }]}>
          <View style={styles.previewHeaderText}>
            <Text style={styles.previewStep}>STEP {isFront ? '1' : '2'} OF 2</Text>
            <Text style={styles.previewSideLabel}>{isFront ? 'Front' : 'Back'} Image</Text>
          </View>
          <View style={[styles.qualityBadge, { backgroundColor: gradeColor }]}>
            <Text style={styles.qualityBadgeText}>{previewQuality.grade} ({previewQuality.score}/100)</Text>
          </View>
        </View>

        {/* Scrollable middle. Previously this was a fixed flex column with no
            scroll: a tall image plus a long quality-suggestion list (common on
            lower-quality gallery uploads) pushed the action bar below the screen
            edge, stranding users on a full-screen image with no reachable "next"
            control. The image + details now scroll; the action bar is a pinned
            footer that can never be clipped. */}
        <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewScrollContent}>
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
        </ScrollView>

        <View style={[styles.previewActions, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={handleRetake}
            accessibilityLabel="Retake photo"
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={20} color={Colors.gray[700]} />
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.useButton, { backgroundColor: gradeColor }]}
            onPress={handleUseImage}
            accessibilityLabel={currentSide === 'front' ? 'Use this front photo and continue to back' : 'Use this back photo and continue to review'}
            accessibilityRole="button"
          >
            <Ionicons name={isFront ? 'arrow-forward-circle' : 'checkmark-circle'} size={22} color={Colors.white} />
            <Text style={styles.useText}>
              {isFront ? 'Next: Back of Card ›' : 'Done — Review ›'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Camera or Gallery mode
  return (
    <View style={styles.container}>
      {/* Hide the system status bar while capture is mounted. Notification
          banners (e.g., a grading-in-progress card) can otherwise expand
          insets.top and squeeze the camera region. Hidden mode keeps the
          camera area dimensionally stable; notifications still post to
          the tray, they just don't push the layout around. */}
      <StatusBar hidden translucent />
      {/* Header — uses a fixed top padding instead of insets.top so the
          camera region's height stays constant when the status bar
          toggles for any reason (rotation, notifications, accessibility
          adjustments). */}
      <View style={[styles.cameraHeader, { paddingTop: 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerButton}
          accessibilityLabel="Cancel and go back"
          accessibilityRole="button"
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
        >
          <Ionicons name="close" size={28} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Image source={require('@/assets/images/dcm-logo.png')} style={styles.headerLogo} resizeMode="contain" tintColor="white" />
          <Text style={styles.headerSide}>{currentSide === 'front' ? 'FRONT' : 'BACK'}</Text>
        </View>
        {mode === 'camera' ? (
          <TouchableOpacity
            onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
            style={styles.headerButton}
            accessibilityLabel={facing === 'back' ? 'Switch to front-facing camera' : 'Switch to rear camera'}
            accessibilityRole="button"
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            <Ionicons name="camera-reverse" size={28} color={Colors.white} />
          </TouchableOpacity>
        ) : <View style={styles.headerButton} />}
      </View>

      {/* Method toggle: Camera | Gallery */}
      <View style={styles.methodToggle}>
        <TouchableOpacity
          style={[styles.methodTab, mode === 'camera' && styles.methodTabActive]}
          onPress={() => setMode('camera')}
          accessibilityLabel="Camera mode"
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'camera' }}
        >
          <Ionicons name="camera" size={16} color={mode === 'camera' ? '#fff' : Colors.gray[400]} />
          <Text style={[styles.methodTabText, mode === 'camera' && styles.methodTabTextActive]}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.methodTab, mode === 'gallery' && styles.methodTabActive]}
          onPress={() => setMode('gallery')}
          accessibilityLabel="Gallery mode"
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'gallery' }}
        >
          <Ionicons name="images" size={16} color={mode === 'gallery' ? '#fff' : Colors.gray[400]} />
          <Text style={[styles.methodTabText, mode === 'gallery' && styles.methodTabTextActive]}>Gallery</Text>
        </TouchableOpacity>
      </View>

      {mode === 'camera' ? (
        /* Camera live view — on tablet, center the camera + guide in a
           ~520px-wide column so the user isn't staring at a huge stretched
           preview and aiming at a giant guide rectangle. The black sides
           give the cropped look intentionally. */
        <View style={styles.cameraOuter}>
          <View style={[styles.cameraContainer, isTablet && styles.cameraContainerTablet]}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
              autofocus="on"
              zoom={0}
              pictureSize={pictureSize}
              onCameraReady={handleCameraReady}
            />
            <View style={styles.guideContainer} pointerEvents="none">
              <View style={[styles.guide, { aspectRatio: orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5 }]}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                <Text style={styles.guideLabel}>{currentSide === 'front' ? 'FRONT' : 'BACK'}</Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        /* Gallery picker view */
        <View style={styles.galleryContainer}>
          <View style={[styles.galleryCard, isTablet && styles.galleryCardTablet]}>
            <Ionicons name="images-outline" size={56} color={Colors.purple[400]} />
            <Text style={styles.galleryTitle}>Select {currentSide === 'front' ? 'Front' : 'Back'} Image</Text>
            <Text style={styles.gallerySubtitle}>
              Choose a photo of the card {currentSide === 'front' ? 'front' : 'back'} from your device.
            </Text>
            <TouchableOpacity
              style={styles.galleryPickBtn}
              onPress={requestGallery}
              disabled={isProcessing}
              accessibilityLabel={`Choose ${currentSide} photo from gallery`}
              accessibilityRole="button"
              accessibilityState={{ disabled: isProcessing, busy: isProcessing }}
            >
              <Ionicons name="folder-open" size={20} color="#fff" />
              <Text style={styles.galleryPickText}>{isProcessing ? 'Processing…' : 'Choose Photo'}</Text>
            </TouchableOpacity>
            {(frontUri || backUri) && (
              <Text style={styles.galleryHint}>
                {frontUri && backUri ? 'Both sides ready — confirm to proceed.' : `Now select the ${currentSide === 'front' ? 'front' : 'back'} of the card.`}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Status bar — captured indicators */}
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

      {/* Controls (camera mode only) */}
      {mode === 'camera' && (
        <View style={[styles.controls, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            onPress={() => setOrientation(o => o === 'portrait' ? 'landscape' : 'portrait')}
            style={styles.controlButton}
            accessibilityLabel={orientation === 'portrait' ? 'Switch guide to landscape' : 'Switch guide to portrait'}
            accessibilityRole="button"
          >
            <Ionicons name="phone-landscape" size={22} color={Colors.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.captureButton}
            onPress={requestCapture}
            disabled={isCapturing || isProcessing}
            activeOpacity={0.7}
            accessibilityLabel={`Capture ${currentSide} photo`}
            accessibilityRole="button"
            accessibilityState={{ disabled: isCapturing || isProcessing, busy: isCapturing || isProcessing }}
          >
            <View style={[styles.captureInner, (isCapturing || isProcessing) && { opacity: 0.5 }]} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setCurrentSide(s => s === 'front' ? 'back' : 'front')}
            style={styles.controlButton}
            accessibilityLabel={`Switch to capturing the ${currentSide === 'front' ? 'back' : 'front'} of the card`}
            accessibilityRole="button"
          >
            <Ionicons name="swap-horizontal" size={22} color={Colors.white} />
            <Text style={styles.controlLabel}>{currentSide === 'front' ? 'Back' : 'Front'}</Text>
          </TouchableOpacity>
        </View>
      )}
      {mode === 'gallery' && (
        <View style={[styles.galleryControls, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            onPress={() => setCurrentSide(s => s === 'front' ? 'back' : 'front')}
            style={styles.gallerySwitchBtn}
            accessibilityLabel={`Switch to selecting the ${currentSide === 'front' ? 'back' : 'front'} of the card`}
            accessibilityRole="button"
          >
            <Ionicons name="swap-horizontal" size={18} color={Colors.white} />
            <Text style={styles.gallerySwitchText}>Switch to {currentSide === 'front' ? 'Back' : 'Front'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pro Tip popup — shows on first upload action (camera or gallery) */}
      <PhotoTipsModal
        visible={tipsVisible}
        onCancel={() => { setTipsVisible(false); setPendingAction(null) }}
        onProceed={() => {
          setTipsVisible(false)
          setShouldGateOnTips(false) // don't re-gate within this session even if user didn't tick "don't show again"
          const action = pendingAction
          setPendingAction(null)
          if (action === 'capture') handleCapture()
          else if (action === 'gallery') pickFromGallery()
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[900] },

  // Permission
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: Colors.gray[50], gap: 16 },
  permissionTitle: { fontSize: 20, fontWeight: '700', color: Colors.gray[900] },
  permissionText: { fontSize: 14, color: Colors.gray[500], textAlign: 'center' },

  // Camera / Gallery method toggle
  methodToggle: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.7)' },
  methodTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: Colors.gray[700], backgroundColor: 'rgba(0,0,0,0.4)' },
  methodTabActive: { backgroundColor: Colors.purple[600], borderColor: Colors.purple[400] },
  methodTabText: { color: Colors.gray[400], fontSize: 13, fontWeight: '600' },
  methodTabTextActive: { color: '#fff' },

  // Gallery view
  galleryContainer: { flex: 1, backgroundColor: Colors.gray[900], padding: 24, justifyContent: 'center' },
  galleryCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', gap: 12 },
  galleryCardTablet: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  galleryTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  gallerySubtitle: { fontSize: 12, color: Colors.gray[400], textAlign: 'center' },
  galleryPickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.purple[600], paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  galleryPickText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  galleryHint: { fontSize: 11, color: Colors.purple[300], textAlign: 'center', marginTop: 8 },
  galleryControls: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 16, backgroundColor: 'rgba(0,0,0,0.8)' },
  gallerySwitchBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.gray[600] },
  gallerySwitchText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Camera header
  cameraHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.6)' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLogo: { width: 28, height: 28 },
  headerSide: { color: Colors.white, fontSize: 16, fontWeight: '700', letterSpacing: 1 },

  // Camera
  // Outer wrapper provides black bars on tablet when the inner container
  // is constrained. On phone, both layers stretch to fill.
  cameraOuter: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  cameraContainer: { flex: 1, width: '100%' },
  cameraContainerTablet: { width: '100%', maxWidth: 520 },
  camera: { flex: 1 },

  // Guide (absolute overlay on camera)
  guideContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  guide: { width: '70%', borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', borderRadius: 4, position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 4 },
  guideLabel: { position: 'absolute', alignSelf: 'center', top: '45%', color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '700', letterSpacing: 3, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: Colors.white },
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
  previewHeaderText: { flex: 1 },
  previewStep: { color: Colors.purple[300], fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  previewSideLabel: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  qualityBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  qualityBadgeText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  // ScrollView wrapping the image + quality details so the pinned action
  // footer below can never be pushed off-screen. flexGrow centers a short
  // image vertically; a tall image + long suggestion list simply scrolls.
  previewScroll: { flex: 1, backgroundColor: Colors.gray[900] },
  previewScrollContent: { flexGrow: 1, justifyContent: 'center' },
  previewImageContainer: { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.gray[900], paddingVertical: 16 },
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
