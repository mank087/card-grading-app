'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { getStoredSession, getAuthenticatedClient } from '@/lib/directAuth'
import { compressImage, formatFileSize, getOptimalCompressionSettings } from '@/lib/imageCompression'
import CardAnalysisAnimation from './sports/CardAnalysisAnimation'
import { useDeviceDetection } from '@/hooks/useDeviceDetection'
import UploadMethodSelector from '@/components/camera/UploadMethodSelector'
import MobileCamera from '@/components/camera/MobileCamera'
import { useGradingQueue } from '@/contexts/GradingQueueContext'
import { useCredits } from '@/contexts/CreditsContext'
import PhotoTipsPopup, { useShouldShowPhotoTips } from '@/components/PhotoTipsPopup'
import Link from 'next/link'

interface CompressionInfo {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  dimensions: { width: number; height: number };
}

// Card type configuration
const CARD_TYPES = {
  Sports: {
    label: 'Sports Card',
    icon: '',
    category: 'Sports',
    apiEndpoint: '/api/sports',
    route: '/sports',
    description: {
      title: 'Sports Cards',
      items: [
        'All major sports: Baseball, Basketball, Football, Hockey, Soccer',
        'Professional and vintage cards',
        'Rookie cards and special editions',
        'Complete player and team analysis'
      ]
    }
  },
  Pokemon: {
    label: 'Pokémon Card',
    icon: '',
    category: 'Pokemon',
    apiEndpoint: '/api/pokemon',
    route: '/pokemon',
    description: {
      title: 'Pokémon TCG',
      items: [
        'All Pokémon TCG sets and expansions',
        'English and Japanese cards',
        'Automatic card identification via API',
        'Rarity and market value analysis'
      ]
    }
  },
  MTG: {
    label: 'Magic: The Gathering Card',
    icon: '',
    category: 'MTG',
    apiEndpoint: '/api/mtg',
    route: '/mtg',
    description: {
      title: 'Magic: The Gathering',
      items: [
        'All MTG sets and formats',
        'Vintage, Legacy, Modern, Standard',
        'Foil and special treatments',
        'Rarity and playability assessment'
      ]
    }
  },
  Lorcana: {
    label: 'Disney Lorcana Card',
    icon: '',
    category: 'Lorcana',
    apiEndpoint: '/api/lorcana',
    route: '/lorcana',
    description: {
      title: 'Disney Lorcana',
      items: [
        'All Disney Lorcana sets',
        'Character and action cards',
        'Foil and enchanted variants',
        'Inkable status and gameplay analysis'
      ]
    }
  },
  Other: {
    label: 'Other Collectible Card',
    icon: '',
    category: 'Other',
    apiEndpoint: '/api/other',
    route: '/other',
    description: {
      title: 'Other Collectible Cards',
      items: [
        'Trading cards (non-sports, non-TCG)',
        'Entertainment cards (movies, TV, music)',
        'Art cards and limited editions',
        'Promotional and historical cards'
      ]
    }
  }
} as const;

type CardType = keyof typeof CARD_TYPES;

function UniversalUploadPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addToQueue, updateCardStatus } = useGradingQueue();
  const { balance, isLoading: creditsLoading, deductLocalCredit, refreshCredits } = useCredits();

  // 🔒 Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false);

  // 🔒 Authentication check - redirect to login if not authenticated
  useEffect(() => {
    const session = getStoredSession();
    if (!session || !session.user) {
      console.log('[Upload] User not authenticated, redirecting to login');
      router.push('/login');
      setIsAuthenticated(false);
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  // Get category from URL query param and default to Sports
  const categoryParam = searchParams?.get('category') || 'Sports';
  const [selectedType, setSelectedType] = useState<CardType>(
    categoryParam in CARD_TYPES ? categoryParam as CardType : 'Sports'
  );

  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [backFile, setBackFile] = useState<File | null>(null)
  const [frontCompressed, setFrontCompressed] = useState<File | null>(null)
  const [backCompressed, setBackCompressed] = useState<File | null>(null)
  const [frontCompressionInfo, setFrontCompressionInfo] = useState<CompressionInfo | null>(null)
  const [backCompressionInfo, setBackCompressionInfo] = useState<CompressionInfo | null>(null)
  const [frontHash, setFrontHash] = useState<string | null>(null)
  const [backHash, setBackHash] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [isCompressingFront, setIsCompressingFront] = useState(false)
  const [isCompressingBack, setIsCompressingBack] = useState(false)

  // Computed compression state - true if either side is compressing
  const isCompressing = isCompressingFront || isCompressingBack
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedCardId, setUploadedCardId] = useState<string | null>(null)
  const [uploadedCardCategory, setUploadedCardCategory] = useState<string | null>(null)

  // Camera/upload mode state
  const [uploadMode, setUploadMode] = useState<'select' | 'camera' | 'gallery' | 'review'>('select')
  const [currentSide, setCurrentSide] = useState<'front' | 'back'>('front')
  const [originalUploadMethod, setOriginalUploadMethod] = useState<'camera' | 'gallery'>('camera')
  const { showCameraOption } = useDeviceDetection()

  // Photo tips popup state
  const shouldShowPhotoTips = useShouldShowPhotoTips()
  const [showPhotoTipsPopup, setShowPhotoTipsPopup] = useState(false)
  const [pendingUploadAction, setPendingUploadAction] = useState<'camera' | 'gallery' | 'desktop-front' | 'desktop-back' | null>(null)

  // Track the navigation timestamp to detect when user clicks nav to grade another card
  const [lastNavTimestamp, setLastNavTimestamp] = useState<string | null>(null);

  // Update selected type when URL param changes AND reset upload state if navigating to grade a new card
  useEffect(() => {
    const categoryParam = searchParams?.get('category');
    const navTimestamp = searchParams?.get('t'); // Timestamp added by nav links

    if (categoryParam && categoryParam in CARD_TYPES) {
      // If timestamp changed (user clicked nav link), reset upload state if currently uploading
      // This allows users to grade another card by clicking the nav while on the loading screen
      if (navTimestamp && navTimestamp !== lastNavTimestamp && isUploading) {
        console.log('[Upload] Navigation detected while uploading - resetting state for new card');
        setFrontFile(null);
        setBackFile(null);
        setFrontCompressed(null);
        setBackCompressed(null);
        setFrontCompressionInfo(null);
        setBackCompressionInfo(null);
        setFrontHash(null);
        setBackHash(null);
        setIsUploading(false);
        setIsCompressingFront(false);
        setIsCompressingBack(false);
        setStatus('');
        setUploadedCardId(null);
        setUploadedCardCategory(null);
        setUploadMode('select');
      }
      setLastNavTimestamp(navTimestamp || null);
      setSelectedType(categoryParam as CardType);
    }
  }, [searchParams, lastNavTimestamp, isUploading]);

  // Scroll to top when returning to main upload screen
  useEffect(() => {
    if (uploadMode === 'select') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [uploadMode]);

  const config = CARD_TYPES[selectedType];

  // Generate SHA-256 hash for an image file
  const generateImageHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Handle file selection and compression
  const handleFileSelect = async (file: File, side: 'front' | 'back') => {
    console.log('[Upload] handleFileSelect started:', side, 'size:', file.size)
    const setCompressingState = side === 'front' ? setIsCompressingFront : setIsCompressingBack
    try {
      setCompressingState(true)
      setStatus(`🔄 Compressing ${side} image...`)

      // Generate hash for duplicate detection
      const fileHash = await generateImageHash(file);

      // Set original file
      if (side === 'front') {
        setFrontFile(file)
        setFrontHash(fileHash)
      } else {
        setBackFile(file)
        setBackHash(fileHash)
      }

      // Check for identical images (front and back are the same file)
      const currentFrontHash = side === 'front' ? fileHash : frontHash;
      const currentBackHash = side === 'back' ? fileHash : backHash;

      if (currentFrontHash && currentBackHash && currentFrontHash === currentBackHash) {
        setStatus('❌ Error: Front and back images are identical. Please upload different images of the front and back of your card.')
        setIsCompressing(false)
        // Clear the duplicate image
        if (side === 'front') {
          setFrontFile(null)
          setFrontHash(null)
          setFrontCompressed(null)
          setFrontCompressionInfo(null)
        } else {
          setBackFile(null)
          setBackHash(null)
          setBackCompressed(null)
          setBackCompressionInfo(null)
        }
        return
      }

      // Get optimal compression settings based on file size
      const compressionSettings = getOptimalCompressionSettings(file.size)

      // Compress the image
      const result = await compressImage(file, compressionSettings)

      // Update state with compressed file and info
      if (side === 'front') {
        setFrontCompressed(result.compressedFile)
        setFrontCompressionInfo({
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          compressionRatio: result.compressionRatio,
          dimensions: result.dimensions
        })
      } else {
        setBackCompressed(result.compressedFile)
        setBackCompressionInfo({
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          compressionRatio: result.compressionRatio,
          dimensions: result.dimensions
        })
      }

      console.log('[Upload] handleFileSelect completed:', side, 'compressed size:', result.compressedSize)
      setStatus(`✅ ${side} image compressed: ${result.compressionRatio.toFixed(1)}% smaller`)
    } catch (error) {
      console.error(`Failed to compress ${side} image:`, error)
      setStatus(`❌ Failed to compress ${side} image`)
    } finally {
      console.log('[Upload] handleFileSelect finished for:', side)
      setCompressingState(false)
    }
  }

  const handleUpload = async () => {
    console.log('[Upload] handleUpload called')
    console.log('[Upload] State check:', {
      frontFile: !!frontFile,
      backFile: !!backFile,
      frontCompressed: !!frontCompressed,
      backCompressed: !!backCompressed,
      isCompressing,
      isUploading
    })

    if (!frontCompressed || !backCompressed || !frontFile) {
      console.log('[Upload] Validation failed - missing compressed images')
      setStatus('❌ Please select both front and back images and wait for compression')
      return
    }

    // Get logged-in user from stored session
    const session = getStoredSession()

    if (!session || !session.user) {
      setStatus('❌ You must be logged in to upload')
      alert('You must be logged in to upload cards. Please log in and try again.')
      return
    }

    // Check for sufficient credits
    if (balance < 1) {
      setShowInsufficientCredits(true)
      return
    }

    const user = session.user

    try {
      setIsUploading(true)
      setStatus(`⏳ Uploading ${config.label}...`)

      // Create unique ID for this card
      const cardId = crypto.randomUUID()

      // Store the card ID and category for auto-redirect when grading completes
      setUploadedCardId(cardId)
      setUploadedCardCategory(config.category)

      // Create object URL for the front image to use in queue
      const frontImageUrl = URL.createObjectURL(frontFile)

      // Add card to grading queue immediately with 'uploading' status
      const queueId = addToQueue({
        cardId,
        category: config.category,
        categoryLabel: config.label,
        frontImageUrl,
        status: 'uploading',
        resultUrl: `${config.route}/${cardId}`
      })

      console.log('[Upload] Added to queue:', queueId, cardId)

      // Build full storage paths
      const frontPath = `${user.id}/${cardId}/front.jpg`
      const backPath = `${user.id}/${cardId}/back.jpg`

      // Use authenticated client for uploads (includes user's access token)
      const authClient = getAuthenticatedClient()

      console.log('[Upload] Uploading front image...')
      // Upload compressed front image
      const { error: frontError } = await authClient.storage
        .from('cards')
        .upload(frontPath, frontCompressed)

      if (frontError) {
        console.error('[Upload] Front upload error:', frontError)
        throw frontError
      }

      console.log('[Upload] Uploading back image...')
      // Upload compressed back image
      const { error: backError } = await authClient.storage
        .from('cards')
        .upload(backPath, backCompressed)

      if (backError) {
        console.error('[Upload] Back upload error:', backError)
        throw backError
      }

      console.log('[Upload] Fetching serial number...')
      // Fetch next sequential serial number from API
      let serialNumber: string;
      try {
        const serialResponse = await fetch('/api/serial');
        if (serialResponse.ok) {
          const serialData = await serialResponse.json();
          serialNumber = serialData.serial;
          console.log('[Upload] Got serial number:', serialNumber);
        } else {
          // Fallback to timestamp-based if API fails
          serialNumber = Date.now().toString().slice(-10).padStart(10, '0');
          console.warn('[Upload] Serial API failed, using fallback:', serialNumber);
        }
      } catch (e) {
        // Fallback to timestamp-based if API fails
        serialNumber = Date.now().toString().slice(-10).padStart(10, '0');
        console.warn('[Upload] Serial fetch error, using fallback:', serialNumber);
      }

      console.log('[Upload] Saving to database...')
      // Save record in DB with selected category (use authenticated client)
      const { error: dbError } = await authClient.from('cards').insert({
        id: cardId,
        user_id: user.id,
        serial: serialNumber,
        front_path: frontPath,
        back_path: backPath,
        category: config.category,
        is_public: true,
      })

      if (dbError) {
        console.error('[Upload] Database error:', dbError)
        throw dbError
      }

      // Deduct credit after successful upload
      console.log('[Upload] Deducting credit...')
      try {
        const creditResponse = await fetch('/api/stripe/deduct', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ cardId, isRegrade: false }),
        })

        if (creditResponse.ok) {
          deductLocalCredit() // Update local state optimistically
          console.log('[Upload] Credit deducted successfully')
        } else {
          console.error('[Upload] Failed to deduct credit:', await creditResponse.text())
        }
      } catch (creditErr) {
        console.error('[Upload] Credit deduction error:', creditErr)
        // Don't fail the upload if credit deduction fails - it can be handled later
      }

      console.log('[Upload] Upload complete! Triggering grading...')
      setStatus(`✅ ${config.label} uploaded successfully! Processing in background...`)

      // Generate a signed URL for the thumbnail (persists across page refreshes)
      // The blob URL created earlier is only valid in the current session
      let persistentImageUrl = frontImageUrl // fallback to blob URL
      try {
        const { data: signedUrlData } = await authClient.storage
          .from('cards')
          .createSignedUrl(frontPath, 3600) // 1 hour expiry
        if (signedUrlData?.signedUrl) {
          persistentImageUrl = signedUrlData.signedUrl
          console.log('[Upload] Generated signed URL for queue thumbnail')
        }
      } catch (e) {
        console.warn('[Upload] Could not generate signed URL, using blob URL:', e)
      }

      // Update card status from 'uploading' to 'processing' so background polling can start
      // Also update the image URL to the persistent signed URL
      updateCardStatus(queueId, { status: 'processing', frontImageUrl: persistentImageUrl })

      // CRITICAL: Trigger the grading API (fire-and-forget)
      // This starts the actual AI grading process in the background
      console.log(`[Upload] Triggering AI grading for ${config.category} card: ${cardId}`)
      fetch(`${config.apiEndpoint}/${cardId}`).catch(err => {
        console.error(`[Upload] Failed to trigger grading for ${cardId}:`, err)
      })

      // Card is now processing - background polling will handle status updates
      // The loading animation will show with navigation buttons allowing user to leave
      // isUploading stays true to show CardAnalysisAnimation
    } catch (err: any) {
      console.error('[Upload] Upload failed:', err)
      setStatus(`❌ Upload failed: ${err.message}`)
      alert(`Upload failed: ${err.message}`)
      setIsUploading(false)
    }
  }

  // Handle camera/gallery selection
  const handleCameraSelect = () => {
    // Show tips popup on first upload attempt (no images yet)
    if (shouldShowPhotoTips && !frontFile && !backFile) {
      setPendingUploadAction('camera')
      setShowPhotoTipsPopup(true)
      return
    }
    proceedWithCamera()
  }

  const proceedWithCamera = () => {
    setOriginalUploadMethod('camera')
    setUploadMode('camera')
    // Determine which side to capture next
    if (!frontFile) {
      setCurrentSide('front')
    } else if (!backFile) {
      setCurrentSide('back')
    }
  }

  const handleGallerySelect = () => {
    // Show tips popup on first upload attempt (no images yet)
    if (shouldShowPhotoTips && !frontFile && !backFile) {
      setPendingUploadAction('gallery')
      setShowPhotoTipsPopup(true)
      return
    }
    proceedWithGallery()
  }

  const proceedWithGallery = () => {
    setOriginalUploadMethod('gallery')
    // Show gallery selection screen instead of immediately opening file picker
    setUploadMode('gallery')
  }

  // Handle photo tips popup actions
  const handlePhotoTipsProceed = () => {
    setShowPhotoTipsPopup(false)
    if (pendingUploadAction === 'camera') {
      proceedWithCamera()
    } else if (pendingUploadAction === 'gallery') {
      proceedWithGallery()
    } else if (pendingUploadAction === 'desktop-front') {
      document.getElementById('front-input')?.click()
    } else if (pendingUploadAction === 'desktop-back') {
      document.getElementById('back-input')?.click()
    }
    setPendingUploadAction(null)
  }

  const handlePhotoTipsClose = () => {
    setShowPhotoTipsPopup(false)
    setPendingUploadAction(null)
  }

  // Handle desktop file selection (shows tips popup on first upload)
  const handleDesktopFileSelect = (side: 'front' | 'back') => {
    // Show tips popup on first upload attempt (no images yet)
    if (shouldShowPhotoTips && !frontFile && !backFile) {
      setPendingUploadAction(side === 'front' ? 'desktop-front' : 'desktop-back')
      setShowPhotoTipsPopup(true)
      return
    }
    // Otherwise directly open file picker
    document.getElementById(side === 'front' ? 'front-input' : 'back-input')?.click()
  }

  const handleGalleryFileSelect = (side: 'front' | 'back') => {
    // Trigger the appropriate file input
    console.log(`[Gallery] Attempting to select ${side} image`)
    setCurrentSide(side)
    const inputId = side === 'front' ? 'front-input' : 'back-input'
    const input = document.getElementById(inputId) as HTMLInputElement
    console.log(`[Gallery] Found input element:`, input)
    if (input) {
      input.click()
      console.log(`[Gallery] Clicked ${inputId}`)
    } else {
      console.error(`[Gallery] Input element ${inputId} not found!`)
    }
  }

  const handleRetakePhoto = (side: 'front' | 'back') => {
    // Clear only the specific side being retaken
    if (side === 'front') {
      setFrontFile(null)
      setFrontHash(null)
      setFrontCompressed(null)
      setFrontCompressionInfo(null)
    } else {
      setBackFile(null)
      setBackHash(null)
      setBackCompressed(null)
      setBackCompressionInfo(null)
    }
    // Return to the original upload method (camera or gallery)
    setCurrentSide(side)
    setUploadMode(originalUploadMethod)
  }

  const handleReviewImages = () => {
    setUploadMode('select')
    // Scroll handled by useEffect
  }

  const handleResetUpload = () => {
    // Reset all upload state to allow grading another card
    setFrontFile(null)
    setBackFile(null)
    setFrontCompressed(null)
    setBackCompressed(null)
    setFrontCompressionInfo(null)
    setBackCompressionInfo(null)
    setFrontHash(null)
    setBackHash(null)
    setIsUploading(false)
    setIsCompressingFront(false)
    setIsCompressingBack(false)
    setStatus('')
    setUploadedCardId(null)
    setUploadedCardCategory(null)
    setUploadMode('select')
    console.log('[Upload] Reset upload state - ready for new card')
  }

  const handleCameraCapture = (file: File) => {
    console.log('[Upload] Camera captured:', currentSide, 'file size:', file.size)

    // Process captured image (async - will set isCompressing)
    handleFileSelect(file, currentSide)

    // Determine next step based on what photos we have
    const willHaveFront = currentSide === 'front' || frontFile
    const willHaveBack = currentSide === 'back' || backFile

    console.log('[Upload] After capture - willHaveFront:', willHaveFront, 'willHaveBack:', willHaveBack)

    if (currentSide === 'front' && !willHaveBack) {
      // Initial upload: after capturing front, go to back camera
      console.log('[Upload] Moving to back camera')
      setCurrentSide('back')
      setUploadMode('camera')
    } else if (currentSide === 'back' && !willHaveFront) {
      // Initial upload (back first): after capturing back, go to front camera
      console.log('[Upload] Moving to front camera')
      setCurrentSide('front')
      setUploadMode('camera')
    } else {
      // Retake scenario OR both photos captured: go to review screen
      console.log('[Upload] Moving to review screen')
      setUploadMode('review')
    }
  }

  const handleCameraCancel = () => {
    setUploadMode('select')
  }

  // Render hidden file inputs for all modes
  const hiddenFileInputs = (
    <>
      <input
        id="front-input"
        type="file"
        accept="image/*"
        disabled={isCompressing}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            handleFileSelect(file, 'front')
            // Clear the input so same file can be selected again
            e.target.value = ''
          }
        }}
        className="hidden"
      />
      <input
        id="back-input"
        type="file"
        accept="image/*"
        disabled={isCompressing}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            handleFileSelect(file, 'back')
            // Clear the input so same file can be selected again
            e.target.value = ''
          }
        }}
        className="hidden"
      />
    </>
  )

  // 🔒 Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // 🔒 Don't render anything if not authenticated (redirect is in progress)
  if (isAuthenticated === false) {
    return null;
  }

  // 💳 Show no-credits screen if user has 0 credits (block upload flow early)
  if (!creditsLoading && balance === 0 && !isUploading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 bg-gradient-to-br from-gray-50 to-purple-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Credits Required
          </h1>

          {/* Description */}
          <p className="text-gray-600 mb-6">
            You need at least 1 credit to grade a card. Purchase credits to start grading your collection.
          </p>

          {/* Current Balance */}
          <div className="bg-gray-100 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">Current Balance</p>
            <p className="text-3xl font-bold text-gray-900">0 credits</p>
          </div>

          {/* CTA Buttons */}
          <Link
            href="/credits"
            className="block w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg mb-3"
          >
            Purchase Credits
          </Link>

          <Link
            href="/"
            className="block w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            Back to Home
          </Link>

          {/* Info text */}
          <p className="text-xs text-gray-500 mt-6">
            Each card grading costs 1 credit. Credits never expire.
          </p>
        </div>
      </main>
    );
  }

  // Show loading animation when uploading (check this FIRST before other modes)
  if (isUploading && frontFile) {
    return (
      <CardAnalysisAnimation
        frontImageUrl={URL.createObjectURL(frontFile)}
        cardName={config.label}
        cardId={uploadedCardId || undefined}
        category={uploadedCardCategory || undefined}
        onGradeAnother={handleResetUpload}
      />
    )
  }

  // Show camera if in camera mode
  if (uploadMode === 'camera') {
    return (
      <>
        {hiddenFileInputs}
        <MobileCamera
          key={currentSide} // Force remount when switching sides
          side={currentSide}
          onCapture={handleCameraCapture}
          onCancel={handleCameraCancel}
        />
      </>
    )
  }

  // Show gallery selection screen
  if (uploadMode === 'gallery') {
    return (
      <>
        {hiddenFileInputs}
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-4">
          <h2 className="text-lg font-bold text-center">Select Images from Gallery</h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <div className="max-w-2xl mx-auto space-y-4">
            <p className="text-center text-gray-600 mb-6">
              Select photos of the front and back of your card
            </p>

            {/* Front Image Selection */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-gray-100 px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Front of Card</h3>
                {frontFile && <span className="text-green-600 text-sm">✓ Selected</span>}
              </div>
              <div className="p-4">
                {frontFile ? (
                  <div className="space-y-3">
                    <img
                      src={URL.createObjectURL(frontFile)}
                      alt="Front of card"
                      className="w-full rounded-lg"
                    />
                    <button
                      onClick={() => handleGalleryFileSelect('front')}
                      className="w-full px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    >
                      Change Front Image
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleGalleryFileSelect('front')}
                    className="w-full px-6 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                  >
                    <div className="text-center">
                      <div className="text-4xl mb-2">🖼️</div>
                      <div className="text-lg font-semibold text-gray-900 mb-1">
                        Select Front Image
                      </div>
                      <div className="text-sm text-gray-600">
                        Tap to choose from gallery
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Back Image Selection */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-gray-100 px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Back of Card</h3>
                {backFile && <span className="text-green-600 text-sm">✓ Selected</span>}
              </div>
              <div className="p-4">
                {backFile ? (
                  <div className="space-y-3">
                    <img
                      src={URL.createObjectURL(backFile)}
                      alt="Back of card"
                      className="w-full rounded-lg"
                    />
                    <button
                      onClick={() => handleGalleryFileSelect('back')}
                      className="w-full px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    >
                      Change Back Image
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleGalleryFileSelect('back')}
                    className="w-full px-6 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                  >
                    <div className="text-center">
                      <div className="text-4xl mb-2">🖼️</div>
                      <div className="text-lg font-semibold text-gray-900 mb-1">
                        Select Back Image
                      </div>
                      <div className="text-sm text-gray-600">
                        Tap to choose from gallery
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
              <p className="text-sm text-blue-800 font-semibold mb-2">💡 Tips for Best Results:</p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Use good lighting - avoid shadows and glare</li>
                <li>• Ensure all 4 corners are visible</li>
                <li>• Keep the card flat and in focus</li>
                <li>• Capture against a plain background</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white border-t border-gray-200 px-4 py-4 space-y-3">
          {/* Category Selection - Prominent Display */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-purple-600 uppercase tracking-wide mb-1">Card Category</p>
                <p className="text-lg font-bold text-gray-900">{CARD_TYPES[selectedType].label}</p>
              </div>
              <button
                onClick={() => {
                  const types = Object.keys(CARD_TYPES) as CardType[];
                  const currentIndex = types.indexOf(selectedType);
                  const nextIndex = (currentIndex + 1) % types.length;
                  setSelectedType(types[nextIndex]);
                }}
                className="px-4 py-2 bg-white border-2 border-purple-300 text-purple-700 rounded-lg font-semibold text-sm hover:bg-purple-50 hover:border-purple-400 transition-all shadow-sm"
              >
                Change
              </button>
            </div>
            {/* Category Options (shown when tapping change) */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(Object.keys(CARD_TYPES) as CardType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedType === type
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                  }`}
                >
                  {CARD_TYPES[type].label.replace(' Card', '')}
                </button>
              ))}
            </div>
            <p className="text-xs text-purple-600 mt-2 text-center">
              Make sure this matches your card type for accurate grading
            </p>
          </div>

          <button
            onClick={handleUpload}
            disabled={!frontCompressed || !backCompressed || isCompressing || isUploading}
            className="w-full px-4 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {isCompressing ? 'Processing Images...' : isUploading ? 'Uploading...' : !frontFile || !backFile ? 'Select Both Images' : '✓ Submit for Grading'}
          </button>

          {frontFile && backFile && (
            <button
              onClick={() => setUploadMode('select')}
              className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              ← Back to Upload
            </button>
          )}
        </div>
      </div>
      </>
    )
  }

  // Show review screen after both photos captured
  if (uploadMode === 'review' && frontFile && backFile) {
    return (
      <>
        {hiddenFileInputs}
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3">
          <h2 className="text-lg font-bold text-center">Review & Submit</h2>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Category Selector - Compact at top */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Card Type:</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as CardType)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              >
                {Object.entries(CARD_TYPES).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1.5 text-center">
              Make sure this matches your card type for accurate grading
            </p>
          </div>

          {/* Images Preview - Side by side on larger screens */}
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
              {/* Front Image */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="bg-gray-100 px-3 py-1.5 border-b">
                  <h3 className="font-semibold text-gray-900 text-sm text-center">Front</h3>
                </div>
                <div className="p-2">
                  <img
                    src={URL.createObjectURL(frontFile)}
                    alt="Front of card"
                    className="w-full rounded-lg"
                  />
                  <button
                    onClick={() => handleRetakePhoto('front')}
                    className="w-full mt-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    🔄 Retake
                  </button>
                </div>
              </div>

              {/* Back Image */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="bg-gray-100 px-3 py-1.5 border-b">
                  <h3 className="font-semibold text-gray-900 text-sm text-center">Back</h3>
                </div>
                <div className="p-2">
                  <img
                    src={URL.createObjectURL(backFile)}
                    alt="Back of card"
                    className="w-full rounded-lg"
                  />
                  <button
                    onClick={() => handleRetakePhoto('back')}
                    className="w-full mt-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    🔄 Retake
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="bg-white border-t border-gray-200 px-4 py-3 space-y-2">
          {/* Processing indicator */}
          {isCompressing && (
            <div className="flex items-center justify-center gap-2 text-indigo-600 py-1">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
              <span className="text-sm font-medium">Processing images...</span>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!frontCompressed || !backCompressed || isCompressing || isUploading}
            className="w-full px-4 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {isCompressing ? 'Processing Images...' : isUploading ? 'Uploading...' : '✓ Submit for Grading'}
          </button>

          <button
            onClick={() => setUploadMode('select')}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
          >
            ← Back
          </button>
        </div>
      </div>
      </>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 pt-20">
      {hiddenFileInputs}

      {/* Photo Tips Popup */}
      <PhotoTipsPopup
        isOpen={showPhotoTipsPopup}
        onClose={handlePhotoTipsClose}
        onProceed={handlePhotoTipsProceed}
      />

      {/* Insufficient Credits Modal */}
      {showInsufficientCredits && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8">
            <div className="text-center">
              {/* Icon */}
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">Insufficient Credits</h2>
              <p className="text-gray-600 mb-6">
                You need at least 1 credit to grade a card. Purchase credits to continue grading.
              </p>

              {/* Current Balance */}
              <div className="bg-gray-100 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600">Current Balance</p>
                <p className="text-3xl font-bold text-gray-900">{balance} credits</p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Link
                  href="/credits"
                  className="block w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200"
                >
                  Purchase Credits
                </Link>
                <button
                  onClick={() => setShowInsufficientCredits(false)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header - Always first */}
      <div className="text-center mb-4 md:mb-6 w-full">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Upload Card for Grading</h1>
        <p className="text-gray-600 text-sm md:text-base">DCM Optic™ grading and analysis for all card types</p>

        {/* Credit Balance Display */}
        {!creditsLoading && (
          <div className="mt-3 inline-flex items-center gap-2 bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{balance} credit{balance !== 1 ? 's' : ''} available</span>
            {balance === 0 && (
              <Link href="/credits" className="underline hover:text-purple-900">Get credits</Link>
            )}
          </div>
        )}
      </div>

      {/* Flex container for reordering on mobile */}
      <div className="flex flex-col w-full max-w-md md:max-w-3xl">
        {/* Informational Sections - Show after upload form on mobile, before on desktop */}
        <div className="order-3 md:order-1 mb-6 md:mb-8">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2 text-sm md:text-base">📊 What We Analyze</h3>
              <div className="text-xs md:text-sm text-blue-800 space-y-1">
                <p><strong>Centering:</strong> Border measurements and ratios</p>
                <p><strong>Condition:</strong> Corners, edges, surface quality</p>
                <p><strong>Authentication:</strong> Print quality, structural integrity</p>
                <p><strong>Card Details:</strong> Automatic extraction and identification</p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm md:text-base">{config.description.title}</h3>
              <ul className="text-xs md:text-sm text-gray-700 space-y-1 list-disc list-inside text-left">
                {config.description.items.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
              <p className="text-xs text-gray-600 mt-3">
                <strong>Analysis Time:</strong> Typically 30-90 seconds for comprehensive grading
              </p>
            </div>
          </div>
        </div>

        {/* Upload Form - Show first on mobile, after info sections on desktop */}
        <div className="order-1 md:order-2 w-full space-y-6 bg-white p-4 md:p-6 rounded-lg shadow-lg">
        {/* Card Type Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Type:
          </label>
          <select
            value={selectedType}
            onChange={(e) => {
              const newType = e.target.value as CardType;
              setSelectedType(newType);
              // Update URL without page reload
              router.push(`/upload?category=${newType}`, { scroll: false });
            }}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors bg-white text-gray-900 font-medium"
          >
            {Object.entries(CARD_TYPES).map(([key, value]) => (
              <option key={key} value={key}>
                {value.icon} {value.label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-center">
          <div className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
            {selectedType}
          </div>
        </div>

        {/* Upload Method Selector or File Upload - Show selector only when both images not uploaded */}
        {!frontFile && !backFile && showCameraOption && uploadMode === 'select' ? (
          <UploadMethodSelector
            side="front"
            onCameraSelect={handleCameraSelect}
            onGallerySelect={handleGallerySelect}
            creditsBalance={balance}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Front Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Front Image:
              </label>
              {!frontFile ? (
                <button
                  type="button"
                  onClick={() => {
                    if (showCameraOption) {
                      setCurrentSide('front')
                      setUploadMode('camera')
                    } else {
                      handleDesktopFileSelect('front')
                    }
                  }}
                  disabled={isCompressing}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="text-center">
                    <div className="text-2xl mb-2">📸</div>
                    <div className="text-sm font-medium text-gray-700">
                      {showCameraOption ? 'Capture Front Image' : 'Select Front Image'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {showCameraOption ? 'Tap to open camera' : 'Click to browse files'}
                    </div>
                  </div>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="w-16 h-20 bg-gray-100 rounded border overflow-hidden flex-shrink-0">
                      <img
                        src={URL.createObjectURL(frontFile)}
                        alt="Front preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-green-600 font-medium truncate">✓ {frontFile.name}</p>
                      {frontCompressionInfo && (
                        <div className="text-xs text-gray-600 space-y-1 mt-1">
                          <p>Original: {formatFileSize(frontCompressionInfo.originalSize)}</p>
                          <p>Compressed: {formatFileSize(frontCompressionInfo.compressedSize)} ({frontCompressionInfo.compressionRatio.toFixed(1)}% smaller)</p>
                          <p>Dimensions: {frontCompressionInfo.dimensions.width}×{frontCompressionInfo.dimensions.height}px</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {showCameraOption && (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentSide('front')
                          setUploadMode('camera')
                        }}
                        className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        📷 Camera
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => document.getElementById('front-input')?.click()}
                      className={`px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors ${
                        showCameraOption ? '' : 'col-span-2'
                      }`}
                    >
                      🖼️ Gallery
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Back Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Back Image:
              </label>
              {!backFile ? (
                <button
                  type="button"
                  onClick={() => {
                    if (showCameraOption) {
                      setCurrentSide('back')
                      setUploadMode('camera')
                    } else {
                      handleDesktopFileSelect('back')
                    }
                  }}
                  disabled={isCompressing}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="text-center">
                    <div className="text-2xl mb-2">🔄</div>
                    <div className="text-sm font-medium text-gray-700">
                      {showCameraOption ? 'Capture Back Image' : 'Select Back Image'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {showCameraOption ? 'Tap to open camera' : 'Click to browse files'}
                    </div>
                  </div>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="w-16 h-20 bg-gray-100 rounded border overflow-hidden flex-shrink-0">
                      <img
                        src={URL.createObjectURL(backFile)}
                        alt="Back preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-green-600 font-medium truncate">✓ {backFile.name}</p>
                      {backCompressionInfo && (
                        <div className="text-xs text-gray-600 space-y-1 mt-1">
                          <p>Original: {formatFileSize(backCompressionInfo.originalSize)}</p>
                          <p>Compressed: {formatFileSize(backCompressionInfo.compressedSize)} ({backCompressionInfo.compressionRatio.toFixed(1)}% smaller)</p>
                          <p>Dimensions: {backCompressionInfo.dimensions.width}×{backCompressionInfo.dimensions.height}px</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {showCameraOption && (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentSide('back')
                          setUploadMode('camera')
                        }}
                        className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        📷 Camera
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => document.getElementById('back-input')?.click()}
                      className={`px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors ${
                        showCameraOption ? '' : 'col-span-2'
                      }`}
                    >
                      🖼️ Gallery
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!frontCompressed || !backCompressed || isCompressing || isUploading}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-lg"
        >
          {isCompressing ? 'Compressing Images...' : isUploading ? 'Grading Card...' : 'Upload & Grade Card'}
        </button>

        {/* Status Message */}
        {status && (
          <div className="text-center">
            <p className="text-sm mt-4 p-3 rounded-md bg-gray-50">{status}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-500">
          <p>DCM Optic™ advanced grading system</p>
          <p>Comprehensive evaluation of centering, condition, and authenticity</p>
        </div>
        </div>
        {/* End Upload Form */}
      </div>
      {/* End Flex Container */}
    </main>
  )
}

// Wrap in Suspense for Next.js 15 useSearchParams() requirement
export default function UniversalUploadPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading upload page...</div>}>
      <UniversalUploadPageContent />
    </Suspense>
  )
}
