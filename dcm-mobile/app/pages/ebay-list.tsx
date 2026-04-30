import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Switch, Modal, Linking, Image,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { WebView } from 'react-native-webview'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Colors } from '@/lib/constants'
import {
  checkEbayStatus, checkExistingListing, uploadImages, createListing,
  getAspects, checkDisclaimer, acceptDisclaimer, getOAuthUrl,
  generateTitle, CATEGORY_MAP, SHIPPING_SERVICES, DURATION_OPTIONS,
  type EbayConnectionStatus, type CreateListingRequest,
} from '@/lib/ebayApi'

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

  // eBay state
  const [ebayStatus, setEbayStatus] = useState<EbayConnectionStatus | null>(null)
  const [step, setStep] = useState<Step>('connect')
  const [showOAuth, setShowOAuth] = useState(false)
  const [oauthUrl, setOauthUrl] = useState('')

  // Step 1: Images
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [selectedImages, setSelectedImages] = useState({ front: true, back: true, miniReport: true, rawFront: true, rawBack: true })
  const [imagesReady, setImagesReady] = useState(false)

  // Step 2: Details
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [listingFormat, setListingFormat] = useState<'FIXED_PRICE' | 'AUCTION'>('FIXED_PRICE')
  const [bestOfferEnabled, setBestOfferEnabled] = useState(true)
  const [duration, setDuration] = useState('GTC')

  // Step 3: Specifics
  const [itemSpecifics, setItemSpecifics] = useState<{ name: string; value: string }[]>([])

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

  // ─── Load card data ───
  useEffect(() => {
    if (!cardId) { setIsLoading(false); return }
    (async () => {
      const { data } = await supabase.from('cards').select('*').eq('id', cardId).single()
      if (data) {
        setCard(data)
        setTitle(generateTitle(data))
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

  // ─── OAuth completion handler ───
  const handleOAuthComplete = useCallback(() => {
    setShowOAuth(false)
    checkEbayStatus().then(status => {
      setEbayStatus(status)
      if (status.connected) setImagesReady(true) // Mark ready to proceed
    })
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
    setIsPublishing(true)
    setStep('publishing')

    try {
      // 1. Upload images
      const imagesToUpload: Record<string, string> = {}
      if (selectedImages.front && frontUrl) imagesToUpload.front = frontUrl
      if (selectedImages.back && backUrl) imagesToUpload.back = backUrl

      const uploadResult = await uploadImages(cardId, imagesToUpload)
      const allImageUrls = Object.values(uploadResult.urls).flat().filter(Boolean) as string[]

      if (allImageUrls.length === 0) throw new Error('No images to upload')

      // 2. Create listing
      const categoryId = CATEGORY_MAP[card.category] || '183050'
      const grade = card.conversational_whole_grade

      const listingData: CreateListingRequest = {
        cardId,
        grade,
        title,
        price: parseFloat(price) || 0,
        listingFormat,
        bestOfferEnabled: listingFormat === 'FIXED_PRICE' ? bestOfferEnabled : false,
        duration,
        imageUrls: allImageUrls,
        itemSpecifics: itemSpecifics.filter(s => s.value.trim()).map(s => ({ name: s.name, value: s.value })),
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
      }

      const result = await createListing(listingData)

      if (result.success) {
        setListingResult(result)
        setStep('success')
      } else {
        throw new Error(result.error || result.userAction || 'Listing failed')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create listing')
      setStep('error')
    } finally {
      setIsPublishing(false)
    }
  }, [card, cardId, title, price, listingFormat, bestOfferEnabled, duration, selectedImages, frontUrl, backUrl, itemSpecifics, shipping])

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

  const grade = card.conversational_whole_grade
  const ci = card.conversational_card_info || {}

  return (
    <View style={st.container}>
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
                const url = navState.url
                // Only react to the FINAL success page, not the intermediate /api/ebay/callback hop —
                // the server needs that hop to exchange the code for tokens and save the connection
                // before redirecting to /ebay-auth-success?ebay_connected=true.
                if (url.includes('/ebay-auth-success')) {
                  if (url.includes('ebay_error=') || url.includes('ebay_connected=false')) {
                    setShowOAuth(false)
                    const params = new URL(url).searchParams
                    const message = params.get('message') || 'eBay connection failed.'
                    Alert.alert('eBay Connection Failed', message)
                  } else {
                    handleOAuthComplete()
                  }
                  return
                }
                // User denied at the eBay consent screen
                if (url.includes('error=access_denied')) {
                  setShowOAuth(false)
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

            {/* Card preview */}
            {ebayStatus?.connected && (
              <View style={{ marginTop: 16 }}>
                <Text style={st.sectionTitle}>Card Images</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {frontUrl && (
                    <View style={{ flex: 1 }}>
                      <Image source={{ uri: frontUrl }} style={st.cardThumb} resizeMode="contain" />
                      <View style={st.imageToggle}>
                        <Switch value={selectedImages.front} onValueChange={v => setSelectedImages(p => ({ ...p, front: v }))} />
                        <Text style={st.imageLabel}>Front</Text>
                      </View>
                    </View>
                  )}
                  {backUrl && (
                    <View style={{ flex: 1 }}>
                      <Image source={{ uri: backUrl }} style={st.cardThumb} resizeMode="contain" />
                      <View style={st.imageToggle}>
                        <Switch value={selectedImages.back} onValueChange={v => setSelectedImages(p => ({ ...p, back: v }))} />
                        <Text style={st.imageLabel}>Back</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}
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
                <TouchableOpacity key={f} style={[st.segment, listingFormat === f && st.segmentActive]} onPress={() => setListingFormat(f)}>
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
                {DURATION_OPTIONS.map(d => (
                  <TouchableOpacity key={d.value} style={[st.chip, duration === d.value && st.chipActive]} onPress={() => setDuration(d.value)}>
                    <Text style={[st.chipText, duration === d.value && st.chipTextActive]}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ═══ STEP 3: Item Specifics ═══ */}
        {step === 'specifics' && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>Item Specifics</Text>
            <Text style={{ fontSize: 11, color: Colors.gray[500], marginBottom: 12 }}>Pre-filled from your card data. Edit as needed.</Text>
            {itemSpecifics.length === 0 && (
              <Text style={{ fontSize: 12, color: Colors.gray[400], textAlign: 'center', paddingVertical: 20 }}>
                Item specifics will be auto-filled based on your card's category and details.
              </Text>
            )}
            {itemSpecifics.map((spec, i) => (
              <View key={i} style={{ marginBottom: 8 }}>
                <Text style={st.fieldLabel}>{spec.name}</Text>
                <TextInput
                  style={st.input}
                  value={spec.value}
                  onChangeText={v => {
                    const updated = [...itemSpecifics]
                    updated[i] = { ...updated[i], value: v }
                    setItemSpecifics(updated)
                  }}
                />
              </View>
            ))}
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

            <Text style={st.fieldLabel}>Postal Code</Text>
            <TextInput style={st.input} value={shipping.postalCode} onChangeText={v => setShipping(p => ({ ...p, postalCode: v }))} keyboardType="number-pad" maxLength={5} placeholder="12345" placeholderTextColor={Colors.gray[400]} />

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
              <Text style={st.reviewValue}>{DURATION_OPTIONS.find(d => d.value === duration)?.label || duration}</Text>
            </View>
            <View style={st.reviewBox}>
              <Text style={st.reviewLabel}>Shipping</Text>
              <Text style={st.reviewValue}>{shipping.shippingType === 'FREE' ? 'Free Shipping' : shipping.shippingType === 'FLAT_RATE' ? `Flat Rate $${shipping.flatRate}` : 'Calculated'}</Text>
            </View>
            <View style={st.reviewBox}>
              <Text style={st.reviewLabel}>Images</Text>
              <Text style={st.reviewValue}>{Object.values(selectedImages).filter(Boolean).length} selected</Text>
            </View>

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
          </View>
        )}

        {/* ═══ Publishing ═══ */}
        {step === 'publishing' && (
          <View style={[st.section, { alignItems: 'center', paddingVertical: 40 }]}>
            <ActivityIndicator size="large" color={Colors.purple[600]} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.gray[800], marginTop: 16 }}>Creating Your Listing...</Text>
            <Text style={{ fontSize: 12, color: Colors.gray[500], marginTop: 4 }}>Uploading images and publishing to eBay</Text>
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
            <TouchableOpacity style={[st.primaryBtn, { marginTop: 16 }]} onPress={() => setStep('review')}>
              <Text style={st.primaryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom navigation bar */}
      {!['publishing', 'success', 'error'].includes(step) && (
        <View style={st.navBar}>
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

  // Review
  reviewBox: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  reviewLabel: { fontSize: 12, color: Colors.gray[500], fontWeight: '600' },
  reviewValue: { fontSize: 12, color: Colors.gray[800], fontWeight: '500', flex: 1, textAlign: 'right' },

  // Buttons
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.purple[600], borderRadius: 10, paddingVertical: 14 },
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
