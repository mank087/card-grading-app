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
  SHIPPING_SERVICES,
  DEFAULT_SHIPPING_SERVICE,
  getListingDefaults, saveListingDefaults, resolveActiveListingDefaults, normalizeShippingService,
  FIXED_PRICE_DURATION_OPTIONS, AUCTION_DURATION_OPTIONS, ALL_DURATION_OPTIONS,
  type EbayConnectionStatus, type CreateListingRequest, type ImageUploadResult,
} from '@/lib/ebayApi'
import { buildEbayTitleFromCard } from '@/lib/ebayTitleBuilder'
import { findBlockedGrader } from '@/lib/ebayGradingCompanyBlocklist'
import { classifyEbayOAuthNavigation } from '@/lib/ebayOAuth'
import {
  DISCLAIMER_SECTIONS, DISCLAIMER_VERSION_LINE, DISCLAIMER_INTRO, DISCLAIMER_CONSENT,
} from '@/lib/ebayDisclaimer'
import { resolveCardValue } from '@/lib/resolveCardValue'

import MobileTabBar from '@/components/MobileTabBar'
import AppHeaderBar from '@/components/AppHeaderBar'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'

type Step = 'connect' | 'details' | 'specifics' | 'shipping' | 'review' | 'publishing' | 'success' | 'error'

/**
 * Columns this screen actually reads: the title/description field resolver
 * (lib/ebayListingFields.ts), the price resolver, the org guard and the two
 * image paths. Mirrors the web's DRAFT_CARD_COLUMNS in src/lib/ebay/
 * bulkService.ts — and, like it, deliberately excludes every heavy blob
 * (ai_grading, conversational_corners_edges_surface, …). `select('*')` used to
 * drag hundreds of KB of grading JSON over the wire for four title tokens.
 */
const LISTING_CARD_COLUMNS = [
  'id', 'user_id', 'card_name', 'category', 'sub_category', 'serial',
  'front_path', 'back_path', 'org_id', 'org_serial_display',
  'conversational_whole_grade', 'conversational_decimal_grade',
  'conversational_condition_label', 'conversational_card_info',
  'conversational_sub_scores', 'conversational_weighted_sub_scores',
  'conversational_final_grade_summary', 'dvg_whole_grade', 'dvg_decimal_grade',
  'dcm_price_estimate', 'dcm_cached_prices', 'ebay_price_median',
  'scryfall_price_usd', 'scryfall_price_usd_foil',
  'featured', 'pokemon_featured', 'card_set', 'card_number', 'release_date',
  'serial_numbering', 'rarity_tier', 'rarity_description', 'autographed',
  'autograph_type', 'memorabilia_type', 'rookie_card', 'first_print_rookie',
  'holofoil', 'is_foil', 'foil_type', 'is_double_faced', 'mtg_rarity',
  'is_enchanted', 'manufacturer', 'custom_label_data',
].join(',')

/** Height of the (script-free, self-scrolling) description preview box. */
const DESCRIPTION_PREVIEW_HEIGHT = 420

/** One eBay item specific. `required` is eBay's own aspect constraint. */
type ItemSpecific = { name: string; value: string | string[]; required?: boolean; editable?: boolean }

/**
 * Coerce whatever the prep-page bridge sent into ItemSpecific rows. The prep
 * page is a separate deployment: a build may add fields (eBay's `required`
 * aspect constraint), send them in a different shape, or send none at all, and
 * none of that may crash the wizard.
 */
function normalizeItemSpecifics(raw: unknown): ItemSpecific[] {
  if (!Array.isArray(raw)) return []
  const out: ItemSpecific[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const name = typeof (entry as any).name === 'string' ? (entry as any).name.trim() : ''
    if (!name) continue
    const rawValue = (entry as any).value
    const value: string | string[] = Array.isArray(rawValue)
      ? rawValue.filter((v: unknown) => typeof v === 'string')
      : typeof rawValue === 'string'
        ? rawValue
        : rawValue === null || rawValue === undefined
          ? ''
          : String(rawValue)
    out.push({
      name,
      value,
      required: (entry as any).required === true,
      // Only an explicit false locks a row — an older page omits the flag.
      editable: (entry as any).editable !== false,
    })
  }
  return out
}

/** Required specifics eBay still needs a value for. Web twin: EbayListingModal's `missingRequired`. */
function missingRequiredSpecifics(specs: ItemSpecific[]): ItemSpecific[] {
  return specs.filter(s =>
    s.required && (Array.isArray(s.value) ? s.value.length === 0 : !(s.value || '').trim())
  )
}

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

// eBay listing Terms & Conditions live in lib/ebayDisclaimer.ts — the bulk
// screen shows the identical gate, and two copies of the same eight legal
// paragraphs is how they drift apart.

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
  // User-uploaded additional images from device gallery. Only the file URI is
  // held in state — base64 is read per-image at upload time (see
  // readAdditionalImageAsDataUrl) so all photos are never in memory at once.
  const [additionalImages, setAdditionalImages] = useState<Array<{ id: string; uri: string; mimeType?: string; selected: boolean }>>([])
  // Ordered list of image references — the user reorders this; first selected becomes main image
  type OrderedImageItem = { kind: 'system'; key: 'front'|'back'|'miniReport'|'rawFront'|'rawBack' } | { kind: 'custom'; id: string }
  const [imageOrder, setImageOrder] = useState<OrderedImageItem[]>([])

  // Step 2: Details
  const [title, setTitle] = useState('')
  // The last title THIS screen generated. A generated title may be replaced by
  // a better one (the enterprise grade label, or the prep page's own build);
  // a title the seller typed never is. Comparing against this ref is how we
  // tell the two apart — web parity with EbayListingModal's defaultTitle check.
  const autoTitleRef = useRef('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [listingFormat, setListingFormat] = useState<'FIXED_PRICE' | 'AUCTION'>('FIXED_PRICE')
  const [bestOfferEnabled, setBestOfferEnabled] = useState(true)
  const [duration, setDuration] = useState('GTC')
  // Default to rendered preview — matches the web's UX
  const [showDescriptionPreview, setShowDescriptionPreview] = useState(true)
  // Fixed height: the preview WebView runs with JavaScript disabled (see the
  // render below), so it can no longer measure and report its own content.

  // Step 3: Specifics
  const [itemSpecifics, setItemSpecifics] = useState<ItemSpecific[]>([])

  // Certificate of Analysis (uploaded to eBay as a regulatory document by the prep WebView)
  const [regulatoryDocumentId, setRegulatoryDocumentId] = useState<string | null>(null)

  // Step 4: Shipping
  const [shipping, setShipping] = useState({
    shippingType: 'CALCULATED' as 'FREE' | 'FLAT_RATE' | 'CALCULATED',
    domesticService: DEFAULT_SHIPPING_SERVICE,
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

  // "Save as my defaults" (web parity: EbayListingModal's saveListingDefaults).
  // savedShippingBlob is the PERSONAL saved blob as last read or written — it
  // both carries forward the web-only keys mobile has no field for and backs
  // the review step's "Saved as default" line.
  const [savedShippingBlob, setSavedShippingBlob] = useState<Record<string, unknown> | null>(null)
  const [savingDefaults, setSavingDefaults] = useState(false)
  const [defaultsSavedFlash, setDefaultsSavedFlash] = useState(false)
  // Timer behind the 4s "Saved" flash. Held in a ref so it can be cancelled if
  // the screen unmounts (or the seller saves twice) — a setState against an
  // unmounted screen is a leak and, on a fast second save, the first timer
  // would clear the second flash early.
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current)
  }, [])

  // Seller opted into eBay business policies (PERSONAL row only — a policy
  // belongs to one eBay account and connections are per user, so an org row's
  // ids are meaningless here; resolveActiveListingDefaults strips them). When
  // on, eBay refuses inline shipping/returns alongside the policies, so this
  // screen collapses the shipping step to the two things a policy can't carry:
  // the ship-from ZIP and the package size. The server applies the saved policy
  // ids itself (publishCardListing's policyPrefs branch), so mobile sends no
  // `policies` — it has no picker for them.
  const [useBusinessPolicies, setUseBusinessPolicies] = useState(false)

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
  // Set when the last publish failure is one the seller fixes back on the
  // Details step — the server's 400s for a blocked grading company in the
  // title, a link/URL in the title, or a link/URL in the description. All
  // three used to dead-end on the error screen with only "Try Again", which
  // retries the exact payload that just failed. Carries the CTA label so the
  // button names the field to go and fix.
  const [errorEditTarget, setErrorEditTarget] = useState<{ label: string; step: Step } | null>(null)
  // Set when the Reconnect CTA opens the OAuth modal so a successful
  // reconnect returns the user straight to the review step.
  const returnToReviewAfterOAuth = useRef(false)
  // Cache of eBay-hosted URLs from a successful upload pass, keyed by a
  // signature of the image selection — lets a retry after a publish failure
  // (e.g. expired token) skip re-generating/re-uploading unchanged images.
  const uploadCacheRef = useRef<{ signature: string; urls: ImageUploadResult['urls'] } | null>(null)
  // Buffer for the chunked prep-bridge protocol (v2): the prep WebView posts
  // one 'ebay-prep-image' message per image, then 'ebay-prep-complete' with
  // the metadata. Buffered here until the completion message arrives. The
  // legacy protocol (one giant 'images-ready' message) is still handled — a
  // new app binary can hit an old cached prep page.
  const chunkedImagesRef = useRef<Record<string, string>>({})

  // Watchdog for the hidden prep WebView. It can load and then never post
  // anything back (a wedged canvas, a page that threw before the bridge, a
  // dead network mid-render), and the wizard sat on "Generating images…"
  // forever with no way out. 90s is well past the slowest real run.
  const PREP_TIMEOUT_MS = 90_000
  const prepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Bumped by the Retry button: a new key remounts the hidden WebView, which
  // re-runs the prep page from scratch (onLoadStart re-arms the watchdog).
  const [prepAttempt, setPrepAttempt] = useState(0)
  const clearPrepTimeout = useCallback(() => {
    if (prepTimeoutRef.current) {
      clearTimeout(prepTimeoutRef.current)
      prepTimeoutRef.current = null
    }
  }, [])
  // Unmount: never leave the timer running against a gone screen.
  useEffect(() => clearPrepTimeout, [clearPrepTimeout])

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
      // Narrow column list (see LISTING_CARD_COLUMNS). A deployment where the
      // app ships ahead of the schema would 42703 on an unknown column — fall
      // back to the old wide select rather than showing "Card not found".
      // (Typed as any: the column list is a joined constant, so supabase-js
      // can't infer a row shape from it.)
      const narrow = await supabase.from('cards').select(LISTING_CARD_COLUMNS).eq('id', cardId).single()
      let data: any = narrow.data
      if (narrow.error && (narrow.error as any).code === '42703') {
        console.warn('[ebay-list] narrow column list rejected, falling back:', narrow.error.message)
        const wide = await supabase.from('cards').select('*').eq('id', cardId).single()
        data = wide.data
      }
      if (data) {
        setCard(data)
        const generated = buildEbayTitleFromCard(data)
        autoTitleRef.current = generated
        setTitle(generated)
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

  // ─── Saved listing defaults ───
  // Web parity with EbayListingModal: GET /api/ebay/listing-defaults and merge
  // the saved shipping blob (+ bestOfferEnabled) over the hardcoded defaults.
  // Saved values win where present and valid; anything missing/invalid falls
  // back to the stock default. Waits for the card so the cross-org guard can
  // compare the caller's org against the CARD's org.
  //
  // The saved blob uses the WEB modal's field names/types (numbers, camelCase
  // shipping keys); mobile's `shipping` state is all strings with shorter
  // names — hence the explicit mapping below rather than a spread.
  //
  // The saved descriptionTemplate is NOT applied here: mobile's description is
  // generated by the hidden /ebay-image-prep WebView, which now applies the
  // template itself (src/app/ebay-image-prep/[cardId]/page.tsx).
  useEffect(() => {
    if (!session || !card) return
    let stale = false
    getListingDefaults().then(defaults => {
      if (stale) return
      const active = resolveActiveListingDefaults(defaults, card.org_id)

      // Enterprise grade label for the title tail ("… Kings Kards 9"). Only
      // re-render the title while it is still the generated one — never
      // clobber a title the seller has edited.
      if (active?.titleGradeLabel) {
        const relabelled = buildEbayTitleFromCard(card, active.titleGradeLabel)
        setTitle(prev => {
          if (prev !== autoTitleRef.current) return prev
          autoTitleRef.current = relabelled
          return relabelled
        })
      }

      // Remember the PERSONAL blob (never the org one — mobile only ever
      // writes personal) so a save can carry forward the keys mobile has no
      // field for, and the review step can tell "this is already my default".
      const personalSaved = defaults?.personal?.shippingDefaults
      setSavedShippingBlob(personalSaved && typeof personalSaved === 'object' ? personalSaved : null)

      // Business policies: PERSONAL row only, never the org row — see the state
      // declaration. `active` is deliberately not consulted here.
      setUseBusinessPolicies(defaults?.personal?.useBusinessPolicies === true)

      const saved = active?.shippingDefaults
      if (!saved || typeof saved !== 'object') return

      const num = (v: unknown): string | undefined =>
        typeof v === 'number' && Number.isFinite(v) ? String(v) : undefined
      const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined)
      const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
        typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined

      if (typeof saved.bestOfferEnabled === 'boolean') setBestOfferEnabled(saved.bestOfferEnabled)

      setShipping(prev => {
        const next = { ...prev }
        const shippingType = oneOf(saved.shippingType, ['FREE', 'FLAT_RATE', 'CALCULATED'] as const)
        if (shippingType) next.shippingType = shippingType
        if (typeof saved.domesticShippingService === 'string') {
          // Retired/unknown tokens map forward so a service chip stays selected.
          next.domesticService = normalizeShippingService(saved.domesticShippingService)
        }
        const flatRate = num(saved.flatRateAmount)
        if (flatRate !== undefined) next.flatRate = flatRate
        const handlingDays = num(saved.handlingDays)
        if (handlingDays !== undefined) next.handlingDays = handlingDays
        // Never clobber a postal code the user already typed — this fetch can
        // resolve after they've reached the shipping step.
        if (typeof saved.postalCode === 'string' && saved.postalCode.trim() && !prev.postalCode) {
          next.postalCode = saved.postalCode.replace(/[^0-9]/g, '')
        }
        const weightOz = num(saved.packageWeightOz)
        if (weightOz !== undefined) next.weightOz = weightOz
        const lengthIn = num(saved.packageLengthIn)
        if (lengthIn !== undefined) next.lengthIn = lengthIn
        const widthIn = num(saved.packageWidthIn)
        if (widthIn !== undefined) next.widthIn = widthIn
        const depthIn = num(saved.packageDepthIn)
        if (depthIn !== undefined) next.depthIn = depthIn
        const offerIntl = bool(saved.offerInternational)
        if (offerIntl !== undefined) next.offerInternational = offerIntl
        // Validated server-side against INTERNATIONAL_SHIPPING_SERVICES on save.
        if (typeof saved.internationalShippingService === 'string' && saved.internationalShippingService) {
          next.intlService = saved.internationalShippingService
        }
        const intlFlat = num(saved.internationalFlatRateCost)
        if (intlFlat !== undefined) next.intlFlatRate = intlFlat
        const returns = bool(saved.domesticReturnsAccepted)
        if (returns !== undefined) next.returnsAccepted = returns
        const returnPeriod = num(saved.domesticReturnPeriodDays)
        if (returnPeriod !== undefined) next.returnPeriod = returnPeriod
        const paidBy = oneOf(saved.domesticReturnShippingPaidBy, ['BUYER', 'SELLER'] as const)
        if (paidBy) next.returnShipping = paidBy
        return next
      })
    })
    return () => { stale = true }
    // card.org_id is the only card field read; keying on the whole card object
    // is fine — it's set once per screen load.
  }, [session, card])

  // ─── Save as my defaults ───
  // The blob written back uses the WEB modal's key names and types (the server's
  // SHIPPING_VALIDATORS), so the same row round-trips between platforms. Mobile's
  // form is all strings with shorter names, hence the explicit mapping — the
  // mirror image of the load-merge above, and the same mapping the publish
  // payload does. Keys mobile has no field for (international shipping type,
  // ship-to locations, international returns) are carried forward from the saved
  // blob rather than dropped: a PUT REPLACES shipping_defaults, so anything not
  // sent would silently erase what the seller set on the web.
  const shippingDefaultsPayload = useMemo(() => {
    // Package size + ship-from ZIP are the only fields the policies layout
    // still shows, so they are the only ones it may overwrite. Everything else
    // falls into `carriedForward` below and survives the PUT untouched —
    // saving from the collapsed step must not erase the rate/returns defaults
    // this seller set on the web before turning policies on.
    const alwaysManaged: Record<string, unknown> = {
      postalCode: shipping.postalCode,
      packageWeightOz: parseInt(shipping.weightOz) || 4,
      packageLengthIn: parseInt(shipping.lengthIn) || 10,
      packageWidthIn: parseInt(shipping.widthIn) || 6,
      packageDepthIn: parseInt(shipping.depthIn) || 1,
    }
    const managed: Record<string, unknown> = useBusinessPolicies
      ? alwaysManaged
      : {
          shippingType: shipping.shippingType,
          domesticShippingService: shipping.domesticService,
          flatRateAmount: parseFloat(shipping.flatRate) || 5,
          handlingDays: parseInt(shipping.handlingDays) || 1,
          ...alwaysManaged,
          offerInternational: shipping.offerInternational,
          internationalShippingService: shipping.intlService,
          internationalFlatRateCost: parseFloat(shipping.intlFlatRate) || 15,
          domesticReturnsAccepted: shipping.returnsAccepted,
          domesticReturnPeriodDays: parseInt(shipping.returnPeriod) || 30,
          domesticReturnShippingPaidBy: shipping.returnShipping,
          bestOfferEnabled,
        }
    const carriedForward: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(savedShippingBlob || {})) {
      if (!(k in managed)) carriedForward[k] = v
    }
    return { managed, blob: { ...carriedForward, ...managed } }
  }, [shipping, bestOfferEnabled, savedShippingBlob, useBusinessPolicies])

  /**
   * International keys the saved blob may hold that mobile has no field for.
   * The web modal sets them; mobile only carries them forward on a SAVE (see
   * shippingDefaultsPayload) and, until now, dropped them at publish — so a
   * seller who configured "flat-rate international to Canada/UK, 30-day
   * international returns paid by the buyer" on the web got eBay's stock
   * calculated-worldwide/no-returns terms whenever they listed from the phone.
   *
   * Only the keys the server's CreateListingRequest actually accepts are
   * lifted (src/lib/ebay/publishCardListing.ts), each validated to the shape
   * that type declares — the blob is free-form JSON and a bad value would
   * reach eBay's XML. Mobile's own fields (offerInternational, the service and
   * the flat-rate cost) are NOT in here: those have UI, so they stay
   * authoritative and this spread can never overwrite them.
   */
  const carriedForwardIntl = useMemo(() => {
    const blob = savedShippingBlob
    if (!blob) return null
    const out: {
      internationalShippingType?: 'FLAT_RATE' | 'CALCULATED'
      internationalShipToLocations?: string[]
      internationalReturnsAccepted?: boolean
      internationalReturnPeriodDays?: number
      internationalReturnShippingPaidBy?: 'BUYER' | 'SELLER'
    } = {}
    if (blob.internationalShippingType === 'FLAT_RATE' || blob.internationalShippingType === 'CALCULATED') {
      out.internationalShippingType = blob.internationalShippingType
    }
    if (Array.isArray(blob.internationalShipToLocations)) {
      const locations = blob.internationalShipToLocations.filter(
        (l: unknown): l is string => typeof l === 'string' && l.trim().length > 0
      )
      if (locations.length > 0) out.internationalShipToLocations = locations
    }
    if (typeof blob.internationalReturnsAccepted === 'boolean') {
      out.internationalReturnsAccepted = blob.internationalReturnsAccepted
    }
    if (typeof blob.internationalReturnPeriodDays === 'number' && Number.isFinite(blob.internationalReturnPeriodDays)) {
      out.internationalReturnPeriodDays = blob.internationalReturnPeriodDays
    }
    if (blob.internationalReturnShippingPaidBy === 'BUYER' || blob.internationalReturnShippingPaidBy === 'SELLER') {
      out.internationalReturnShippingPaidBy = blob.internationalReturnShippingPaidBy
    }
    return Object.keys(out).length > 0 ? out : null
  }, [savedShippingBlob])

  /**
   * One line naming the carried-forward international terms, so the review step
   * shows what will actually be sent rather than leaving the seller to assume
   * mobile's visible fields are the whole story.
   */
  const carriedForwardIntlSummary = useMemo(() => {
    if (!carriedForwardIntl) return null
    const parts: string[] = []
    if (carriedForwardIntl.internationalShipToLocations) {
      parts.push(`Ships to ${carriedForwardIntl.internationalShipToLocations.join(', ')}`)
    }
    if (carriedForwardIntl.internationalShippingType) {
      parts.push(carriedForwardIntl.internationalShippingType === 'FLAT_RATE' ? 'flat rate' : 'calculated')
    }
    if (carriedForwardIntl.internationalReturnsAccepted === true) {
      const days = carriedForwardIntl.internationalReturnPeriodDays ?? 30
      const paidBy = carriedForwardIntl.internationalReturnShippingPaidBy === 'SELLER' ? 'seller' : 'buyer'
      parts.push(`${days}-day international returns, ${paidBy} pays return shipping`)
    } else if (carriedForwardIntl.internationalReturnsAccepted === false) {
      parts.push('no international returns')
    }
    if (parts.length === 0) return null
    return `From your saved web defaults: ${parts.join(' · ')}`
  }, [carriedForwardIntl])

  // Review-step indicator: true when every field this screen owns already
  // matches the saved blob (the carried-forward keys are equal by construction).
  const shippingMatchesSavedDefaults = useMemo(() => {
    if (!savedShippingBlob) return false
    return Object.entries(shippingDefaultsPayload.managed).every(
      ([k, v]) => savedShippingBlob[k] === v
    )
  }, [savedShippingBlob, shippingDefaultsPayload])

  const handleSaveShippingDefaults = useCallback(async () => {
    setSavingDefaults(true)
    const blob = shippingDefaultsPayload.blob
    const result = await saveListingDefaults({ shippingDefaults: blob })
    setSavingDefaults(false)
    if (result.ok) {
      setSavedShippingBlob(blob)
      setDefaultsSavedFlash(true)
      if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current)
      savedFlashTimerRef.current = setTimeout(() => {
        savedFlashTimerRef.current = null
        setDefaultsSavedFlash(false)
      }, 4000)
    } else {
      Alert.alert('Could not save defaults', result.message)
    }
  }, [shippingDefaultsPayload])

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

  // ─── Prep WebView completion ───
  // Shared by both bridge protocols: applies the generated images + metadata
  // (description, item specifics, CoA document id) once everything arrived.
  // Every field except the images is read DEFENSIVELY: an older cached prep
  // page sends only { description, itemSpecifics, regulatoryDocumentId }, a
  // newer one may also send `title` and specifics carrying eBay's `required`
  // flag. Anything missing falls back to what this screen already computed.
  const applyPrepResult = useCallback((
    images: Record<string, string>,
    meta: {
      description?: string
      title?: string
      itemSpecifics?: unknown
      regulatoryDocumentId?: string | null
    },
  ) => {
    clearPrepTimeout()
    setImageUrls(images)
    setImagesReady(true)
    setImagesGenerating(false)
    if (meta.description) setDescription(prev => prev || meta.description!)

    // The prep page builds its title from the same twin algorithm plus the
    // seller's saved grade label, so prefer it — but only while the field is
    // still exactly what we generated. A seller's own edit always wins.
    if (typeof meta.title === 'string' && meta.title.trim()) {
      // By CODE POINT: slicing a UTF-16 string at 80 can split a surrogate
      // pair (an emoji, some CJK) and leave half a character in the title.
      const prepTitle = Array.from(meta.title.trim()).slice(0, 80).join('')
      setTitle(prev => {
        if (prev !== autoTitleRef.current) return prev
        autoTitleRef.current = prepTitle
        return prepTitle
      })
    }

    // Specifics: normalize whatever arrived, then MERGE rather than replace —
    // a required row that arrives after the seller has typed into the step must
    // not wipe their edits, and rows they filled must survive.
    const incoming = normalizeItemSpecifics(meta.itemSpecifics)
    if (incoming.length > 0) {
      setItemSpecifics(prev => {
        if (prev.length === 0) return incoming
        const byName = new Map(prev.map(s => [s.name.toLowerCase(), s] as const))
        const merged = prev.map(s => {
          const match = incoming.find(i => i.name.toLowerCase() === s.name.toLowerCase())
          if (!match) return s
          // Keep the seller's value; adopt the newer required/editable metadata.
          // An EMPTY existing value is not an edit worth protecting, though —
          // a blank row the prep page can now fill (Parallel/Variety, Season)
          // used to stay blank forever because the merge always won.
          const existingIsEmpty = Array.isArray(s.value)
            ? s.value.filter(v => typeof v === 'string' && v.trim()).length === 0
            : !(typeof s.value === 'string' && s.value.trim())
          const incomingHasValue = Array.isArray(match.value)
            ? match.value.filter(v => typeof v === 'string' && v.trim()).length > 0
            : !!(typeof match.value === 'string' && match.value.trim())
          return {
            ...s,
            value: existingIsEmpty && incomingHasValue ? match.value : s.value,
            required: match.required ?? s.required,
            editable: match.editable ?? s.editable,
          }
        })
        for (const spec of incoming) {
          if (!byName.has(spec.name.toLowerCase())) merged.push(spec)
        }
        return merged
      })
    }

    if (meta.regulatoryDocumentId) setRegulatoryDocumentId(meta.regulatoryDocumentId)
  }, [clearPrepTimeout])

  // ─── Image order helpers ───
  // Initialize order once system images are ready
  useEffect(() => {
    if (imagesReady && imageOrder.length === 0) {
      // Default gallery order — labelled front first (it becomes eBay's main
      // photo, which drives click-through), then labelled back, the raw card,
      // and the mini report last. Web twin: DEFAULT_IMAGE_ORDER in
      // src/components/ebay/EbayListingModal.tsx. Reorderable below.
      setImageOrder([
        { kind: 'system', key: 'front' },
        { kind: 'system', key: 'back' },
        { kind: 'system', key: 'rawFront' },
        { kind: 'system', key: 'rawBack' },
        { kind: 'system', key: 'miniReport' },
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
    // Keep only the picker's file URI (+ mime type) in state — the base64 for
    // each photo is read lazily at upload time, one image at a time.
    const valid = picked
      .filter(asset => !!asset.uri)
      .map(asset => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        uri: asset.uri,
        mimeType: asset.mimeType,
        selected: true,
      }))
    console.log('[ebay-list] adding', valid.length, 'custom images')
    if (valid.length === 0) {
      Alert.alert('Could not load images', 'Failed to read the selected photos.')
      return
    }
    setAdditionalImages(prev => [...prev, ...valid])
    setImageOrder(prev => [...prev, ...valid.map(v => ({ kind: 'custom' as const, id: v.id }))])
  }, [selectedImages, additionalImages])

  // Read a picked gallery photo into a base64 data URL. Called once per image
  // during the sequential upload so photos are never all in memory at once.
  const readAdditionalImageAsDataUrl = useCallback(async (img: { uri: string; mimeType?: string }): Promise<string> => {
    const b64 = await FileSystem.readAsStringAsync(img.uri, { encoding: 'base64' as any })
    const ext = img.uri.split('.').pop()?.toLowerCase()
    const fallbackMime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
    return `data:${img.mimeType || fallbackMime};base64,${b64}`
  }, [])

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

  // ─── Derived validation ───
  // A rival grading company in the title is a 400 `blocked_grader_title` at
  // publish (src/lib/ebay/publishCardListing.ts). The generated title can never
  // contain one — the builder strips them — so this only ever fires on a title
  // the seller edited. Catch it on the Details step instead of eight taps later.
  const blockedGraderInTitle = useMemo(() => findBlockedGrader(title), [title])
  // Counted by CODE POINT, like the slice above: eBay's 80 is characters, and
  // an emoji is one character, not the two UTF-16 units `.length` reports.
  const titleLength = useMemo(() => Array.from(title).length, [title])
  // Required specifics with no value. These can arrive from the prep page AFTER
  // the seller walked past the Specifics step, so Review re-checks (web parity).
  const missingRequired = useMemo(() => missingRequiredSpecifics(itemSpecifics), [itemSpecifics])
  /** Publish is blocked on anything the server would reject anyway. */
  const canPublish = missingRequired.length === 0 && !blockedGraderInTitle && title.trim().length > 0

  // ─── Publish listing ───
  const handlePublish = useCallback(async () => {
    if (!card) return
    if (publishingRef.current) return
    // Both of these are also enforced server-side (400 blocked_grader_title /
    // eBay's own aspect validation). Stopping here saves a full image upload
    // pass and names the fix instead of showing a raw API error.
    if (blockedGraderInTitle) {
      Alert.alert(
        'Title names another grading company',
        `eBay listings can't name "${blockedGraderInTitle}". Edit the title on the Listing Details step and try again.`,
        [{ text: 'Edit Title', onPress: () => setStep('details') }, { text: 'Cancel', style: 'cancel' }],
      )
      return
    }
    if (missingRequired.length > 0) {
      Alert.alert(
        'Required fields missing',
        `eBay needs a value for: ${missingRequired.map(s => s.name).join(', ')}`,
        [{ text: 'Fill them in', onPress: () => setStep('specifics') }, { text: 'Cancel', style: 'cancel' }],
      )
      return
    }
    publishingRef.current = true
    setIsPublishing(true)
    setIsAuthError(false)
    setErrorEditTarget(null)
    setStep('publishing')

    try {
      // 1. Build images-to-upload from imageOrder (selected only)
      const imagesToUpload: Record<string, string> = {}
      const orderedExtras: { id: string; uri: string; mimeType?: string }[] = []
      // Walk the ordered list and pick what's selected
      for (const item of imageOrder) {
        if (item.kind === 'system') {
          const sel = (selectedImages as any)[item.key]
          if (!sel) continue
          const url = imageUrls[item.key]
          if (url) imagesToUpload[item.key] = url
        } else {
          const ai = additionalImages.find(a => a.id === item.id)
          if (ai && ai.selected) orderedExtras.push({ id: ai.id, uri: ai.uri, mimeType: ai.mimeType })
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
          // Lazy thunks: each gallery photo is read from disk right before its
          // own upload instead of holding every base64 in memory up front.
          orderedExtras.map(e => () => readAdditionalImageAsDataUrl(e)),
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
          if (!ai || !ai.selected) continue
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
        // Default when nothing was carried forward. The spread below may
        // replace it (and add the ship-to list / international return terms)
        // from the seller's saved web defaults — only while international
        // shipping is actually on, since the server ignores the whole block
        // otherwise. No `policies` is ever sent: mobile has no policy picker,
        // and the server applies the seller's saved ids for them.
        internationalReturnsAccepted: false,
        ...(shipping.offerInternational && carriedForwardIntl ? carriedForwardIntl : {}),
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
      // The 400s a seller fixes by editing a field. The route returns the human
      // sentence as `error` ("Title can't name another grading company
      // (\"PSA\")…", "eBay doesn't allow web addresses… in a listing title."),
      // so the message is already readable — what it lacks is a way back to the
      // field. Matched on the sentence as well as the code because
      // publishCardListing's simpleFailure bodies carry only `error`, not the
      // PublishErrorCode.
      const linkComplaint = /web addresses, links or email addresses/i.test(message)
      if (status === 400 && (/blocked_grader_title/i.test(message) || /grading company/i.test(message))) {
        setErrorEditTarget({ label: 'Edit Title', step: 'details' })
      } else if (status === 400 && (/link_in_title/i.test(message) || (linkComplaint && /listing title/i.test(message)))) {
        setErrorEditTarget({ label: 'Edit Title', step: 'details' })
      } else if (status === 400 && (/link_in_description/i.test(message) || (linkComplaint && /listing description/i.test(message)))) {
        setErrorEditTarget({ label: 'Edit Description', step: 'details' })
      } else {
        setErrorEditTarget(null)
      }
      setErrorMessage(
        /blocked_grader_title/i.test(message) && !/grading company/i.test(message)
          ? "eBay listings can't name another grading company. Edit the title and try again."
          : /link_in_title/i.test(message) && !linkComplaint
            ? "eBay doesn't allow web addresses, links or email addresses in a listing title. Remove it and try again."
            : /link_in_description/i.test(message) && !linkComplaint
              ? "eBay doesn't allow web addresses, links or email addresses in a listing description. Remove it and try again."
              : message
      )
      setStep('error')
    } finally {
      publishingRef.current = false
      setIsPublishing(false)
      setPublishProgress('')
    }
  }, [card, cardId, title, blockedGraderInTitle, missingRequired, price, description, listingFormat, bestOfferEnabled, duration, imageOrder, imageUrls, selectedImages, additionalImages, frontUrl, backUrl, itemSpecifics, shipping, carriedForwardIntl, regulatoryDocumentId, readAdditionalImageAsDataUrl])

  // ─── Navigation helpers ───
  const canGoNext = useMemo(() => {
    switch (step) {
      case 'connect': return ebayStatus?.connected
      case 'details': return title.trim().length > 0 && title.length <= 80 && !blockedGraderInTitle && parseFloat(price) > 0
      case 'specifics': return true
      case 'shipping': return shipping.postalCode.length >= 5
      default: return false
    }
  }, [step, ebayStatus, title, blockedGraderInTitle, price, shipping.postalCode])

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
                    <TouchableOpacity
                      onPress={() => { setImagesError(null); setPrepAttempt(n => n + 1) }}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                      <Text style={{ color: Colors.purple[600], fontWeight: '600' }}>Retry</Text>
                    </TouchableOpacity>
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
              key={`prep-${prepAttempt}`}
              source={{
                // bridge=2 asks the prep page for the chunked protocol (one
                // message per image). Old cached pages ignore the param and
                // send the legacy single 'images-ready' message instead.
                uri: `${API_BASE}/ebay-image-prep/${cardId}?token=${encodeURIComponent(session.access_token)}&labelStyle=${labelStyle}&bridge=2`,
              }}
              originWhitelist={['*']}
              javaScriptEnabled
              onLoadStart={() => {
                setImagesGenerating(true)
                setImagesError(null)
                chunkedImagesRef.current = {}
                clearPrepTimeout()
                prepTimeoutRef.current = setTimeout(() => {
                  prepTimeoutRef.current = null
                  setImagesError('Image generation timed out.')
                  setImagesGenerating(false)
                }, PREP_TIMEOUT_MS)
              }}
              onMessage={(e) => {
                try {
                  const msg = JSON.parse(e.nativeEvent.data)
                  if (msg.type === 'ebay-prep-image' && typeof msg.key === 'string' && typeof msg.dataUrl === 'string') {
                    // Chunked protocol (v2): buffer each image as it arrives.
                    chunkedImagesRef.current[msg.key] = msg.dataUrl
                  } else if (msg.type === 'ebay-prep-complete') {
                    // Chunked protocol (v2): all images arrived; metadata rides
                    // on the (small) completion message.
                    applyPrepResult({ ...chunkedImagesRef.current }, msg)
                    chunkedImagesRef.current = {}
                  } else if (msg.type === 'images-ready' && msg.images) {
                    // Legacy protocol: everything in one giant message (old
                    // cached prep page).
                    applyPrepResult(msg.images, msg)
                  } else if (msg.type === 'error') {
                    clearPrepTimeout()
                    setImagesError(msg.message || 'Failed to generate images')
                    setImagesGenerating(false)
                  }
                } catch {}
              }}
              onError={(syntheticEvent) => {
                clearPrepTimeout()
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
            <TextInput
              style={[st.input, !!blockedGraderInTitle && { borderColor: Colors.red[500] }]}
              value={title}
              onChangeText={t => setTitle(Array.from(t).slice(0, 80).join(''))}
              maxLength={80}
            />
            <Text style={[st.charCount, titleLength >= 80 && { color: Colors.amber[600], fontWeight: '700' }]}>
              {titleLength}/80
            </Text>
            {/* Client-side twin of the server's 400 blocked_grader_title gate. */}
            {!!blockedGraderInTitle && (
              <View style={st.titleErrorBox}>
                <Ionicons name="alert-circle" size={14} color={Colors.red[600]} />
                <Text style={st.titleErrorText}>
                  eBay listings can&apos;t name another grading company. Remove &quot;{blockedGraderInTitle}&quot; from
                  the title — a graded-card title naming a rival grader reads as a grade-equivalence claim and eBay
                  pulls the listing.
                </Text>
              </View>
            )}

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
              <>
              <View style={[st.descriptionPreviewBox, { height: DESCRIPTION_PREVIEW_HEIGHT }]}>
                {/* SECURITY: this renders listing HTML that is editable in the
                    field above and partly built from model output, inside an
                    app that holds a live Supabase session. Scripts are OFF and
                    the whitelist allows nothing but the inlined document, so a
                    <script> or an onerror= in the description cannot run or
                    navigate anywhere. That also costs the old JS height probe:
                    the box is a fixed height the reader scrolls instead. */}
                <WebView
                  originWhitelist={['about:blank']}
                  javaScriptEnabled={false}
                  domStorageEnabled={false}
                  allowFileAccess={false}
                  setSupportMultipleWindows={false}
                  // Nothing may leave this box — no navigation, no popups.
                  onShouldStartLoadWithRequest={(req) => req.url === 'about:blank' || req.url.startsWith('data:')}
                  source={{
                    html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:8px;font-family:-apple-system,Roboto,sans-serif;background:#fff;}img{max-width:100%;height:auto;}</style></head><body>${description}</body></html>`,
                  }}
                  style={{ flex: 1, backgroundColor: 'transparent' }}
                  scrollEnabled
                  nestedScrollEnabled
                />
              </View>
              <Text style={st.helperText}>Scroll inside the preview to see the whole description.</Text>
              </>
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
            {/* Readiness message — web parity with EbayListingModal's Review
                banner. eBay's required aspects can arrive from the prep page
                after this step first rendered, so name them out loud instead
                of failing at publish. */}
            {missingRequired.length > 0 && (
              <View style={st.requiredBanner}>
                <Ionicons name="alert-circle" size={16} color={Colors.amber[600]} />
                <Text style={st.requiredBannerText}>
                  eBay requires {missingRequired.length === 1 ? 'one more field' : `${missingRequired.length} more fields`} before
                  this can be published: {missingRequired.map(s => s.name).join(', ')}
                </Text>
              </View>
            )}
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

            {/* Business-policy sellers: eBay refuses inline shipping/returns
                alongside the saved policies, so every rate, returns and
                international input below is hidden and the server applies the
                seller's policy ids. Only the ZIP and the package size are
                still asked for — a policy carries neither. */}
            {useBusinessPolicies && (
              <View style={st.policyNoteBox}>
                <Ionicons name="shield-checkmark-outline" size={16} color={Colors.purple[700]} />
                <Text style={st.policyNoteText}>
                  Using your eBay business policies (set on the web). Your saved shipping, returns and payment
                  policies apply to this listing — just confirm where it ships from and how big the package is.
                </Text>
              </View>
            )}

            {!useBusinessPolicies && (
              <>
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

            {/* Handling time is part of a shipping business policy. */}
            {!useBusinessPolicies && (
              <>
                <Text style={st.fieldLabel}>Handling Days</Text>
                <TextInput style={st.input} value={shipping.handlingDays} onChangeText={v => setShipping(p => ({ ...p, handlingDays: v }))} keyboardType="number-pad" />
              </>
            )}

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

            {!useBusinessPolicies && (
              <>
                <View style={[st.switchRow, { marginTop: 16 }]}>
                  <Text style={st.switchLabel}>Offer International Shipping</Text>
                  <Switch value={shipping.offerInternational} onValueChange={v => setShipping(p => ({ ...p, offerInternational: v }))} />
                </View>
                {/* Terms mobile has no field for but carries from the web —
                    named here so the seller isn't surprised at review. */}
                {shipping.offerInternational && !!carriedForwardIntlSummary && (
                  <Text style={st.helperText}>{carriedForwardIntlSummary}</Text>
                )}

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
              </>
            )}

            {/* Save as my defaults — web parity with the modal's
                "Save as my shipping defaults". Personal scope only; the next
                listing picks these up from the mount fetch above. Gated on a
                usable ZIP for the same reason Next is: eBay rejects the rest. */}
            <View style={st.saveDefaultsRow}>
              <TouchableOpacity
                style={[st.saveDefaultsBtn, (savingDefaults || shipping.postalCode.length < 5) && st.saveDefaultsBtnDisabled]}
                disabled={savingDefaults || shipping.postalCode.length < 5}
                onPress={handleSaveShippingDefaults}
              >
                {savingDefaults
                  ? <ActivityIndicator size="small" color={Colors.purple[700]} />
                  : <Ionicons name="bookmark-outline" size={14} color={shipping.postalCode.length < 5 ? Colors.gray[400] : Colors.purple[700]} />}
                <Text style={[st.saveDefaultsBtnText, (savingDefaults || shipping.postalCode.length < 5) && st.saveDefaultsBtnTextDisabled]}>
                  {savingDefaults ? 'Saving…' : 'Save as my defaults'}
                </Text>
              </TouchableOpacity>
            </View>
            {useBusinessPolicies && (
              <Text style={[st.helperText, { textAlign: 'right' }]}>
                Saves your ship-from ZIP and package size only — your rate and returns terms come from your eBay
                business policies.
              </Text>
            )}
            {defaultsSavedFlash && (
              <Text style={st.saveDefaultsFlash}>Saved — future listings start from these</Text>
            )}
          </View>
        )}

        {/* ═══ STEP 5: Review ═══ */}
        {step === 'review' && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>Review Your Listing</Text>

            {/* Missing required specifics — say it out loud and offer the way
                back, exactly like the web modal's Review banner. */}
            {missingRequired.length > 0 && (
              <View style={st.requiredBanner}>
                <Ionicons name="alert-circle" size={16} color={Colors.amber[600]} />
                <View style={{ flex: 1 }}>
                  <Text style={st.requiredBannerText}>
                    eBay requires {missingRequired.length === 1 ? 'one more field' : `${missingRequired.length} more fields`} before
                    this can be published: {missingRequired.map(s => s.name).join(', ')}
                  </Text>
                  <TouchableOpacity style={st.requiredBannerBtn} onPress={() => setStep('specifics')}>
                    <Text style={st.requiredBannerBtnText}>
                      Go back and fill {missingRequired.length === 1 ? 'it' : 'them'} in
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* An edited title naming a rival grader is a 400 at publish. */}
            {!!blockedGraderInTitle && (
              <View style={st.titleErrorBox}>
                <Ionicons name="alert-circle" size={14} color={Colors.red[600]} />
                <View style={{ flex: 1 }}>
                  <Text style={st.titleErrorText}>
                    The title names another grading company (&quot;{blockedGraderInTitle}&quot;). eBay won&apos;t accept it.
                  </Text>
                  <TouchableOpacity style={st.requiredBannerBtn} onPress={() => setStep('details')}>
                    <Text style={st.requiredBannerBtnText}>Edit the title</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

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
              <Text style={st.reviewLabel}>{useBusinessPolicies ? 'Shipping & returns' : 'Shipping'}</Text>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                {useBusinessPolicies ? (
                  <Text style={st.reviewValue}>your eBay business policies</Text>
                ) : (
                  <Text style={st.reviewValue}>{shipping.shippingType === 'FREE' ? 'Free Shipping' : shipping.shippingType === 'FLAT_RATE' ? `Flat Rate $${shipping.flatRate}` : 'Calculated'}</Text>
                )}
                {shippingMatchesSavedDefaults && <Text style={st.reviewSubValue}>Saved as default</Text>}
              </View>
            </View>
            {/* International terms mobile has no field for but WILL send —
                carried forward from the seller's saved web defaults. Hidden
                under business policies: the policy supplies them instead. */}
            {!useBusinessPolicies && shipping.offerInternational && !!carriedForwardIntlSummary && (
              <View style={st.reviewBox}>
                <Text style={st.reviewLabel}>International</Text>
                <Text style={st.reviewValue}>{carriedForwardIntlSummary}</Text>
              </View>
            )}
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
                  <Text style={st.disclaimerIntro}>{DISCLAIMER_INTRO}</Text>
                  {DISCLAIMER_SECTIONS.map(section => (
                    <View key={section.heading} style={{ marginBottom: 10 }}>
                      <Text style={st.disclaimerHeading}>{section.heading}</Text>
                      <Text style={st.disclaimerBody}>{section.body}</Text>
                    </View>
                  ))}
                  <Text style={st.disclaimerVersion}>{DISCLAIMER_VERSION_LINE}</Text>
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
                  <Text style={st.disclaimerCheckText}>{DISCLAIMER_CONSENT}</Text>
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
              <TouchableOpacity
                style={[st.primaryBtn, { marginTop: 16 }, (isPublishing || !canPublish) && { opacity: 0.4 }]}
                onPress={handlePublish}
                disabled={isPublishing || !canPublish}
              >
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
            {errorEditTarget && (
              <TouchableOpacity
                style={[st.primaryBtn, { marginTop: 16 }]}
                onPress={() => { const target = errorEditTarget; setErrorEditTarget(null); setStep(target.step) }}
              >
                <Ionicons name="create-outline" size={18} color="#fff" />
                <Text style={st.primaryBtnText}>{errorEditTarget.label}</Text>
              </TouchableOpacity>
            )}
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
              style={(isAuthError || errorEditTarget) ? [st.navBtnBack, { marginTop: 12 }] : [st.primaryBtn, { marginTop: 16 }]}
              onPress={() => setStep('review')}
            >
              <Text style={(isAuthError || errorEditTarget) ? st.navBtnBackText : st.primaryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom navigation bar — pad for device home indicator / nav bar.
          When Next is greyed out, a hint strip above the bar says WHY — a
          silent disabled button reads as a broken app (customer report,
          Aug 2026: stuck on Shipping with no ZIP and no explanation). */}
      {!['publishing', 'success', 'error'].includes(step) && !canGoNext && (step === 'shipping' || step === 'details') && (
        <View style={st.navHintStrip}>
          <Text style={st.navHintText}>
            {step === 'shipping'
              ? 'Enter your ship-from ZIP code above to continue'
              : blockedGraderInTitle
                ? `Remove "${blockedGraderInTitle}" from the title to continue`
                : 'Enter a title and price to continue'}
          </Text>
        </View>
      )}
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
  reviewSubValue: { fontSize: 10, color: Colors.purple[700], fontWeight: '600', marginTop: 2 },

  // Save as my defaults (shipping step)
  saveDefaultsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  saveDefaultsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.purple[200], backgroundColor: Colors.purple[50] },
  saveDefaultsBtnDisabled: { borderColor: Colors.gray[200], backgroundColor: Colors.gray[50] },
  saveDefaultsBtnText: { fontSize: 12, fontWeight: '600', color: Colors.purple[700] },
  saveDefaultsBtnTextDisabled: { color: Colors.gray[400] },
  saveDefaultsFlash: { fontSize: 11, color: Colors.green[600], fontWeight: '600', textAlign: 'right', marginTop: 6 },

  // Business-policy note (shipping step)
  policyNoteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: Colors.purple[50], borderRadius: 8, borderWidth: 1, borderColor: Colors.purple[200] },
  policyNoteText: { fontSize: 11, color: Colors.purple[700], flex: 1, lineHeight: 15 },

  // Blocked-grader title error + missing required specifics
  titleErrorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: Colors.red[50], borderRadius: 8, borderWidth: 1, borderColor: Colors.red[500] },
  titleErrorText: { fontSize: 11, color: Colors.red[600], flex: 1, lineHeight: 15 },
  requiredBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: Colors.amber[50], borderRadius: 8, borderWidth: 1, borderColor: Colors.amber[500] },
  requiredBannerText: { fontSize: 11, color: Colors.amber[600], flex: 1, lineHeight: 15 },
  requiredBannerBtn: { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.amber[500] },
  requiredBannerBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },

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
  navHintStrip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFFBEB', borderTopWidth: 1, borderTopColor: '#FDE68A' },
  navHintText: { fontSize: 12, color: '#92400E', textAlign: 'center', fontWeight: '500' },
  navBtnBack: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: Colors.gray[300] },
  navBtnBackText: { fontSize: 14, fontWeight: '600', color: Colors.gray[600] },
  navBtnNext: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: Colors.purple[600] },
  navBtnNextText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  navBtnDisabled: { opacity: 0.4 },

  // OAuth
  oauthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.gray[200] },
  oauthTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray[800] },
})
