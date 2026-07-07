import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Switch, Modal, Linking, Image,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { WebView } from 'react-native-webview'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Colors } from '@/lib/constants'
import { useLabelStyle } from '@/hooks/useLabelStyle'
import {
  checkEbayStatus, checkExistingListing, uploadImagesSequential, createListing,
  checkDisclaimer, acceptDisclaimer, getOAuthUrl, EbayApiError,
  generateTitle, SHIPPING_SERVICES,
  FIXED_PRICE_DURATION_OPTIONS, AUCTION_DURATION_OPTIONS, ALL_DURATION_OPTIONS,
  type EbayConnectionStatus, type CreateListingRequest, type ImageUploadResult,
} from '@/lib/ebayApi'
import { classifyEbayOAuthNavigation } from '@/lib/ebayOAuth'
import { resolveCardValue } from '@/lib/resolveCardValue'

import MobileTabBar from '@/components/MobileTabBar'
import AppHeaderBar from '@/components/AppHeaderBar'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'

type Step = 'connect' | 'details' | 'specifics' | 'shipping' | 'review' | 'publishing' | 'success' | 'error'

const STEP_LABELS: Record<Step, string> = {
  connect: '1. Connect & Images',
  details: '2. Listing Details',
  specifics: '3. Item Specifics',
  shipping: '4. Shipping & Returns',
  review: '5. Review & Publish',
  publishing: 'Publishing...',
  success: 'Success!',
  error: 'Error',
}

// eBay listing Terms & Conditions — mirrors the web modal's disclaimer
// (src/components/ebay/EbayListingModal.tsx). Last updated: January 2026 | v1.0
const DISCLAIMER_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: '1. DCM is Not a Party to Your eBay Transactions',
    body: 'DCM (Digital Card Marketplace) provides this listing tool solely as a convenience feature to help you list your DCM-graded cards on eBay. DCM is not a party to any transaction that occurs on the eBay platform. All sales, purchases, and related activities are conducted exclusively between you and the buyer through eBay.',
  },
  {
    heading: '2. No Liability for eBay Transactions',
    body: 'DCM shall not be held liable for any disputes, claims, damages, losses, or issues arising from your eBay listings or sales, including but not limited to: buyer complaints, return requests, refund disputes, shipping issues, payment problems, listing violations, account suspensions, or any other matters related to your eBay activity.',
  },
  {
    heading: '3. Grading Opinions',
    body: 'DCM grades represent our professional assessment of card condition at the time of grading. Grades are opinions and are not guarantees of value, authenticity, or future market performance. Buyers may have different opinions regarding condition, and you are responsible for handling any disputes that may arise.',
  },
  {
    heading: '4. Your Responsibilities',
    body: 'You are solely responsible for: the accuracy of all listing information (titles, descriptions, prices, shipping terms); compliance with eBay’s terms of service, listing policies, and all applicable laws; handling all buyer communications, shipping, returns, and refunds; any fees, taxes, or costs associated with your eBay sales; and ensuring you have the legal right to sell the items you list.',
  },
  {
    heading: '5. Indemnification',
    body: 'You agree to indemnify, defend, and hold harmless DCM, its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, costs, or expenses (including reasonable attorneys’ fees) arising from or related to your use of this eBay listing feature or any eBay transactions.',
  },
  {
    heading: '6. eBay Account',
    body: 'You are responsible for maintaining your eBay account in good standing. DCM is not responsible for any actions eBay may take against your account, including but not limited to listing removals, selling restrictions, or account suspensions.',
  },
  {
    heading: '7. Service Availability',
    body: 'DCM provides this listing feature "as is" and makes no guarantees regarding its availability, accuracy, or functionality. DCM may modify, suspend, or discontinue this feature at any time without notice.',
  },
  {
    heading: '8. Governing Law',
    body: 'These terms shall be governed by and construed in accordance with applicable laws. Any disputes shall be resolved through binding arbitration or in the courts of competent jurisdiction.',
  },
]

export default function EbayListScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ cardId?: string; cardPath?: string }>()
  const { session } = useAuth()
  // Accept either ?cardId=… or the legacy ?cardPath=/category/<id>
  const cardId = params.cardId || (params.cardPath ? params.cardPath.split('/').filter(Boolean).pop() || '' : '')

  // Card data
  const [card, setCard] = useState<any>(null)
  const [frontUrl, setFrontUrl] = useState<string | null>(null)
  const [backUrl, setBackUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const insets = useSafeAreaInsets()
  const { labelStyle } = useLabelStyle()

  // eBay state
  const [ebayStatus, setEbayStatus] = useState<EbayConnectionStatus | null>(null)
  const [step, setStep] = useState<Step>('connect')
  const [showOAuth, setShowOAuth] = useState(false)
  const [oauthUrl, setOauthUrl] = useState('')

  // Step 1: Images — populated by the hidden WebView running /ebay-image-prep
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [selectedImages, setSelectedImages] = useState({ front: true, back: true, miniReport: true, rawFront: true, rawBack: true })
  const [imagesReady, setImagesReady] = useState(false)
  const [imagesGenerating, setImagesGenerating] = useState(false)
  const [imagesError, setImagesError] = useState<string | null>(null)
  // User-uploaded additional images from device gallery
  const [additionalImages, setAdditionalImages] = useState<Array<{ id: string; uri: string; base64?: string; selected: boolean }>>([])
  // Ordered list of image references — the user reorders this; first selected becomes main image
  type OrderedImageItem = { kind: 'system'; key: 'front'|'back'|'miniReport'|'rawFront'|'rawBack' } | { kind: 'custom'; id: string }
  const [imageOrder, setImageOrder] = useState<OrderedImageItem[]>([])

  // Step 2: Details
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [listingFormat, setListingFormat] = useState<'FIXED_PRICE' | 'AUCTION'>('FIXED_PRICE')
  const [bestOfferEnabled, setBestOfferEnabled] = useState(true)
  const [duration, setDuration] = useState('GTC')
  // Default to rendered preview — matches the web's UX
  const [showDescriptionPreview, setShowDescriptionPreview] = useState(true)
  const [descriptionPreviewHeight, setDescriptionPreviewHeight] = useState(400)

  // Step 3: Specifics
  type ItemSpecific = { name: string; value: string | string[]; required?: boolean; editable?: boolean }
  const [itemSpecifics, setItemSpecifics] = useState<ItemSpecific[]>([])

  // Certificate of Analysis (uploaded to eBay as a regulatory document by the prep WebView)
  const [regulatoryDocumentId, setRegulatoryDocumentId] = useState<string | null>(null)

  // Step 4: Shipping
  const [shipping, setShipping] = useState({
    shippingType: 'CALCULATED' as 'FREE' | 'FLAT_RATE' | 'CALCULATED',
    domesticService: 'USPSPriority',
    flatRate: '5.00',
    handlingDays: '1',
    postalCode: '',
    weightOz: '4',
    lengthIn: '10',
    widthIn: '6',
    depthIn: '1',
    offerInternational: false,
    intlService: 'USPSPriorityMailInternational',
    intlFlatRate: '15.00',
    returnsAccepted: false,
    returnPeriod: '30',
    returnShipping: 'BUYER' as 'BUYER' | 'SELLER',
  })

  // Step 5: Result
  const [listingResult, setListingResult] = useState<any>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishProgress, setPublishProgress] = useState<string>('')
  // Ref guard against double-taps on Publish — the isPublishing state update
  // is async, so a fast second tap can slip past the button's disabled prop.
  const publishingRef = useRef(false)
  // True when the last publish failure was an eBay auth problem (401 /
  // "refresh eBay authorization") — shows a Reconnect CTA on the error step.
  const [isAuthError, setIsAuthError] = useState(false)
  // Set when the Reconnect CTA opens the OAuth modal so a successful
  // reconnect returns the user straight to the review step.
  const returnToReviewAfterOAuth = useRef(false)
  // Cache of eBay-hosted URLs from a successful upload pass, keyed by a
  // signature of the image selection — lets a retry after a publish failure
  // (e.g. expired token) skip re-generating/re-uploading unchanged images.
  const uploadCacheRef = useRef<{ signature: string; urls: ImageUploadResult['urls'] } | null>(null)

  // Duplicate-listing pre-check — blocks the wizard when the card already
  // has an active/pending eBay listing (the server would 409 at publish).
  const [existingListing, setExistingListing] = useState<{ listingId: string; listingUrl?: string | null; status: string } | null>(null)
  const [existingWarning, setExistingWarning] = useState<string | null>(null)

  // Disclaimer gate — publish is blocked until the eBay listing terms are accepted.
  const [disclaimerStatus, setDisclaimerStatus] = useState<'checking' | 'needs_acceptance' | 'accepted'>('checking')
  const [disclaimerChecked, setDisclaimerChecked] = useState(false)
  const [isAcceptingDisclaimer, setIsAcceptingDisclaimer] = useState(false)

  // ─── Load card data ───
  useEffect(() => {
    if (!cardId) { setIsLoading(false); return }
    (async () => {
      const { data } = await supabase.from('cards').select('*').eq('id', cardId).single()
      if (data) {
        setCard(data)
        setTitle(generateTitle(data))
        // Seed the price from the card's resolved market value (user-editable, seed once)
        const resolved = resolveCardValue(data)
        if (resolved.value > 0) setPrice(prev => prev || resolved.value.toFixed(2))
        // Get signed URLs
        const paths = [data.front_path, data.back_path].filter(Boolean)
        if (paths.length > 0) {
          const { data: urls } = await supabase.storage.from('cards').createSignedUrls(paths, 3600)
          urls?.forEach(u => {
            if (u.path === data.front_path) setFrontUrl(u.signedUrl)
            if (u.path === data.back_path) setBackUrl(u.signedUrl)
          })
        }
      }
      setIsLoading(false)
    })()
  }, [cardId])

  // ─── Check eBay connection ───
  useEffect(() => {
    if (!session) return
    checkEbayStatus().then(setEbayStatus).catch(() => setEbayStatus(null))
  }, [session])

  // ─── Duplicate-listing pre-check ───
  // Runs as soon as we have a card so the user doesn't walk the whole wizard
  // into a 409. An active/pending listing blocks the screen; a previous
  // (sold/ended/unverifiable) listing only shows a soft warning banner.
  useEffect(() => {
    if (!session || !cardId) return
    checkExistingListing(cardId)
      .then(check => {
        if (check.hasListing && check.listing) {
          setExistingListing({
            listingId: check.listing.listing_id,
            listingUrl: check.listing.listing_url,
            status: check.listing.status,
          })
        } else if (check.previousListing && check.message) {
          setExistingWarning(check.message)
        }
      })
      .catch(() => {}) // Pre-check is best-effort — the server still rejects duplicates at publish
  }, [session, cardId])

  // ─── Disclaimer status — checked once the eBay connection exists ───
  useEffect(() => {
    if (!ebayStatus?.connected) return
    let stale = false
    setDisclaimerStatus('checking')
    checkDisclaimer()
      .then(accepted => { if (!stale) setDisclaimerStatus(accepted ? 'accepted' : 'needs_acceptance') })
      .catch(() => { if (!stale) setDisclaimerStatus('needs_acceptance') })
    return () => { stale = true }
  }, [ebayStatus?.connected])

  const handleAcceptDisclaimer = useCallback(async () => {
    if (!disclaimerChecked || isAcceptingDisclaimer) return
    setIsAcceptingDisclaimer(true)
    try {
      await acceptDisclaimer()
      setDisclaimerStatus('accepted')
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to accept the terms. Please try again.')
    } finally {
      setIsAcceptingDisclaimer(false)
    }
  }, [disclaimerChecked, isAcceptingDisclaimer])

  // ─── OAuth completion handler ───
  const handleOAuthComplete = useCallback(() => {
    setShowOAuth(false)
    checkEbayStatus().then(status => {
      setEbayStatus(status)
      // NOTE: do NOT mark images ready here — once connected, the hidden prep
      // WebView below mounts and its message handler sets imagesReady when the
      // slab images / description / specifics actually arrive (same as the
      // already-connected path).
      if (status.connected && returnToReviewAfterOAuth.current) {
        // Reconnect after a token-expired publish failure — resume at review.
        returnToReviewAfterOAuth.current = false
        setIsAuthError(false)
        setStep('review')
      }
    })
  }, [])

  // ─── Image order helpers ───
  // Initialize order once system images are ready
  useEffect(() => {
    if (imagesReady && imageOrder.length === 0) {
      setImageOrder([
        { kind: 'system', key: 'front' },
        { kind: 'system', key: 'back' },
        { kind: 'system', key: 'miniReport' },
        { kind: 'system', key: 'rawFront' },
        { kind: 'system', key: 'rawBack' },
      ])
    }
  }, [imagesReady, imageOrder.length])

  const moveImage = useCallback((index: number, direction: -1 | 1) => {
    setImageOrder(prev => {
      const newIndex = index + direction
      if (newIndex < 0 || newIndex >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[newIndex]] = [next[newIndex], next[index]]
      return next
    })
  }, [])

  // ─── Pick additional images from gallery ───
  const pickAdditionalImages = useCallback(async () => {
    const systemSelectedCount = Object.values(selectedImages).filter(Boolean).length
    const additionalSelectedCount = additionalImages.filter(i => i.selected).length
    const remaining = Math.max(0, 12 - systemSelectedCount - additionalSelectedCount)
    if (remaining === 0) {
      Alert.alert('Image limit reached', 'eBay allows up to 12 images per listing.')
      return
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to add images.')
      return
    }
    let result: ImagePicker.ImagePickerResult
    try {
      // expo-image-picker 17+: MediaTypeOptions is deprecated; use the array form.
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.85,
        base64: true,
      })
    } catch (err: any) {
      console.warn('[ebay-list] picker error:', err)
      Alert.alert('Picker failed', err?.message || 'Could not open the photo library.')
      return
    }
    console.log('[ebay-list] picker result:', { canceled: result.canceled, count: result.canceled ? 0 : result.assets?.length })
    if (result.canceled) return
    const picked = (result.assets || []).slice(0, remaining)
    if (picked.length === 0) return
    // Build data URLs. Prefer base64 returned directly; fall back to FileSystem.read.
    const enriched = await Promise.all(
      picked.map(async (asset) => {
        try {
          let dataUrl: string | null = null
          if (asset.base64) {
            dataUrl = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
          } else if (asset.uri) {
            const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' as any })
            dataUrl = `data:${asset.mimeType || 'image/jpeg'};base64,${b64}`
          }
          if (!dataUrl) return null
          return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            uri: asset.uri,
            base64: dataUrl,
            selected: true,
          }
        } catch (err) {
          console.warn('[ebay-list] failed to read picked image:', err)
          return null
        }
      })
    )
    const valid = enriched.filter(Boolean) as Array<{ id: string; uri: string; base64?: string; selected: boolean }>
    console.log('[ebay-list] adding', valid.length, 'custom images')
    if (valid.length === 0) {
      Alert.alert('Could not load images', 'Failed to read the selected photos.')
      return
    }
    setAdditionalImages(prev => [...prev, ...valid])
    setImageOrder(prev => [...prev, ...valid.map(v => ({ kind: 'custom' as const, id: v.id }))])
  }, [selectedImages, additionalImages])

  const removeAdditionalImage = useCallback((id: string) => {
    setAdditionalImages(prev => prev.filter(i => i.id !== id))
    setImageOrder(prev => prev.filter(item => !(item.kind === 'custom' && item.id === id)))
  }, [])

  const toggleAdditionalImage = useCallback((id: string) => {
    setAdditionalImages(prev => prev.map(i => i.id === id ? { ...i, selected: !i.selected } : i))
  }, [])

  const startOAuth = useCallback(async () => {
    try {
      const url = await getOAuthUrl()
      setOauthUrl(url)
      setShowOAuth(true)
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to connect to eBay')
    }
  }, [])

  // ─── Publish listing ───
  const handlePublish = useCallback(async () => {
    if (!card) return
    if (publishingRef.current) return
    publishingRef.current = true
    setIsPublishing(true)
    setIsAuthError(false)
    setStep('publishing')

    try {
      // 1. Build images-to-upload from imageOrder (selected only)
      const imagesToUpload: Record<string, string> = {}
      const orderedExtras: { id: string; base64: string }[] = []
      // Walk the ordered list and pick what's selected
      for (const item of imageOrder) {
        if (item.kind === 'system') {
          const sel = (selectedImages as any)[item.key]
          if (!sel) continue
          const url = imageUrls[item.key]
          if (url) imagesToUpload[item.key] = url
        } else {
          const ai = additionalImages.find(a => a.id === item.id)
          if (ai && ai.selected && ai.base64) orderedExtras.push({ id: ai.id, base64: ai.base64 })
        }
      }

      // Fall back to raw signed URLs if generation didn't run / failed and no system images selected
      if (Object.keys(imagesToUpload).length === 0 && orderedExtras.length === 0) {
        if (frontUrl) imagesToUpload.front = frontUrl
        if (backUrl) imagesToUpload.back = backUrl
      }

      // Reuse eBay-hosted URLs from a previous successful upload pass when the
      // image selection hasn't changed — a retry after a failed publish (e.g.
      // expired token) shouldn't re-upload everything.
      const uploadSignature = JSON.stringify({
        system: Object.keys(imagesToUpload),
        extras: orderedExtras.map(e => e.id),
      })
      let uploadedUrls = uploadCacheRef.current?.signature === uploadSignature
        ? uploadCacheRef.current.urls
        : null

      if (!uploadedUrls) {
        // Upload one image at a time — Vercel has a 4.5 MB body limit and bundling
        // 5+ base64 PNGs blows past it.
        setPublishProgress('Uploading images…')
        const uploadResult = await uploadImagesSequential(
          cardId,
          imagesToUpload,
          orderedExtras.map(e => e.base64),
          (label, cur, total) => setPublishProgress(`${label} (${cur}/${total})`),
        )
        uploadedUrls = uploadResult.urls
        uploadCacheRef.current = { signature: uploadSignature, urls: uploadedUrls }
      }
      console.log('[ebay-list] upload result urls:', Object.keys(uploadedUrls))

      // Build the final URL list in the user's chosen order
      const orderedUrls: string[] = []
      let extraIdx = 0
      for (const item of imageOrder) {
        if (item.kind === 'system') {
          if (!(selectedImages as any)[item.key]) continue
          const url = (uploadedUrls as any)[item.key]
          if (url) orderedUrls.push(url)
        } else {
          const ai = additionalImages.find(a => a.id === item.id)
          if (!ai || !ai.selected || !ai.base64) continue
          const url = uploadedUrls.additional?.[extraIdx]
          if (url) orderedUrls.push(url)
          extraIdx++
        }
      }
      const allImageUrls = orderedUrls.length > 0
        ? orderedUrls
        : (Object.values(uploadedUrls).flat().filter(Boolean) as string[])

      if (allImageUrls.length === 0) throw new Error('No images to upload')

      // 2. Create listing
      const grade = card.conversational_whole_grade

      const listingData: CreateListingRequest = {
        cardId,
        grade,
        title,
        description,
        price: parseFloat(price) || 0,
        listingFormat,
        bestOfferEnabled: listingFormat === 'FIXED_PRICE' ? bestOfferEnabled : false,
        duration,
        imageUrls: allImageUrls,
        itemSpecifics: itemSpecifics
          .filter(s => Array.isArray(s.value) ? s.value.length > 0 : (s.value || '').trim().length > 0)
          .map(s => ({ name: s.name, value: s.value })),
        shippingType: shipping.shippingType,
        domesticShippingService: shipping.domesticService,
        flatRateAmount: parseFloat(shipping.flatRate) || 5,
        handlingDays: parseInt(shipping.handlingDays) || 1,
        postalCode: shipping.postalCode,
        packageWeightOz: parseInt(shipping.weightOz) || 4,
        packageLengthIn: parseInt(shipping.lengthIn) || 10,
        packageWidthIn: parseInt(shipping.widthIn) || 6,
        packageDepthIn: parseInt(shipping.depthIn) || 1,
        offerInternational: shipping.offerInternational,
        internationalShippingService: shipping.intlService,
        internationalFlatRateCost: parseFloat(shipping.intlFlatRate) || 15,
        domesticReturnsAccepted: shipping.returnsAccepted,
        domesticReturnPeriodDays: parseInt(shipping.returnPeriod) || 30,
        domesticReturnShippingPaidBy: shipping.returnShipping,
        internationalReturnsAccepted: false,
        // Attach Certificate of Analysis as eBay regulatory document if generation+upload succeeded
        regulatoryDocumentIds: regulatoryDocumentId ? [regulatoryDocumentId] : undefined,
      }

      const result = await createListing(listingData)

      if (result.success) {
        setListingResult(result)
        setStep('success')
      } else {
        throw new Error(result.error || result.userAction || 'Listing failed')
      }
    } catch (err: any) {
      console.warn('[ebay-list] publish failed:', err)
      const message = err?.message || String(err) || 'Failed to create listing'
      const status = err instanceof EbayApiError ? err.status : undefined
      // Server rejects with 412 { error: 'disclaimer_required' } when the
      // listing terms haven't been accepted — show the disclaimer gate on the
      // review step instead of a dead-end error.
      if (status === 412 || /disclaimer_required/i.test(message)) {
        setDisclaimerStatus('needs_acceptance')
        setDisclaimerChecked(false)
        setStep('review')
        return
      }
      // Expired/revoked eBay token — offer a Reconnect CTA on the error step.
      if (status === 401 || /refresh eBay authorization/i.test(message)) {
        setIsAuthError(true)
      }
      setErrorMessage(message)
      setStep('error')
    } finally {
      publishingRef.current = false
      setIsPublishing(false)
      setPublishProgress('')
    }
  }, [card, cardId, title, price, description, listingFormat, bestOfferEnabled, duration, imageOrder, imageUrls, selectedImages, additionalImages, frontUrl, backUrl, itemSpecifics, shipping, regulatoryDocumentId])

  // ─── Navigation helpers ───
  const canGoNext = useMemo(() => {
    switch (step) {
      case 'connect': return ebayStatus?.connected
      case 'details': return title.trim().length > 0 && parseFloat(price) > 0
      case 'specifics': return true
      case 'shipping': return shipping.postalCode.length >= 5
      default: return false
    }
  }, [step, ebayStatus, title, price, shipping.postalCode])

  const nextStep = useCallback(() => {
    const order: Step[] = ['connect', 'details', 'specifics', 'shipping', 'review']
    const idx = order.indexOf(step)
    if (idx >= 0 && idx < order.length - 1) setStep(order[idx + 1])
  }, [step])

  const prevStep = useCallback(() => {
    const order: Step[] = ['connect', 'details', 'specifics', 'shipping', 'review']
    const idx = order.indexOf(step)
    if (idx > 0) setStep(order[idx - 1])
  }, [step])

  // ─── Loading ───
  if (isLoading) {
    return <View style={st.center}><ActivityIndicator size="large" color={Colors.purple[600]} /><Text style={st.loadingText}>Loading card...</Text></View>
  }
  if (!card) {
    return <View style={st.center}><Text style={st.errorText}>Card not found</Text></View>
  }

  // ─── Blocked: card already has an active/pending eBay listing ───
  if (existingListing) {
    return (
      <View style={st.container}>
        <AppHeaderBar showBack title="List on eBay" />
        <View style={[st.section, { marginHorizontal: 12, alignItems: 'center', paddingVertical: 30 }]}>
          <Ionicons name="alert-circle" size={56} color={Colors.amber[500]} />
          <Text style={{ fontSize: 17, fontWeight: '800', color: Colors.gray[800], marginTop: 12 }}>Already Listed on eBay</Text>
          <Text style={{ fontSize: 12, color: Colors.gray[600], marginTop: 8, textAlign: 'center' }}>
            This card already has {existingListing.status === 'pending' ? 'a pending' : 'an active'} eBay listing
            (ID {existingListing.listingId}). End it on eBay before creating a new one.
          </Text>
          {existingListing.listingUrl && (
            <TouchableOpacity style={[st.primaryBtn, { marginTop: 16 }]} onPress={() => Linking.openURL(existingListing.listingUrl!)}>
              <Ionicons name="open-outline" size={18} color="#fff" />
              <Text style={st.primaryBtnText}>View on eBay</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[st.navBtnBack, { marginTop: 12 }]}
            onPress={() => router.push('/(tabs)/instalist-marketplace' as any)}
          >
            <Ionicons name="list" size={16} color={Colors.gray[600]} />
            <Text style={st.navBtnBackText}>View My Listings</Text>
          </TouchableOpacity>
        </View>
        <MobileTabBar />
      </View>
    )
  }

  return (
    <View style={st.container}>
      <AppHeaderBar showBack title="List on eBay" />
      {/* OAuth WebView Modal */}
      <Modal visible={showOAuth} animationType="slide" onRequestClose={() => setShowOAuth(false)}>
        <View style={{ flex: 1 }}>
          <View style={st.oauthHeader}>
            <TouchableOpacity onPress={() => setShowOAuth(false)}>
              <Ionicons name="close" size={24} color={Colors.gray[700]} />
            </TouchableOpacity>
            <Text style={st.oauthTitle}>Connect to eBay</Text>
            <View style={{ width: 24 }} />
          </View>
          {oauthUrl ? (
            <WebView
              source={{ uri: oauthUrl }}
              onNavigationStateChange={(navState) => {
                const result = classifyEbayOAuthNavigation(navState.url)
                if (result.type === 'pending') return
                if (result.type === 'success') {
                  handleOAuthComplete()
                  return
                }
                setShowOAuth(false)
                if (result.type === 'failure') {
                  Alert.alert('eBay Connection Failed', result.message)
                } else {
                  Alert.alert('eBay Connection Cancelled', 'You did not authorize the connection.')
                }
              }}
            />
          ) : (
            <ActivityIndicator size="large" color={Colors.purple[600]} style={{ marginTop: 40 }} />
          )}
        </View>
      </Modal>

      {/* Step indicator */}
      <View style={st.stepBar}>
        {['connect', 'details', 'specifics', 'shipping', 'review'].map((s, i) => {
          const current = ['connect', 'details', 'specifics', 'shipping', 'review'].indexOf(step)
          const isActive = i === current
          const isDone = i < current
          return (
            <View key={s} style={[st.stepDot, isActive && st.stepDotActive, isDone && st.stepDotDone]}>
              <Text style={[st.stepDotText, (isActive || isDone) && st.stepDotTextActive]}>{isDone ? '✓' : i + 1}</Text>
            </View>
          )
        })}
      </View>
      <Text style={st.stepLabel}>{STEP_LABELS[step]}</Text>

      <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}>

        {/* ═══ STEP 1: Connect & Images ═══ */}
        {step === 'connect' && (
          <View style={st.section}>
            {/* Soft warning — card was previously listed (sold/ended/unverifiable) */}
            {existingWarning && (
              <View style={st.warnBanner}>
                <Ionicons name="information-circle" size={16} color={Colors.amber[600]} />
                <Text style={st.warnBannerText}>{existingWarning}</Text>
              </View>
            )}
            {/* Connection status */}
            {ebayStatus?.connected ? (
              <View style={st.connectedBox}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.green[600]} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.green[600] }}>Connected to eBay</Text>
                  <Text style={{ fontSize: 12, color: Colors.gray[500] }}>{ebayStatus.connection?.ebay_username}</Text>
                </View>
              </View>
            ) : (
              <View>
                <Text style={st.sectionTitle}>Connect Your eBay Account</Text>
                <Text style={{ fontSize: 12, color: Colors.gray[500], marginBottom: 12 }}>
                  Link your eBay seller account to list cards directly from DCM.
                </Text>
                <TouchableOpacity style={st.primaryBtn} onPress={startOAuth}>
                  <Ionicons name="link" size={18} color="#fff" />
                  <Text style={st.primaryBtnText}>Connect to eBay</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Generated images — slab-overlaid front/back, mini grade report, and raw images */}
            {ebayStatus?.connected && (
              <View style={{ marginTop: 16 }}>
                <Text style={st.sectionTitle}>Listing Images</Text>
                <Text style={{ fontSize: 11, color: Colors.gray[500], marginBottom: 10 }}>
                  Toggle which images to include in your listing.
                </Text>
                {imagesGenerating && !imagesReady && (
                  <View style={st.imageGenStatus}>
                    <ActivityIndicator size="small" color={Colors.purple[600]} />
                    <Text style={st.imageGenStatusText}>Generating slab images and mini grade report…</Text>
                  </View>
                )}
                {imagesError && (
                  <View style={[st.imageGenStatus, { borderColor: Colors.red[500], backgroundColor: Colors.red[50] }]}>
                    <Ionicons name="warning" size={14} color={Colors.red[600]} />
                    <Text style={[st.imageGenStatusText, { color: Colors.red[600] }]} numberOfLines={3}>{imagesError}</Text>
                  </View>
                )}
                {imagesReady && (() => {
                  const SYSTEM_LABELS: Record<string, string> = {
                    front: 'Front (Slab)', back: 'Back (Slab)', miniReport: 'Mini Report', rawFront: 'Raw Front', rawBack: 'Raw Back',
                  }
                  // Find the index of the first selected image — that becomes the main image
                  const mainIdx = imageOrder.findIndex(item => {
                    if (item.kind === 'system') return (selectedImages as any)[item.key]
                    return additionalImages.find(a => a.id === item.id)?.selected
                  })
                  return (
                    <View style={st.imageGrid}>
                      {imageOrder.map((item, idx) => {
                        const isFirst = idx === 0
                        const isLast = idx === imageOrder.length - 1
                        const isMain = idx === mainIdx
                        if (item.kind === 'system') {
                          const url = imageUrls[item.key]
                          if (!url) return null
                          const selected = (selectedImages as any)[item.key]
                          return (
                            <View key={`s-${item.key}`} style={[st.imageTile, selected && st.imageTileSelected]}>
                              {isMain && <View style={st.mainBadge}><Text style={st.mainBadgeText}>MAIN</Text></View>}
                              <TouchableOpacity onPress={() => setSelectedImages(p => ({ ...p, [item.key]: !selected }))} activeOpacity={0.8}>
                                <Image source={{ uri: url }} style={st.imageTileThumb} resizeMode="contain" />
                              </TouchableOpacity>
                              <View style={st.reorderRow}>
                                <TouchableOpacity disabled={isFirst} onPress={() => moveImage(idx, -1)} style={[st.reorderBtn, isFirst && st.reorderBtnDisabled]}>
                                  <Ionicons name="arrow-back" size={12} color={isFirst ? Colors.gray[300] : Colors.purple[600]} />
                                </TouchableOpacity>
                                <Text style={st.positionText}>{idx + 1}</Text>
                                <TouchableOpacity disabled={isLast} onPress={() => moveImage(idx, 1)} style={[st.reorderBtn, isLast && st.reorderBtnDisabled]}>
                                  <Ionicons name="arrow-forward" size={12} color={isLast ? Colors.gray[300] : Colors.purple[600]} />
                                </TouchableOpacity>
                              </View>
                              <TouchableOpacity onPress={() => setSelectedImages(p => ({ ...p, [item.key]: !selected }))} style={st.imageTileFooter}>
                                <Ionicons
                                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                                  size={14}
                                  color={selected ? Colors.purple[600] : Colors.gray[400]}
                                />
                                <Text style={st.imageTileLabel} numberOfLines={1}>{SYSTEM_LABELS[item.key]}</Text>
                              </TouchableOpacity>
                            </View>
                          )
                        }
                        const img = additionalImages.find(a => a.id === item.id)
                        if (!img) return null
                        return (
                          <View key={`c-${img.id}`} style={[st.imageTile, img.selected && st.imageTileSelected]}>
                            {isMain && <View style={st.mainBadge}><Text style={st.mainBadgeText}>MAIN</Text></View>}
                            <TouchableOpacity onPress={() => toggleAdditionalImage(img.id)} activeOpacity={0.8}>
                              <Image source={{ uri: img.uri }} style={st.imageTileThumb} resizeMode="cover" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={st.removeImageBtn}
                              onPress={() => removeAdditionalImage(img.id)}
                              hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                            >
                              <Ionicons name="close-circle" size={18} color={Colors.red[600]} />
                            </TouchableOpacity>
                            <View style={st.reorderRow}>
                              <TouchableOpacity disabled={isFirst} onPress={() => moveImage(idx, -1)} style={[st.reorderBtn, isFirst && st.reorderBtnDisabled]}>
                                <Ionicons name="arrow-back" size={12} color={isFirst ? Colors.gray[300] : Colors.purple[600]} />
                              </TouchableOpacity>
                              <Text style={st.positionText}>{idx + 1}</Text>
                              <TouchableOpacity disabled={isLast} onPress={() => moveImage(idx, 1)} style={[st.reorderBtn, isLast && st.reorderBtnDisabled]}>
                                <Ionicons name="arrow-forward" size={12} color={isLast ? Colors.gray[300] : Colors.purple[600]} />
                              </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={() => toggleAdditionalImage(img.id)} style={st.imageTileFooter}>
                              <Ionicons
                                name={img.selected ? 'checkmark-circle' : 'ellipse-outline'}
                                size={14}
                                color={img.selected ? Colors.purple[600] : Colors.gray[400]}
                              />
                              <Text style={st.imageTileLabel} numberOfLines={1}>Custom</Text>
                            </TouchableOpacity>
                          </View>
                        )
                      })}

                      {/* Add Photo button */}
                      {(() => {
                        const totalSelected =
                          Object.values(selectedImages).filter(Boolean).length +
                          additionalImages.filter(i => i.selected).length
                        if (totalSelected >= 12 || additionalImages.length >= 12) return null
                        return (
                          <TouchableOpacity style={st.addPhotoTile} onPress={pickAdditionalImages} activeOpacity={0.7}>
                            <Ionicons name="add-circle-outline" size={28} color={Colors.gray[400]} />
                            <Text style={st.addPhotoText}>Add Photo</Text>
                          </TouchableOpacity>
                        )
                      })()}
                    </View>
                  )
                })()}
                {imagesReady && (
                  <Text style={st.imageHint}>
                    {Object.values(selectedImages).filter(Boolean).length + additionalImages.filter(i => i.selected).length} of 12 selected. Tap to toggle, X to remove a custom photo.
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Hidden WebView — runs the canvas-based image generators on the web,
            posts back base64 data URLs for the 5 listing images. */}
        {ebayStatus?.connected && session?.access_token && cardId && !imagesReady && (
          <View pointerEvents="none" style={st.hiddenWebViewWrapper}>
            <WebView
              source={{
                uri: `${API_BASE}/ebay-image-prep/${cardId}?token=${encodeURIComponent(session.access_token)}&labelStyle=${labelStyle}`,
              }}
              originWhitelist={['*']}
              javaScriptEnabled
              onLoadStart={() => { setImagesGenerating(true); setImagesError(null) }}
              onMessage={(e) => {
                try {
                  const msg = JSON.parse(e.nativeEvent.data)
                  if (msg.type === 'images-ready' && msg.images) {
                    setImageUrls(msg.images)
                    setImagesReady(true)
                    setImagesGenerating(false)
                    if (msg.description && !description) setDescription(msg.description)
                    if (Array.isArray(msg.itemSpecifics) && itemSpecifics.length === 0) setItemSpecifics(msg.itemSpecifics)
                    if (msg.regulatoryDocumentId) setRegulatoryDocumentId(msg.regulatoryDocumentId)
                  } else if (msg.type === 'error') {
                    setImagesError(msg.message || 'Failed to generate images')
                    setImagesGenerating(false)
                  }
                } catch {}
              }}
              onError={(syntheticEvent) => {
                setImagesError(syntheticEvent.nativeEvent?.description || 'WebView load error')
                setImagesGenerating(false)
              }}
            />
          </View>
        )}

        {/* ═══ STEP 2: Listing Details ═══ */}
        {step === 'details' && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>Listing Details</Text>

            <Text style={st.fieldLabel}>Title (max 80 chars)</Text>
            <TextInput style={st.input} value={title} onChangeText={t => setTitle(t.substring(0, 80))} maxLength={80} />
            <Text style={st.charCount}>{title.length}/80</Text>

            <Text style={st.fieldLabel}>Price ($)</Text>
            <TextInput style={st.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={Colors.gray[400]} />

            <Text style={st.fieldLabel}>Listing Format</Text>
            <View style={st.segmentRow}>
              {(['FIXED_PRICE', 'AUCTION'] as const).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[st.segment, listingFormat === f && st.segmentActive]}
                  onPress={() => {
                    setListingFormat(f)
                    // eBay requires GTC for fixed price; 7 days is the recommended auction duration
                    setDuration(f === 'FIXED_PRICE' ? 'GTC' : 'DAYS_7')
                  }}
                >
                  <Text style={[st.segmentText, listingFormat === f && st.segmentTextActive]}>{f === 'FIXED_PRICE' ? 'Buy It Now' : 'Auction'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {listingFormat === 'FIXED_PRICE' && (
              <View style={st.switchRow}>
                <Text style={st.switchLabel}>Accept Best Offers</Text>
                <Switch value={bestOfferEnabled} onValueChange={setBestOfferEnabled} />
              </View>
            )}

            <Text style={st.fieldLabel}>Duration</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(listingFormat === 'FIXED_PRICE' ? FIXED_PRICE_DURATION_OPTIONS : AUCTION_DURATION_OPTIONS).map(d => (
                  <TouchableOpacity key={d.value} style={[st.chip, duration === d.value && st.chipActive]} onPress={() => setDuration(d.value)}>
                    <Text style={[st.chipText, duration === d.value && st.chipTextActive]}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            {listingFormat === 'FIXED_PRICE' && (
              <Text style={st.helperText}>eBay requires Good Til Cancelled for Buy It Now listings.</Text>
            )}

            {/* Listing Description (HTML, pre-filled with DCM-branded template) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={st.fieldLabel}>Listing Description</Text>
              {description.length > 0 && (
                <TouchableOpacity
                  onPress={() => setShowDescriptionPreview(prev => !prev)}
                  style={st.previewBtn}
                >
                  <Ionicons
                    name={showDescriptionPreview ? 'code-slash-outline' : 'eye-outline'}
                    size={12}
                    color={Colors.purple[600]}
                  />
                  <Text style={st.previewBtnText}>
                    {showDescriptionPreview ? 'Edit HTML' : 'Preview'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={st.helperText}>
              {showDescriptionPreview
                ? 'Preview of how this will appear on eBay. Tap "Edit HTML" to customize the markup.'
                : 'Edit the HTML directly. Tap "Preview" to see how it will render on eBay.'}
            </Text>
            {description.length > 0 && showDescriptionPreview ? (
              <View style={[st.descriptionPreviewBox, { height: descriptionPreviewHeight }]}>
                <WebView
                  originWhitelist={['*']}
                  source={{
                    html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:8px;font-family:-apple-system,Roboto,sans-serif;background:#fff;}img{max-width:100%;height:auto;}</style></head><body>${description}<script>
                      function postHeight(){
                        var h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
                        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'height',value:h}));
                      }
                      window.addEventListener('load', postHeight);
                      window.addEventListener('resize', postHeight);
                      // Re-measure after images load
                      setTimeout(postHeight, 200);
                      setTimeout(postHeight, 800);
                    <\/script></body></html>`,
                  }}
                  onMessage={(e) => {
                    try {
                      const msg = JSON.parse(e.nativeEvent.data)
                      if (msg.type === 'height' && typeof msg.value === 'number') {
                        // +24px buffer to avoid clipping the last line
                        const next = Math.ceil(msg.value) + 24
                        setDescriptionPreviewHeight(prev => (Math.abs(prev - next) > 4 ? next : prev))
                      }
                    } catch {}
                  }}
                  style={{ flex: 1, backgroundColor: 'transparent' }}
                  scrollEnabled={false}
                />
              </View>
            ) : (
              <TextInput
                style={[st.input, { minHeight: 140, textAlignVertical: 'top' as const, fontSize: 10, fontFamily: 'SpaceMono' }]}
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder={imagesGenerating ? 'Generating description…' : 'Description will appear here once images finish generating.'}
                placeholderTextColor={Colors.gray[400]}
              />
            )}
          </View>
        )}

        {/* ═══ STEP 3: Item Specifics ═══ */}
        {step === 'specifics' && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>Item Specifics</Text>
            <Text style={{ fontSize: 11, color: Colors.gray[500], marginBottom: 12 }}>
              Pre-filled from your card data. Required fields are marked with *. Tap any field to edit.
            </Text>
            {itemSpecifics.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                {imagesGenerating
                  ? <ActivityIndicator size="small" color={Colors.purple[600]} />
                  : <Text style={{ fontSize: 12, color: Colors.gray[400], textAlign: 'center' }}>Item specifics will be auto-filled based on your card's category and details.</Text>}
              </View>
            )}
            {itemSpecifics.map((spec, i) => {
              const stringValue = Array.isArray(spec.value) ? spec.value.join(', ') : (spec.value || '')
              const editable = spec.editable !== false
              return (
                <View key={`${spec.name}-${i}`} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={st.fieldLabel}>
                      {spec.name}
                      {spec.required && <Text style={{ color: Colors.red[600] }}> *</Text>}
                    </Text>
                    {!editable && <Text style={st.lockedText}>locked</Text>}
                  </View>
                  <TextInput
                    style={[st.input, !editable && { backgroundColor: Colors.gray[100], color: Colors.gray[600] }]}
                    value={stringValue}
                    editable={editable}
                    onChangeText={v => {
                      if (!editable) return
                      const updated = [...itemSpecifics]
                      updated[i] = { ...updated[i], value: v }
                      setItemSpecifics(updated)
                    }}
                    placeholder={spec.required ? `${spec.name} (required)` : `Optional`}
                    placeholderTextColor={Colors.gray[400]}
                  />
                </View>
              )
            })}
          </View>
        )}

        {/* ═══ STEP 4: Shipping & Returns ═══ */}
        {step === 'shipping' && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>Shipping</Text>

            <Text style={st.fieldLabel}>Shipping Type</Text>
            <View style={st.segmentRow}>
              {(['FREE', 'FLAT_RATE', 'CALCULATED'] as const).map(t => (
                <TouchableOpacity key={t} style={[st.segment, shipping.shippingType === t && st.segmentActive]} onPress={() => setShipping(p => ({ ...p, shippingType: t }))}>
                  <Text style={[st.segmentText, shipping.shippingType === t && st.segmentTextActive]}>{t === 'FLAT_RATE' ? 'Flat Rate' : t === 'FREE' ? 'Free' : 'Calculated'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={st.fieldLabel}>Shipping Service</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {SHIPPING_SERVICES.map(s => (
                  <TouchableOpacity key={s.value} style={[st.chip, shipping.domesticService === s.value && st.chipActive]} onPress={() => setShipping(p => ({ ...p, domesticService: s.value }))}>
                    <Text style={[st.chipText, shipping.domesticService === s.value && st.chipTextActive]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {shipping.shippingType === 'FLAT_RATE' && (
              <>
                <Text style={st.fieldLabel}>Flat Rate ($)</Text>
                <TextInput style={st.input} value={shipping.flatRate} onChangeText={v => setShipping(p => ({ ...p, flatRate: v }))} keyboardType="decimal-pad" />
              </>
            )}

            <Text style={st.fieldLabel}>
              Postal Code <Text style={{ color: Colors.red[600] }}>*</Text>
            </Text>
            <TextInput
              style={[
                st.input,
                shipping.postalCode.length > 0 && shipping.postalCode.length < 5 && { borderColor: Colors.red[500] },
              ]}
              value={shipping.postalCode}
              onChangeText={v => setShipping(p => ({ ...p, postalCode: v.replace(/[^0-9]/g, '') }))}
              keyboardType="number-pad"
              maxLength={5}
              placeholder="12345 (required)"
              placeholderTextColor={Colors.gray[400]}
            />
            <Text style={st.helperText}>Required by eBay for shipping calculations.</Text>

            <Text style={st.fieldLabel}>Handling Days</Text>
            <TextInput style={st.input} value={shipping.handlingDays} onChangeText={v => setShipping(p => ({ ...p, handlingDays: v }))} keyboardType="number-pad" />

            <Text style={[st.sectionTitle, { marginTop: 16 }]}>Package Dimensions</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={st.fieldLabel}>Weight (oz)</Text>
                <TextInput style={st.input} value={shipping.weightOz} onChangeText={v => setShipping(p => ({ ...p, weightOz: v }))} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.fieldLabel}>Length (in)</Text>
                <TextInput style={st.input} value={shipping.lengthIn} onChangeText={v => setShipping(p => ({ ...p, lengthIn: v }))} keyboardType="number-pad" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={st.fieldLabel}>Width (in)</Text>
                <TextInput style={st.input} value={shipping.widthIn} onChangeText={v => setShipping(p => ({ ...p, widthIn: v }))} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.fieldLabel}>Depth (in)</Text>
                <TextInput style={st.input} value={shipping.depthIn} onChangeText={v => setShipping(p => ({ ...p, depthIn: v }))} keyboardType="number-pad" />
              </View>
            </View>

            <View style={[st.switchRow, { marginTop: 16 }]}>
              <Text style={st.switchLabel}>Offer International Shipping</Text>
              <Switch value={shipping.offerInternational} onValueChange={v => setShipping(p => ({ ...p, offerInternational: v }))} />
            </View>

            <Text style={[st.sectionTitle, { marginTop: 16 }]}>Returns</Text>
            <View style={st.switchRow}>
              <Text style={st.switchLabel}>Accept Returns</Text>
              <Switch value={shipping.returnsAccepted} onValueChange={v => setShipping(p => ({ ...p, returnsAccepted: v }))} />
            </View>
            {shipping.returnsAccepted && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={st.fieldLabel}>Return Period (days)</Text>
                  <TextInput style={st.input} value={shipping.returnPeriod} onChangeText={v => setShipping(p => ({ ...p, returnPeriod: v }))} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.fieldLabel}>Return Shipping</Text>
                  <View style={st.segmentRow}>
                    {(['BUYER', 'SELLER'] as const).map(w => (
                      <TouchableOpacity key={w} style={[st.segment, shipping.returnShipping === w && st.segmentActive]} onPress={() => setShipping(p => ({ ...p, returnShipping: w }))}>
                        <Text style={[st.segmentText, shipping.returnShipping === w && st.segmentTextActive]}>{w}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ═══ STEP 5: Review ═══ */}
        {step === 'review' && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>Review Your Listing</Text>

            <View style={st.reviewBox}>
              <Text style={st.reviewLabel}>Title</Text>
              <Text style={st.reviewValue}>{title}</Text>
            </View>
            <View style={st.reviewBox}>
              <Text style={st.reviewLabel}>Price</Text>
              <Text style={st.reviewValue}>${parseFloat(price || '0').toFixed(2)}</Text>
            </View>
            <View style={st.reviewBox}>
              <Text style={st.reviewLabel}>Format</Text>
              <Text style={st.reviewValue}>{listingFormat === 'FIXED_PRICE' ? 'Buy It Now' : 'Auction'}{bestOfferEnabled && listingFormat === 'FIXED_PRICE' ? ' + Best Offer' : ''}</Text>
            </View>
            <View style={st.reviewBox}>
              <Text style={st.reviewLabel}>Duration</Text>
              <Text style={st.reviewValue}>{ALL_DURATION_OPTIONS.find(d => d.value === duration)?.label || duration}</Text>
            </View>
            <View style={st.reviewBox}>
              <Text style={st.reviewLabel}>Shipping</Text>
              <Text style={st.reviewValue}>{shipping.shippingType === 'FREE' ? 'Free Shipping' : shipping.shippingType === 'FLAT_RATE' ? `Flat Rate $${shipping.flatRate}` : 'Calculated'}</Text>
            </View>
            <View style={st.reviewBox}>
              <Text style={st.reviewLabel}>Images</Text>
              <Text style={st.reviewValue}>
                {Object.values(selectedImages).filter(Boolean).length + additionalImages.filter(i => i.selected).length} selected
              </Text>
            </View>
            <View style={st.reviewBox}>
              <Text style={st.reviewLabel}>Certificate of Analysis</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons
                  name={regulatoryDocumentId ? 'checkmark-circle' : 'close-circle-outline'}
                  size={14}
                  color={regulatoryDocumentId ? Colors.green[600] : Colors.gray[400]}
                />
                <Text style={st.reviewValue}>{regulatoryDocumentId ? 'Attached' : 'Not attached'}</Text>
              </View>
            </View>

            {/* Disclaimer gate — publish is blocked until the eBay listing terms are accepted */}
            {disclaimerStatus === 'checking' && (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={Colors.purple[600]} />
                <Text style={{ fontSize: 11, color: Colors.gray[500], marginTop: 6 }}>Checking listing terms…</Text>
              </View>
            )}

            {disclaimerStatus === 'needs_acceptance' && (
              <View style={{ marginTop: 16 }}>
                <Text style={st.sectionTitle}>eBay Listing Terms & Conditions</Text>
                <Text style={{ fontSize: 11, color: Colors.gray[500], marginBottom: 8 }}>
                  Please review and accept before listing on eBay.
                </Text>
                <ScrollView style={st.disclaimerScroll} nestedScrollEnabled>
                  <Text style={st.disclaimerIntro}>
                    By using DCM's eBay listing feature, you acknowledge and agree to the following:
                  </Text>
                  {DISCLAIMER_SECTIONS.map(section => (
                    <View key={section.heading} style={{ marginBottom: 10 }}>
                      <Text style={st.disclaimerHeading}>{section.heading}</Text>
                      <Text style={st.disclaimerBody}>{section.body}</Text>
                    </View>
                  ))}
                  <Text style={st.disclaimerVersion}>Last updated: January 2026 | Version 1.0</Text>
                </ScrollView>
                <TouchableOpacity
                  style={st.disclaimerCheckRow}
                  onPress={() => setDisclaimerChecked(v => !v)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={disclaimerChecked ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={disclaimerChecked ? Colors.purple[600] : Colors.gray[400]}
                  />
                  <Text style={st.disclaimerCheckText}>
                    I have read and agree to the terms and conditions above. I understand that DCM is not responsible for any transactions that occur on eBay.
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.primaryBtn, { marginTop: 12 }, (!disclaimerChecked || isAcceptingDisclaimer) && { opacity: 0.4 }]}
                  onPress={handleAcceptDisclaimer}
                  disabled={!disclaimerChecked || isAcceptingDisclaimer}
                >
                  {isAcceptingDisclaimer ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={st.primaryBtnText}>Accept & Continue</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {disclaimerStatus === 'accepted' && (
              <TouchableOpacity style={[st.primaryBtn, { marginTop: 16 }]} onPress={handlePublish} disabled={isPublishing}>
                {isPublishing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="rocket" size={18} color="#fff" />
                    <Text style={st.primaryBtnText}>Publish to eBay</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ═══ Publishing ═══ */}
        {step === 'publishing' && (
          <View style={[st.section, { alignItems: 'center', paddingVertical: 40 }]}>
            <ActivityIndicator size="large" color={Colors.purple[600]} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.gray[800], marginTop: 16 }}>Creating Your Listing...</Text>
            <Text style={{ fontSize: 12, color: Colors.gray[500], marginTop: 4 }}>{publishProgress || 'Uploading images and publishing to eBay'}</Text>
          </View>
        )}

        {/* ═══ Success ═══ */}
        {step === 'success' && listingResult && (
          <View style={[st.section, { alignItems: 'center', paddingVertical: 30 }]}>
            <Ionicons name="checkmark-circle" size={64} color={Colors.green[600]} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: Colors.green[600], marginTop: 12 }}>Listed on eBay!</Text>
            <Text style={{ fontSize: 12, color: Colors.gray[500], marginTop: 4 }}>Listing ID: {listingResult.listingId}</Text>
            {listingResult.listingUrl && (
              <TouchableOpacity style={[st.primaryBtn, { marginTop: 16 }]} onPress={() => Linking.openURL(listingResult.listingUrl)}>
                <Ionicons name="open-outline" size={18} color="#fff" />
                <Text style={st.primaryBtnText}>View on eBay</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={{ marginTop: 12 }} onPress={() => router.back()}>
              <Text style={{ fontSize: 13, color: Colors.purple[600], fontWeight: '600' }}>Back to Card</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ═══ Error ═══ */}
        {step === 'error' && (
          <View style={[st.section, { alignItems: 'center', paddingVertical: 30 }]}>
            <Ionicons name="alert-circle" size={64} color={Colors.red[500]} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.red[600], marginTop: 12 }}>Listing Failed</Text>
            <Text style={{ fontSize: 12, color: Colors.gray[600], marginTop: 8, textAlign: 'center' }}>{errorMessage}</Text>
            {isAuthError && (
              <TouchableOpacity
                style={[st.primaryBtn, { marginTop: 16 }]}
                onPress={() => {
                  // Resume at review after a successful reconnect — the uploaded
                  // image URLs are cached, so retrying skips re-upload.
                  returnToReviewAfterOAuth.current = true
                  startOAuth()
                }}
              >
                <Ionicons name="link" size={18} color="#fff" />
                <Text style={st.primaryBtnText}>Reconnect eBay</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={isAuthError ? [st.navBtnBack, { marginTop: 12 }] : [st.primaryBtn, { marginTop: 16 }]}
              onPress={() => setStep('review')}
            >
              <Text style={isAuthError ? st.navBtnBackText : st.primaryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom navigation bar — pad for device home indicator / nav bar */}
      {!['publishing', 'success', 'error'].includes(step) && (
        <View style={[st.navBar, { paddingBottom: 12 + Math.max(insets.bottom, 4) }]}>
          {step !== 'connect' ? (
            <TouchableOpacity style={st.navBtnBack} onPress={prevStep}>
              <Ionicons name="arrow-back" size={18} color={Colors.gray[600]} />
              <Text style={st.navBtnBackText}>Back</Text>
            </TouchableOpacity>
          ) : <View />}
          {step !== 'review' && (
            <TouchableOpacity style={[st.navBtnNext, !canGoNext && st.navBtnDisabled]} onPress={nextStep} disabled={!canGoNext}>
              <Text style={st.navBtnNextText}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      )}
      <MobileTabBar />
    </View>
  )
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: Colors.gray[500] },
  errorText: { fontSize: 14, color: Colors.red[600] },

  // Step bar
  stepBar: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 12, paddingBottom: 4 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.gray[200], justifyContent: 'center', alignItems: 'center' },
  stepDotActive: { backgroundColor: Colors.purple[600] },
  stepDotDone: { backgroundColor: Colors.green[500] },
  stepDotText: { fontSize: 11, fontWeight: '700', color: Colors.gray[500] },
  stepDotTextActive: { color: '#fff' },
  stepLabel: { fontSize: 13, fontWeight: '700', color: Colors.gray[700], textAlign: 'center', marginBottom: 8 },

  // Content
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 100 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 8, borderWidth: 1, borderColor: Colors.gray[200] },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray[800], marginBottom: 10 },

  // Connection
  connectedBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.green[50], borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.green[100] },

  // Forms
  fieldLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray[500], marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: Colors.gray[50], borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.gray[900] },
  charCount: { fontSize: 10, color: Colors.gray[400], textAlign: 'right', marginTop: 2 },
  segmentRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.gray[200], alignItems: 'center' },
  segmentActive: { borderColor: Colors.purple[600], backgroundColor: Colors.purple[50] },
  segmentText: { fontSize: 12, fontWeight: '600', color: Colors.gray[500] },
  segmentTextActive: { color: Colors.purple[700] },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  switchLabel: { fontSize: 13, color: Colors.gray[700] },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: Colors.gray[200], backgroundColor: '#fff' },
  chipActive: { borderColor: Colors.purple[600], backgroundColor: Colors.purple[50] },
  chipText: { fontSize: 11, fontWeight: '600', color: Colors.gray[500] },
  chipTextActive: { color: Colors.purple[700] },

  // Images
  cardThumb: { width: '100%', aspectRatio: 2.5 / 3.5, borderRadius: 8, borderWidth: 1, borderColor: Colors.gray[200] },
  imageToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  imageLabel: { fontSize: 11, color: Colors.gray[600] },

  imageGenStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: Colors.purple[50], borderRadius: 8, borderWidth: 1, borderColor: Colors.purple[200] },
  imageGenStatusText: { fontSize: 11, color: Colors.purple[700], flex: 1 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  imageTile: { width: '31%', borderRadius: 8, borderWidth: 2, borderColor: Colors.gray[200], backgroundColor: '#fff', overflow: 'hidden', position: 'relative' },
  imageTileSelected: { borderColor: Colors.purple[600] },
  imageTileThumb: { width: '100%', aspectRatio: 0.75, backgroundColor: Colors.gray[100] },
  imageTileFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: Colors.gray[50] },
  imageTileLabel: { fontSize: 9, fontWeight: '600', color: Colors.gray[700], flex: 1 },
  mainBadge: { position: 'absolute', top: 2, left: 2, backgroundColor: Colors.purple[600], paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, zIndex: 10 },
  mainBadgeText: { color: '#fff', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  reorderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 3, backgroundColor: Colors.purple[50], borderTopWidth: 1, borderTopColor: Colors.gray[200] },
  reorderBtn: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.purple[200] },
  reorderBtnDisabled: { borderColor: Colors.gray[200], backgroundColor: Colors.gray[50] },
  positionText: { fontSize: 10, fontWeight: '700', color: Colors.purple[700] },
  removeImageBtn: { position: 'absolute', top: 2, right: 2, backgroundColor: '#fff', borderRadius: 10 },
  addPhotoTile: { width: '31%', aspectRatio: 0.75, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.gray[300], backgroundColor: Colors.gray[50], alignItems: 'center', justifyContent: 'center', gap: 4 },
  addPhotoText: { fontSize: 10, color: Colors.gray[500], fontWeight: '600' },
  imageHint: { fontSize: 10, color: Colors.gray[500], marginTop: 8 },
  hiddenWebViewWrapper: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden', top: -10000, left: -10000 },
  previewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: Colors.purple[200], backgroundColor: Colors.purple[50] },
  previewBtnText: { fontSize: 11, fontWeight: '600', color: Colors.purple[700] },
  helperText: { fontSize: 10, color: Colors.gray[500], marginTop: 2, marginBottom: 6 },
  lockedText: { fontSize: 9, fontStyle: 'italic', color: Colors.gray[400] },
  descriptionPreviewBox: { borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff' },

  // Review
  reviewBox: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  reviewLabel: { fontSize: 12, color: Colors.gray[500], fontWeight: '600' },
  reviewValue: { fontSize: 12, color: Colors.gray[800], fontWeight: '500', flex: 1, textAlign: 'right' },

  // Warning banner (previous listing)
  warnBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: Colors.amber[50], borderRadius: 8, borderWidth: 1, borderColor: Colors.amber[100], marginBottom: 12 },
  warnBannerText: { fontSize: 11, color: Colors.amber[600], flex: 1 },

  // Disclaimer gate
  disclaimerScroll: { maxHeight: 300, backgroundColor: Colors.gray[50], borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 8, padding: 12 },
  disclaimerIntro: { fontSize: 12, fontWeight: '700', color: Colors.gray[900], marginBottom: 10 },
  disclaimerHeading: { fontSize: 11, fontWeight: '700', color: Colors.gray[900], marginBottom: 2 },
  disclaimerBody: { fontSize: 11, color: Colors.gray[700], lineHeight: 16 },
  disclaimerVersion: { fontSize: 9, color: Colors.gray[500], marginTop: 4, marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.gray[200] },
  disclaimerCheckRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 },
  disclaimerCheckText: { fontSize: 12, color: Colors.gray[700], flex: 1, lineHeight: 17 },

  // Buttons
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.purple[600], borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24 },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Navigation
  navBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.gray[200], backgroundColor: '#fff' },
  navBtnBack: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: Colors.gray[300] },
  navBtnBackText: { fontSize: 14, fontWeight: '600', color: Colors.gray[600] },
  navBtnNext: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: Colors.purple[600] },
  navBtnNextText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  navBtnDisabled: { opacity: 0.4 },

  // OAuth
  oauthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.gray[200] },
  oauthTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray[800] },
})
