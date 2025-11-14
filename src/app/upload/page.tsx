'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { getStoredSession, getAuthenticatedClient } from '@/lib/directAuth'
import { compressImage, formatFileSize, getOptimalCompressionSettings } from '@/lib/imageCompression'
import CardAnalysisAnimation from './sports/CardAnalysisAnimation'

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
    serialPrefix: 'SPORTS',
    category: 'Sports',
    apiEndpoint: '/api/vision-grade',
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
    serialPrefix: 'POKEMON',
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
    serialPrefix: 'MTG',
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
    serialPrefix: 'LORCANA',
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
    serialPrefix: 'OTHER',
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
  const [isCompressing, setIsCompressing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Update selected type when URL param changes
  useEffect(() => {
    const categoryParam = searchParams?.get('category');
    if (categoryParam && categoryParam in CARD_TYPES) {
      setSelectedType(categoryParam as CardType);
    }
  }, [searchParams]);

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
    try {
      setIsCompressing(true)
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

      setStatus(`✅ ${side} image compressed: ${result.compressionRatio.toFixed(1)}% smaller`)
    } catch (error) {
      console.error(`Failed to compress ${side} image:`, error)
      setStatus(`❌ Failed to compress ${side} image`)
    } finally {
      setIsCompressing(false)
    }
  }

  const handleUpload = async () => {
    if (!frontCompressed || !backCompressed) {
      setStatus('❌ Please select both front and back images and wait for compression')
      return
    }

    // Get logged-in user from stored session
    const session = getStoredSession()

    if (!session || !session.user) {
      setStatus('❌ You must be logged in to upload')
      return
    }

    const user = session.user

    try {
      setIsUploading(true)
      setStatus(`⏳ Uploading ${config.label}...`)

      // Create unique ID for this card
      const cardId = crypto.randomUUID()

      // Build full storage paths
      const frontPath = `${user.id}/${cardId}/front.jpg`
      const backPath = `${user.id}/${cardId}/back.jpg`

      // Use authenticated client for uploads (includes user's access token)
      const authClient = getAuthenticatedClient()

      // Upload compressed front image
      const { error: frontError } = await authClient.storage
        .from('cards')
        .upload(frontPath, frontCompressed)

      if (frontError) throw frontError

      // Upload compressed back image
      const { error: backError } = await authClient.storage
        .from('cards')
        .upload(backPath, backCompressed)

      if (backError) throw backError

      // Save record in DB with selected category
      const { error: dbError } = await supabase.from('cards').insert({
        id: cardId,
        user_id: user.id,
        serial: `${config.serialPrefix}-${Math.random().toString(36).slice(2, 8)}`,
        front_path: frontPath,
        back_path: backPath,
        category: config.category,
        is_public: true,
      })

      if (dbError) throw dbError

      setStatus(`✅ ${config.label} uploaded successfully!`)

      // Wait for the card to be fully processed before redirecting
      const waitForProcessing = async () => {
        let attempts = 0
        const maxAttempts = 60 // 2 minutes max wait

        while (attempts < maxAttempts) {
          try {
            const checkRes = await fetch(`${config.apiEndpoint}/${cardId}`)

            if (checkRes.ok) {
              const data = await checkRes.json()
              // If card has ai_grading, it's fully processed
              // Accept both numeric grades and N/A grades
              if (data.ai_grading && (data.raw_decimal_grade !== undefined || data.dcm_grade_whole !== undefined || data.grading_status)) {
                router.push(`${config.route}/${cardId}`)
                return
              }
            }

            // Wait 2 seconds before checking again
            await new Promise(resolve => setTimeout(resolve, 2000))
            attempts++
          } catch (error) {
            console.error('Error checking card status:', error)
            attempts++
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }

        // If we get here, something went wrong - redirect anyway
        router.push(`${config.route}/${cardId}`)
      }

      // Start checking for completion
      waitForProcessing()
    } catch (err: any) {
      console.error(err)
      setStatus(`❌ Upload failed: ${err.message}`)
      setIsUploading(false)
    }
  }

  // Show loading animation when uploading
  if (isUploading && frontFile) {
    return (
      <CardAnalysisAnimation
        frontImageUrl={URL.createObjectURL(frontFile)}
        cardName={config.label}
      />
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 pt-20">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Card for Grading</h1>
        <p className="text-gray-600 mb-6">Professional AI grading and analysis for all card types</p>

        <div className="max-w-2xl mx-auto mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-blue-900 mb-2">📊 What We Analyze</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p><strong>Centering:</strong> Border measurements and ratios</p>
              <p><strong>Condition:</strong> Corners, edges, surface quality</p>
              <p><strong>Authentication:</strong> Print quality, structural integrity</p>
              <p><strong>Card Details:</strong> Automatic extraction and identification</p>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">{config.description.title}</h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside text-left">
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

      <div className="w-full max-w-md md:max-w-3xl space-y-6 bg-white p-6 rounded-lg shadow-lg">
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

        {/* Front and Back Image Upload - Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Front Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Front Image:
            </label>
            <input
              id="front-input"
              type="file"
              accept="image/*"
              disabled={isCompressing}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect(file, 'front')
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => document.getElementById('front-input')?.click()}
              disabled={isCompressing}
              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-center">
                <div className="text-2xl mb-2">📸</div>
                <div className="text-sm font-medium text-gray-700">
                  {frontFile ? 'Change Front Image' : 'Select Front Image'}
                </div>
                <div className="text-xs text-gray-500 mt-1">Click to browse files</div>
              </div>
            </button>
            {frontFile && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="w-16 h-20 bg-gray-100 rounded border overflow-hidden">
                    <img
                      src={URL.createObjectURL(frontFile)}
                      alt="Front preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-green-600 font-medium">✓ {frontFile.name}</p>
                    {frontCompressionInfo && (
                      <div className="text-xs text-gray-600 space-y-1 mt-1">
                        <p>Original: {formatFileSize(frontCompressionInfo.originalSize)}</p>
                        <p>Compressed: {formatFileSize(frontCompressionInfo.compressedSize)} ({frontCompressionInfo.compressionRatio.toFixed(1)}% smaller)</p>
                        <p>Dimensions: {frontCompressionInfo.dimensions.width}×{frontCompressionInfo.dimensions.height}px</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Back Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Back Image:
            </label>
            <input
              id="back-input"
              type="file"
              accept="image/*"
              disabled={isCompressing}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect(file, 'back')
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => document.getElementById('back-input')?.click()}
              disabled={isCompressing}
              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-center">
                <div className="text-2xl mb-2">🔄</div>
                <div className="text-sm font-medium text-gray-700">
                  {backFile ? 'Change Back Image' : 'Select Back Image'}
                </div>
                <div className="text-xs text-gray-500 mt-1">Click to browse files</div>
              </div>
            </button>
            {backFile && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="w-16 h-20 bg-gray-100 rounded border overflow-hidden">
                    <img
                      src={URL.createObjectURL(backFile)}
                      alt="Back preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-green-600 font-medium">✓ {backFile.name}</p>
                    {backCompressionInfo && (
                      <div className="text-xs text-gray-600 space-y-1 mt-1">
                        <p>Original: {formatFileSize(backCompressionInfo.originalSize)}</p>
                        <p>Compressed: {formatFileSize(backCompressionInfo.compressedSize)} ({backCompressionInfo.compressionRatio.toFixed(1)}% smaller)</p>
                        <p>Dimensions: {backCompressionInfo.dimensions.width}×{backCompressionInfo.dimensions.height}px</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

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
          <p>Professional AI grading system with advanced image analysis</p>
          <p>Comprehensive evaluation of centering, condition, and authenticity</p>
        </div>
      </div>
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
