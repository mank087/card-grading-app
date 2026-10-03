import * as ImageManipulator from 'expo-image-manipulator'
import { useState, useRef, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Image, Alert, Platform, ScrollView, useWindowDimensions, AppState } from 'react-native'
import { CameraView, useCameraPermissions, type PictureRef } from 'expo-camera'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { StatusBar } from 'expo-status-bar'
import { Colors } from '@/lib/constants'
import { assessQuality, compressImage, hashImage, processCardCapture, computeGuideWidthFraction, QualityResult, CompressedImage } from '@/lib/imageUtils'
import { measureSharpness } from '@/lib/blurCheck'
import Button from '@/components/ui/Button'
import PhotoTipsModal, { shouldShowPhotoTips } from '@/components/PhotoTipsModal'
import { reportUploadEvent, beginCaptureAttempt } from '@/lib/uploadTelemetry'
import { useResponsive } from '@/hooks/useResponsive'
import { cancelCameraFocus, focusCamera, hasCaptureControls, type FocusStatus } from '@/lib/cameraControls'

export default function CaptureScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ category: string; subCategory?: string; mode?: string; tipsAcked?: string }>()
  const cameraRef = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<'front' | 'back'>('back')
  // Torch (continuous flashlight) — helps in dim rooms. Note this is the
  // steady lamp, not the capture flash, so the user sees the true lighting
  // in the preview before committing the shot.
  const [torchOn, setTorchOn] = useState(false)
  const [currentSide, setCurrentSide] = useState<'front' | 'back'>('front')
  const [isCapturing, setIsCapturing] = useState(false)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const { isTablet } = useResponsive()
  // Set the iOS photographic preset at mount, avoiding a second session setup.
  // Android already negotiates its highest compatible still size.
  const pictureSize = Platform.OS === 'ios' ? 'Photo' : undefined
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(AppState.currentState == null || AppState.currentState === 'active')
  const [cameraKey, setCameraKey] = useState(0)
  const captureLock = useRef(false)
  const captureGeneration = useRef(0)
  const focusRequest = useRef(0)
  const [focusStatus, setFocusStatus] = useState<FocusStatus | 'focusing' | null>(null)
  const nativeControls = hasCaptureControls()

  // Only show a focus reticle when this binary has real point metering.
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null)
  const focusTimers = useRef<Array<ReturnType<typeof setTimeout>>>([])

  const handleTapFocus = useCallback(async (e: { nativeEvent: { locationX: number; locationY: number } }) => {
    const layout = cameraLayoutRef.current
    if (!nativeControls || !cameraReady || captureLock.current || !layout) return
    const { locationX, locationY } = e.nativeEvent
    const request = ++focusRequest.current
    focusTimers.current.forEach(clearTimeout)
    focusTimers.current = []
    setFocusPoint({ x: locationX, y: locationY })
    setFocusStatus('focusing')
    Haptics.selectionAsync().catch(() => { /* haptics are optional */ })
    const result = await focusCamera(cameraRef.current, locationX / layout.containerW, locationY / layout.containerH)
    if (request !== focusRequest.current) return
    setFocusStatus(result.status)
    focusTimers.current.push(setTimeout(() => { setFocusPoint(null); setFocusStatus(null) }, 2200))
  }, [nativeControls, cameraReady])

  // Timers outlive the screen if the user backs out mid-focus.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setCameraActive(state === 'active')
      setCameraReady(false)
      captureGeneration.current++
      focusRequest.current++
      focusTimers.current.forEach(clearTimeout)
      cancelCameraFocus(cameraRef.current)
      setFocusPoint(null)
      setFocusStatus(null)
    })
    return () => {
      subscription.remove()
      captureGeneration.current++
      focusRequest.current++
      focusTimers.current.forEach(clearTimeout)
      cancelCameraFocus(cameraRef.current)
    }
  }, [])

  // CAPTURE-GATE P0: open a capture attempt on mount. Every telemetry event
  // from here through grade start carries this id, which is what makes
  // abandonment computable — an attempt that emits capture_attempted but never
  // grade_started is a user who gave up, and no card row would ever record it.
  useEffect(() => { beginCaptureAttempt() }, [])

  // Measured size of the camera preview container. Feeds the geometry-aware
  // capture crop (lib/imageUtils computeGuideCrop) so the crop matches the
  // on-screen guide box instead of the legacy hardcoded 85% band.
  const cameraLayoutRef = useRef<{ containerW: number; containerH: number } | null>(null)
  // Same measurement as the ref, held in state so the guide box can re-render
  // at the right size. The ref stays for the capture path, which needs the
  // freshest value without depending on a render having happened.
  const [cameraLayout, setCameraLayout] = useState<{ containerW: number; containerH: number } | null>(null)

  // Captured images
  const [frontUri, setFrontUri] = useState<string | null>(null)
  const [backUri, setBackUri] = useState<string | null>(null)
  const [frontCompressed, setFrontCompressed] = useState<CompressedImage | null>(null)
  const [backCompressed, setBackCompressed] = useState<CompressedImage | null>(null)
  const [frontQuality, setFrontQuality] = useState<QualityResult | null>(null)
  const [backQuality, setBackQuality] = useState<QualityResult | null>(null)
  const [frontHash, setFrontHash] = useState<string | null>(null)
  const [backHash, setBackHash] = useState<string | null>(null)
  // CAPTURE-GATE P0: which path produced each side ('camera' | 'gallery').
  // Forwarded to the review screen and persisted on the card row.
  const [captureSources, setCaptureSources] = useState<{ front?: string; back?: string }>({})

  // Preview state
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const rotationSource = useRef<CompressedImage | null>(null)
  const rotationTurns = useRef(0)
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [previewQuality, setPreviewQuality] = useState<QualityResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  /**
   * Pre-capture focus warning. True only when lib/blurCheck actually measured
   * the image AND it came back below the calibrated threshold — a failed or
   * skipped measurement leaves this false, so the flow is never gated on a
   * check that could not run. Advisory: the footer still lets the user
   * proceed, it just relabels the primary action.
   */
  const [previewIsSoft, setPreviewIsSoft] = useState(false)
  const [previewFocusUnknown, setPreviewFocusUnknown] = useState(false)

  // Method (camera vs gallery) — pre-selected from the main grade screen, defaults to camera
  const [mode, setMode] = useState<'camera' | 'gallery'>(params.mode === 'gallery' ? 'gallery' : 'camera')
  useEffect(() => {
    setCameraReady(false)
    setCameraError(null)
    focusRequest.current++
    captureGeneration.current++
    cancelCameraFocus(cameraRef.current)
    setFocusPoint(null)
    setFocusStatus(null)
    focusTimers.current.forEach(clearTimeout)
  }, [facing, mode, previewUri, cameraKey])

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
  const processImage = async (rawUri: string, knownDims?: { width: number; height: number }) => {
    setIsProcessing(true)
    setPreviewIsSoft(false)
    try {
      // Gallery images are NEVER auto-cropped. The center-band + card-aspect
      // crop in processCardCapture exists solely to compensate for the
      // camera preview's aspect-fill; applied to a user-framed photo
      // (e.g. a DSLR shot transferred to the phone) it slices off parts of
      // the card — especially when the photo's aspect differs from 2.5:3.5.
      // Resize + compress only, exactly like the web gallery path.
      // v9.10: pass the picker asset's dimensions so compressImage skips its
      // probe pass (which was a full extra JPEG re-encode just to read size).
      const compressed = await compressImage(rawUri, knownDims)

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
      // Gallery images are never auto-cropped, so the file's aspect IS the
      // user's framing — the one case where an aspect check is informative.
      const quality = assessQuality(compressed, compressed.width / compressed.height)
      const hash = await hashImage(compressed.uri)

      // Focus check. Included for gallery picks as well as camera captures
      // because it is the same one call on the same already-compressed file —
      // a soft photo out of the library wastes a credit exactly like a soft
      // one off the sensor. Null (measurement failed) means "no opinion".
      const sharpness = await measureSharpness(compressed.uri, { width: compressed.width, height: compressed.height })

      rotationSource.current = compressed
      rotationTurns.current = 0
      setPreviewUri(compressed.uri)
      setPreviewQuality(quality)
      setPreviewIsSoft(sharpness?.isSoft === true)
      setPreviewFocusUnknown(sharpness === null)
      setCaptureSources(prev => ({ ...prev, [currentSide]: 'gallery' }))
      reportUploadEvent({
        event: 'capture_attempted',
        side: currentSide,
        capture_source: 'gallery',
        image_width: compressed.width,
        image_height: compressed.height,
      })

      if (currentSide === 'front') {
        setFrontUri(compressed.uri)
        setFrontCompressed(compressed)
        setFrontQuality(quality)
        setFrontHash(hash)
      } else {
        // Both hashes must be present to compare. A null hash means the
        // content could not be read — that is "unknown", never "different".
        if (frontHash && hash && hash === frontHash) {
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
      await processImage(
        asset.uri,
        asset.width && asset.height ? { width: asset.width, height: asset.height } : undefined,
      )
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

  const handleCameraReady = useCallback(() => {
    setCameraReady(true)
    setCameraError(null)
  }, [])

  if (mode === 'camera' && !permission) return <View style={styles.container} />

  if (mode === 'camera' && !permission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color={Colors.gray[400]} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>We need camera access to photograph your card for grading.</Text>
        <Button title="Grant Camera Access" onPress={requestPermission} />
        <Button title="Use Gallery" onPress={() => setMode('gallery')} />
      </View>
    )
  }

  const handleCapture = async () => {
    if (!cameraRef.current || captureLock.current || !cameraReady || !cameraActive || focusStatus === 'focusing') return
    captureLock.current = true
    const generation = captureGeneration.current
    let imageRef: PictureRef | undefined
    setIsCapturing(true)
    setPreviewIsSoft(false)
    setPreviewFocusUnknown(false)

    try {
      let shutterFocus: FocusStatus | null = focusStatus === 'focused' || focusStatus === 'settled' ? focusStatus : null
      if (nativeControls && !shutterFocus) {
        shutterFocus = (await focusCamera(cameraRef.current, 0.5, 0.5)).status
      } else if (!nativeControls) {
        // Compatibility path: continuous AF, with a short allowance for shutter movement.
        // This delay is not reported as a successful focus measurement.
        await new Promise(r => setTimeout(r, Platform.OS === 'android' ? 450 : 250))
      }
      if (generation !== captureGeneration.current || !cameraRef.current) return
      const photo = nativeControls
        ? (imageRef = await cameraRef.current.takePictureAsync({ pictureRef: true, shutterSound: false }))
        : await cameraRef.current.takePictureAsync({ quality: 1, shutterSound: false })
      if (!photo || !photo.width || !photo.height) throw new Error('Capture failed')
      if (generation !== captureGeneration.current) return

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setIsProcessing(true)

      // Single ImageManipulator pass — see processCardCapture for the
      // crop/resize/compress math. Replaces the previous chain of
      // probe → cropToCardAspect → compressImage which compounded
      // JPEG re-encodes and softened the final photo.
      const compressed = await processCardCapture(
        imageRef ?? (photo as { uri: string }).uri,
        orientation,
        photo.width && photo.height ? { width: photo.width, height: photo.height } : undefined,
        cameraLayoutRef.current
          ? {
              ...cameraLayoutRef.current,
              guideWidthFraction: computeGuideWidthFraction(
                cameraLayoutRef.current.containerW,
                cameraLayoutRef.current.containerH,
                orientation,
              ),
            }
          : undefined,
      )
      if (generation !== captureGeneration.current) return

      // v8.9 MINIMUM-RESOLUTION GATE (matches web/gallery)
      if (Math.max(compressed.width, compressed.height) < 1000) {
        Alert.alert(
          'Capture Too Small',
          'This camera output is too small for grading. Use a full-resolution photo from your phone camera through Gallery. Moving closer will not increase the camera output resolution.'
        )
        setIsCapturing(false)
        setIsProcessing(false)
        return
      }

      // Quality assessment. No sourceAspect: processCardCapture has already
      // cropped to 2.5:3.5, and the pre-crop sensor aspect (4:3 / 16:9) says
      // nothing about how the card was framed.
      const quality = assessQuality(compressed)

      // Hash the image CONTENT for duplicate detection (was the filename,
      // which could never match).
      const hash = await hashImage(compressed.uri)

      // Focus check — runs while the "Processing…" state is still up, before
      // the preview appears and therefore before the user can spend a credit.
      // Measures the guide crop, which can still contain background. This is
      // advisory; a failed measurement is shown as unknown, never as sharp.
      const sharpness = await measureSharpness(compressed.uri, { width: compressed.width, height: compressed.height })
      if (generation !== captureGeneration.current) return

      rotationSource.current = compressed
      rotationTurns.current = 0
      setPreviewUri(compressed.uri)
      setPreviewQuality(quality)
      setPreviewIsSoft(sharpness?.isSoft === true)
      setPreviewFocusUnknown(sharpness === null)
      setCaptureSources(prev => ({ ...prev, [currentSide]: 'camera' }))
      reportUploadEvent({
        event: 'capture_attempted',
        side: currentSide,
        capture_source: 'camera',
        image_width: compressed.width,
        image_height: compressed.height,
        capture_method: imageRef ? 'native_image_reference' : 'native_camera_file',
        metadata: { capture_version: 'capture-v2', native_controls: nativeControls, focus_result: shutterFocus,
          sharpness: sharpness?.variance ?? null, sharpness_status: sharpness ? sharpness.isSoft ? 'warn' : 'pass' : 'unknown',
          analysis_ms: sharpness?.elapsedMs ?? null, photo_width: photo.width, photo_height: photo.height,
          facing, torch: torchOn, orientation },
      })

      // Store for current side
      if (currentSide === 'front') {
        setFrontUri(compressed.uri)
        setFrontCompressed(compressed)
        setFrontQuality(quality)
        setFrontHash(hash)
      } else {
        // Check for duplicate. Both hashes must be present — a null hash means
        // unreadable content, which is "unknown", not "different".
        if (frontHash && hash && hash === frontHash) {
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
      if (generation !== captureGeneration.current) return
      console.error('Capture error:', err)
      Alert.alert('Capture Failed', 'Please try again.')
    } finally {
      imageRef?.release()
      captureLock.current = false
      setIsCapturing(false)
      setIsProcessing(false)
    }
  }

  // Every turn starts from the same capture, rather than recompressing the last turn.
  const rotatePreview = async () => {
    if (isProcessing || !rotationSource.current) return
    setIsProcessing(true)
    try {
      const turns = (rotationTurns.current + 1) % 4
      const source = rotationSource.current
      const result = turns === 0 ? source : await ImageManipulator.manipulateAsync(
        source.uri, [{ rotate: turns * 90 }], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG })
      const compressed = { ...result, fileSize: Math.round(result.width * result.height * 0.15) }
      const hash = await hashImage(compressed.uri)
      const quality = assessQuality(compressed)
      rotationTurns.current = turns
      setPreviewUri(compressed.uri)
      setPreviewQuality(quality)
      if (currentSide === 'front') {
        setFrontUri(compressed.uri); setFrontCompressed(compressed); setFrontQuality(quality); setFrontHash(hash)
      } else {
        setBackUri(compressed.uri); setBackCompressed(compressed); setBackQuality(quality); setBackHash(hash)
      }
    } catch { Alert.alert('Could not rotate', 'Please try rotating the photo again.') }
    finally { setIsProcessing(false) }
  }

  const handleUseImage = () => {
    if (currentSide === 'front') {
      // Front just captured — advance to back camera
      if (__DEV__) console.log('[Capture] Front captured, advancing to back')
      setCurrentSide('back')
      setPreviewUri(null)
      setPreviewQuality(null)
      setPreviewIsSoft(false)
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
          // CAPTURE-GATE P0: per-side capture path, forwarded so the review
          // screen can persist it on the card row. Per side because a card can
          // pair a camera front with a gallery back, and a combined value would
          // hide an unusable back behind a good front.
          frontSource: captureSources.front || '',
          backSource: captureSources.back || '',
          // A locked grading run sends the next card back the same way.
          mode,
        },
      })
    }
  }

  const handleRetake = () => {
    reportUploadEvent({ event: 'retake_started', side: currentSide })
    setPreviewUri(null)
    setPreviewQuality(null)
    setPreviewIsSoft(false)
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

  // One source of truth for the guide box: this drives both the on-screen
  // rectangle and the crop region passed to processCardCapture.
  const guideWidthFraction = computeGuideWidthFraction(
    cameraLayout?.containerW ?? 0,
    cameraLayout?.containerH ?? 0,
    orientation,
  )

  // Resolution-only tint. Previously derived from a fabricated A/B/C/D grade
  // (see the note on QualityResult) which coloured the confirm button green on
  // photos nothing had checked for focus. Now it reflects the one thing this
  // screen can actually measure, and the action button no longer borrows it.
  // Never green. This screen cannot see whether the card fills the frame — the
  // most common reason a submission is ungradeable — so a reassuring badge is a
  // claim it has no basis for. Neutral by default, warning colours only when
  // the one thing it CAN measure is bad.
  const resolutionColor = !previewQuality || previewQuality.score >= 75
    ? Colors.gray[600]
    : previewQuality.score >= 60
      ? Colors.amber[500]
      : Colors.red[500]

  // Preview mode
  if (previewUri && previewQuality) {
    const isFront = currentSide === 'front'
    // Match the preview frame to the CAPTURED image's real aspect (the old
    // hardcoded 0.714 squashed landscape captures into a portrait box) and
    // cap its height so the full card + quality details fit the first screen
    // on shorter phones instead of the card's bottom hiding below the fold.
    const previewCompressed = isFront ? frontCompressed : backCompressed
    const previewAspect = previewCompressed && previewCompressed.width > 0 && previewCompressed.height > 0
      ? previewCompressed.width / previewCompressed.height
      : 0.714
    const previewImageStyle = {
      aspectRatio: previewAspect,
      maxHeight: Math.round(windowHeight * 0.48),
    }
    return (
      <View style={styles.container}>
        <View style={[styles.previewHeader, { paddingTop: insets.top + 8 }]}>
          <View style={styles.previewHeaderText}>
            <Text style={styles.previewStep}>STEP {isFront ? '1' : '2'} OF 2</Text>
            <Text style={styles.previewSideLabel}>{isFront ? 'Front' : 'Back'} Image</Text>
          </View>
          {/* States the measurement, not a verdict. "Resolution: Good" in green
              sat on a photo of a distant, blurry card and read as approval —
              the file was 6MP, the card was a fifth of it. */}
          <View style={[styles.qualityBadge, { backgroundColor: resolutionColor }]}>
            <Text style={styles.qualityBadgeText}>
              {previewQuality.resolutionLabel
                ? previewQuality.resolutionLabel
                : `${previewQuality.width} × ${previewQuality.height}`}
            </Text>
          </View>
        </View>

        {/* Scrollable middle. Previously this was a fixed flex column with no
            scroll: a tall image plus a long quality-suggestion list (common on
            lower-quality gallery uploads) pushed the action bar below the screen
            edge, stranding users on a full-screen image with no reachable "next"
            control. The image + details now scroll; the action bar is a pinned
            footer that can never be clipped. */}
        <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewScrollContent}>
          {/* Focus warning. Advisory and non-blocking by design: it appears
              above the photo so it is read before the action bar, states the
              consequence rather than issuing an order, and leaves both exits
              open in the footer (Retake / Use anyway). Only shown when
              lib/blurCheck actually measured the image and it fell below the
              calibrated threshold — never on a measurement that failed. No
              animation, matching the rest of this screen. */}
          {(previewIsSoft || previewFocusUnknown) && (
            <View style={styles.softBanner} accessibilityRole="alert">
              <Ionicons name="alert-circle" size={18} color={Colors.amber[500]} />
              <Text style={styles.softBannerText}>
                {previewFocusUnknown ? 'Focus could not be checked. Inspect the printed text and every corner before continuing.'
                  : 'This photo looks soft. Move back slightly if needed, hold steady, and retake in diffuse light.'}
              </Text>
            </View>
          )}

          <View style={styles.previewImageContainer}>
            <Image source={{ uri: previewUri }} style={[styles.previewImage, previewImageStyle]} resizeMode="contain" />
          </View>

          <View style={styles.qualityDetails}>
            {/* Only claim what we actually measure. assessQuality is a
                dimensions/framing check (no pixel access on RN without a
                native dep — see the honesty note in lib/imageUtils.ts), so
                the old "Sharpness: Good / Brightness: Good" rows were
                fabricated. Show the real signal and tell the user where
                sharpness/lighting actually get evaluated. */}
            <View style={styles.qualityRow}>
              <Ionicons name="scan" size={16} color={Colors.gray[500]} />
              <Text style={styles.qualityLabel}>
                Image size: {previewQuality.width} × {previewQuality.height}
                {previewQuality.resolutionLabel ? ` — ${previewQuality.resolutionLabel}` : ''}
              </Text>
            </View>
            <Text style={styles.qualityNote}>
              This is the photo&apos;s size, not its quality. Framing, sharpness and lighting are
              evaluated by DCM Optic&trade; during grading.
            </Text>
            {/* "Grade uncertainty: ±0.5" was removed with the A/B/C/D badge:
                it was derived from the same resolution-only score, so it
                stated a precision nothing had measured. */}
            {previewQuality.suggestions.map((s, i) => (
              <Text key={i} style={styles.suggestionText}>{s}</Text>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity disabled={isProcessing} onPress={rotatePreview} accessibilityRole="button" accessibilityLabel="Rotate photo 90 degrees" style={{ padding: 12, alignItems: 'center' }}>
          <Text style={{ color: Colors.white }}>{isProcessing ? 'Rotating…' : 'Rotate photo 90°'}</Text>
        </TouchableOpacity>
        <View style={[styles.previewActions, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={styles.retakeButton}
            disabled={isProcessing}
            onPress={handleRetake}
            accessibilityLabel="Retake photo"
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={20} color={Colors.gray[700]} />
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.useButton, { backgroundColor: previewIsSoft ? Colors.gray[600] : Colors.blue[500] }]}
            disabled={isProcessing}
            onPress={handleUseImage}
            accessibilityLabel={
              previewIsSoft
                ? `Use this soft ${currentSide} photo anyway`
                : currentSide === 'front'
                  ? 'Use this front photo and continue to back'
                  : 'Use this back photo and continue to review'
            }
            accessibilityRole="button"
          >
            <Ionicons name={isFront ? 'arrow-forward-circle' : 'checkmark-circle'} size={22} color={Colors.white} />
            {/* When the photo measured soft, the primary action stops
                presenting itself as the recommended path: it says what the
                user is choosing, and Retake beside it becomes the obvious
                alternative. It is still fully enabled — the check is a nudge,
                not a gate. */}
            <Text style={styles.useText}>
              {previewIsSoft
                ? 'Use anyway ›'
                : isFront ? 'Next: Back of Card ›' : 'Done — Review ›'}
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
            disabled={isCapturing || isProcessing}
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
          disabled={isCapturing || isProcessing}
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
          disabled={isCapturing || isProcessing}
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
          <View
            style={[styles.cameraContainer, isTablet && styles.cameraContainerTablet]}
            onLayout={e => {
              const { width, height } = e.nativeEvent.layout
              cameraLayoutRef.current = { containerW: width, containerH: height }
              setCameraLayout(prev =>
                prev && prev.containerW === width && prev.containerH === height
                  ? prev
                  : { containerW: width, containerH: height }
              )
            }}
          >
            {cameraActive && <CameraView
              key={`${facing}-${cameraKey}`}
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
              enableTorch={torchOn && facing === 'back'}
              autofocus="off"
              pictureSize={pictureSize}
              onCameraReady={handleCameraReady}
              onMountError={event => { setCameraReady(false); setCameraError(event.message || 'Camera could not start') }}
            />}
            {nativeControls && <Pressable style={StyleSheet.absoluteFill} onPress={handleTapFocus}
              disabled={!cameraReady || isCapturing || isProcessing} accessibilityLabel="Tap the card to focus" />}
            {focusPoint && (
              <View
                pointerEvents="none"
                style={[styles.focusRing, { left: focusPoint.x - 36, top: focusPoint.y - 36,
                  borderColor: focusStatus === 'focused' ? '#86efac' : focusStatus === 'focusing' || focusStatus === 'settled' ? '#ffffff' : '#fbbf24' }]}
              />
            )}
            <View style={styles.guideContainer} pointerEvents="none">
              <View
                style={[
                  styles.guide,
                  {
                    aspectRatio: orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5,
                    // Sized by the same function the crop uses, so what the
                    // user frames is exactly what gets cropped.
                    width: `${guideWidthFraction * 100}%`,
                  },
                ]}
              >
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                <Text style={styles.guideLabel}>{currentSide === 'front' ? 'FRONT' : 'BACK'}</Text>
              </View>
            </View>
            {cameraError && <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#000d', padding: 24 }]}>
              <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 12 }}>Camera could not start. Try again or use a photo from Gallery.</Text>
              <Button title="Try Again" onPress={() => setCameraKey(k => k + 1)} />
              <Button title="Use Gallery" onPress={() => setMode('gallery')} />
            </View>}
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

      {/* Status bar — framing instruction + captured indicators */}
      <View style={styles.statusBar}>
        {/* The guide box alone was not a strong enough instruction: users
            framed the card comfortably inside it and shot from too far away,
            which is the top cause of cards the grader cannot identify. State
            the target explicitly. Camera mode only — there is no guide box to
            reach for when picking from the gallery. */}
        {mode === 'camera' && (
          <Text style={styles.framingHint}>
            {isCapturing || isProcessing ? 'Saving photo — hold steady…'
              : !cameraReady ? 'Starting camera…'
              : focusStatus === 'focusing' ? 'Focusing…'
              : focusStatus && !['focused', 'settled'].includes(focusStatus) ? 'Focus could not settle. Move back slightly and try again.'
              : nativeControls ? 'Tap the card to focus. Keep every edge visible; move back if text looks soft.'
              : 'Autofocus is automatic. Keep every edge visible; move back if text looks soft.'}
          </Text>
        )}
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
            onPress={() => setTorchOn(t => !t)}
            style={styles.controlButton}
            disabled={facing === 'front' || isCapturing || isProcessing}
            accessibilityLabel={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
            accessibilityRole="button"
            accessibilityState={{ disabled: facing === 'front' || isCapturing || isProcessing, selected: torchOn }}
          >
            <Ionicons
              name={torchOn ? 'flashlight' : 'flashlight-outline'}
              size={22}
              color={facing === 'front' ? Colors.gray[600] : torchOn ? Colors.amber[500] : Colors.white}
            />
            <Text style={[styles.controlLabel, torchOn && facing === 'back' && { color: Colors.amber[500] }]}>
              {torchOn ? 'Torch On' : 'Torch'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setOrientation(o => o === 'portrait' ? 'landscape' : 'portrait')}
            disabled={isCapturing || isProcessing}
            style={styles.controlButton}
            accessibilityLabel={orientation === 'portrait' ? 'Switch guide to landscape' : 'Switch guide to portrait'}
            accessibilityRole="button"
          >
            <Ionicons name="phone-landscape" size={22} color={Colors.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.captureButton}
            onPress={requestCapture}
            disabled={isCapturing || isProcessing || !cameraReady || !cameraActive || focusStatus === 'focusing'}
            activeOpacity={0.7}
            accessibilityLabel={`Capture ${currentSide} photo`}
            accessibilityRole="button"
            accessibilityState={{ disabled: isCapturing || isProcessing || !cameraReady || !cameraActive || focusStatus === 'focusing', busy: isCapturing || isProcessing }}
          >
            <View style={[styles.captureInner, (isCapturing || isProcessing) && { opacity: 0.5 }]} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setCurrentSide(s => s === 'front' ? 'back' : 'front')}
            disabled={isCapturing || isProcessing}
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
            disabled={isCapturing || isProcessing}
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
  // Tap-to-refocus feedback ring.
  focusRing: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'transparent' },

  // Guide (absolute overlay on camera)
  guideContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  // NO width here on purpose — it is set inline from computeGuideWidthFraction,
  // the same function that tells the crop where the guide was. A width in this
  // stylesheet is a second copy of that number with nothing keeping the two in
  // agreement, which is exactly how the old '70%' drifted from its meaning.
  guide: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', borderRadius: 4, position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 4 },
  // Label sits ABOVE the guide box, not on the card the user is framing —
  // the old top:'45%' put "FRONT"/"BACK" across the middle of the card.
  guideLabel: { position: 'absolute', alignSelf: 'center', top: -30, color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700', letterSpacing: 3, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: Colors.white },
  cornerTL: { top: -1, left: -1, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: -1, right: -1, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: -1, left: -1, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: -1, right: -1, borderBottomWidth: 3, borderRightWidth: 3 },

  // Status
  statusBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.6)' },
  framingHint: { color: Colors.white, fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
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
  // Focus warning banner. Amber, matching suggestionText — this screen already
  // uses amber for "worth your attention" and red only for hard failures, and
  // a soft photo is the former.
  softBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.5)',
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  softBannerText: { flex: 1, color: Colors.amber[500], fontSize: 13, lineHeight: 18, fontWeight: '600' },
  previewImageContainer: { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.gray[900], paddingVertical: 16 },
  previewImage: { width: '80%', aspectRatio: 0.714, borderRadius: 8 },
  qualityDetails: { padding: 16, backgroundColor: Colors.gray[800], gap: 6 },
  qualityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qualityLabel: { color: Colors.gray[300], fontSize: 13 },
  qualityNote: { color: Colors.gray[500], fontSize: 11 },
  uncertaintyText: { color: Colors.gray[400], fontSize: 12, marginTop: 4 },
  suggestionText: { color: Colors.amber[500], fontSize: 12 },
  previewActions: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: Colors.gray[900] },
  retakeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.gray[200] },
  retakeText: { fontSize: 15, fontWeight: '600', color: Colors.gray[700] },
  useButton: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  useText: { fontSize: 15, fontWeight: '600', color: Colors.white },
})
