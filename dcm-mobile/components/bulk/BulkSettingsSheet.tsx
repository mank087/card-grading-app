/**
 * Batch settings — the "across the board" sheet.
 *
 * Web twin: src/app/instalist-marketplace/bulk/[batchId]/BulkSettingsPanel.tsx.
 * Same fields, same key names, same server-side validators; applied once to
 * every row instead of once per card.
 *
 * The form is a DELIBERATE duplicate of the single-card wizard's shipping step
 * (app/pages/ebay-list.tsx step 4) rather than a shared component. That step is
 * welded into a 2,100-line stepper with its own state and its own publish
 * payload; lifting it out would risk the single-card flow, which this phase
 * must not touch. What is shared is the shape, the service list and the
 * validation (a 5-digit ship-from ZIP, the same numeric fallbacks).
 *
 * Never sent: `gradeLabel` and `policies`. Both are server-resolved from the
 * seller's account, and the PATCH route ignores them — sending our local copy
 * back could only ever be a way to get them wrong.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, Modal, ScrollView, TextInput, TouchableOpacity, Switch,
  ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Colors } from '@/lib/constants'
import {
  SHIPPING_SERVICES, INTERNATIONAL_SHIPPING_SERVICES, normalizeShippingService,
} from '@/lib/ebayApi'
import { updateBatchSettings, BulkApiError } from '@/lib/ebayBulkApi'
import {
  BULK_AUCTION_DURATIONS,
  DEFAULT_AUCTION_DURATION,
  DEFAULT_BULK_SHIPPING,
  type BulkBatch, type BulkBatchSettings, type BulkShippingForm, type BulkPriceRule,
} from '@/lib/ebayBulkTypes'

interface Props {
  visible: boolean
  batch: BulkBatch
  onClose: () => void
  /** Server-returned batch + how many rows the re-seed touched. */
  onSaved: (batch: BulkBatch, reseeded: number) => void
  /**
   * The batch was submitted while this sheet was open (409). There is nothing
   * to retry, so the sheet closes and the screen shows the server's sentence.
   */
  onConflict: (message: string) => void
}

type PriceMode = BulkPriceRule['mode']

/**
 * Local edit state. Numerics are strings because that is what a TextInput
 * holds — a half-typed "1" must not become the number 1 and fight the cursor.
 * Coerced back on save with the same fallbacks the wizard uses.
 */
interface FormState {
  priceMode: PriceMode
  pricePercent: string
  priceAmount: string
  listingFormat: BulkBatchSettings['listingFormat']
  duration: BulkBatchSettings['duration']
  bestOfferEnabled: boolean
  shippingType: BulkShippingForm['shippingType']
  domesticService: string
  flatRate: string
  handlingDays: string
  postalCode: string
  weightOz: string
  lengthIn: string
  widthIn: string
  depthIn: string
  offerInternational: boolean
  intlType: BulkShippingForm['internationalShippingType']
  intlService: string
  intlFlatRate: string
  returnsAccepted: boolean
  returnPeriod: string
  returnShipping: 'BUYER' | 'SELLER'
}

function seedForm(settings: BulkBatchSettings): FormState {
  const s = settings.shipping ?? DEFAULT_BULK_SHIPPING
  const rule = settings.priceRule ?? { mode: 'estimate' as const }
  const auction = settings.listingFormat === 'AUCTION'
  return {
    priceMode: rule.mode,
    pricePercent: rule.mode === 'estimate_pct' ? String(rule.percent) : '100',
    priceAmount: rule.mode === 'fixed' ? String(rule.amount) : '',
    listingFormat: auction ? 'AUCTION' : 'FIXED_PRICE',
    // A batch written before auctions existed has no duration worth reading.
    duration: auction ? settings.duration ?? DEFAULT_AUCTION_DURATION : 'GTC',
    bestOfferEnabled: !auction && settings.bestOfferEnabled !== false,
    shippingType: s.shippingType ?? 'CALCULATED',
    // A retired token (USPSFirstClass) would leave no chip selected and read
    // as "no service chosen" — map it forward, exactly as the wizard does.
    domesticService: normalizeShippingService(s.domesticShippingService),
    flatRate: String(s.flatRateAmount ?? 5),
    handlingDays: String(s.handlingDays ?? 1),
    postalCode: (s.postalCode ?? '').replace(/[^0-9]/g, ''),
    weightOz: String(s.packageWeightOz ?? 4),
    lengthIn: String(s.packageLengthIn ?? 10),
    widthIn: String(s.packageWidthIn ?? 6),
    depthIn: String(s.packageDepthIn ?? 1),
    offerInternational: s.offerInternational === true,
    intlType: s.internationalShippingType === 'FLAT_RATE' ? 'FLAT_RATE' : 'CALCULATED',
    intlService: s.internationalShippingService || INTERNATIONAL_SHIPPING_SERVICES[0].value,
    intlFlatRate: String(s.internationalFlatRateCost ?? 15),
    returnsAccepted: s.domesticReturnsAccepted === true,
    returnPeriod: String(s.domesticReturnPeriodDays ?? 30),
    returnShipping: s.domesticReturnShippingPaidBy === 'SELLER' ? 'SELLER' : 'BUYER',
  }
}

/** One line for the header: "Price: estimate · Shipping: calculated". */
export function describePriceRule(rule: BulkPriceRule | undefined): string {
  if (!rule) return 'estimate'
  switch (rule.mode) {
    case 'estimate': return 'estimate'
    case 'estimate_pct': return `estimate × ${rule.percent}%`
    case 'fixed': return `$${Number(rule.amount || 0).toFixed(2)}`
    case 'blank': return 'blank'
    default: return 'estimate'
  }
}

/** "Auction · 7 days" / "Buy It Now". Twin: web describeListingFormat. */
export function describeListingFormat(settings: BulkBatchSettings | undefined): string {
  if (settings?.listingFormat !== 'AUCTION') return 'Buy It Now'
  const label = BULK_AUCTION_DURATIONS.find(d => d.value === settings.duration)?.label ?? '7 Days'
  return `Auction · ${label.toLowerCase()}`
}

export function describeShipping(settings: BulkBatchSettings | undefined): string {
  if (!settings) return 'calculated'
  if (settings.policies?.useBusinessPolicies) return 'your eBay business policies'
  const s = settings.shipping ?? DEFAULT_BULK_SHIPPING
  if (s.shippingType === 'FREE') return 'free'
  if (s.shippingType === 'FLAT_RATE') return `flat $${Number(s.flatRateAmount ?? 0).toFixed(2)}`
  return 'calculated'
}

export default function BulkSettingsSheet({ visible, batch, onClose, onSaved, onConflict }: Props) {
  const insets = useSafeAreaInsets()
  const usePolicies = batch.settings?.policies?.useBusinessPolicies === true

  const [form, setForm] = useState<FormState>(() => seedForm(batch.settings))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Set when Save was pressed on an unusable ZIP — the field then says so. */
  const [zipTouched, setZipTouched] = useState(false)

  const scrollRef = useRef<ScrollView>(null)
  const zipRef = useRef<TextInput>(null)
  /** Where the ZIP field sits inside the scroll view, for the jump on save. */
  const zipOffset = useRef(0)

  // Re-seed whenever the sheet is opened: the batch may have been re-fetched
  // (or another device may have changed it) since the last time it was shown.
  useEffect(() => {
    if (visible) {
      setForm(seedForm(batch.settings))
      setError(null)
      setZipTouched(false)
    }
    // batch.settings is the whole point of the re-seed; batch.updated_at moves
    // with it, so keying on the settings object is enough.
  }, [visible, batch.settings])

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  const isAuction = form.listingFormat === 'AUCTION'

  /**
   * Switching format carries the other two fields with it: fixed price has
   * exactly one duration, and eBay does not allow Best Offer on an auction.
   */
  const setFormat = useCallback((listingFormat: BulkBatchSettings['listingFormat']) => {
    setForm(prev =>
      listingFormat === 'AUCTION'
        ? {
            ...prev,
            listingFormat,
            duration: prev.duration === 'GTC' ? DEFAULT_AUCTION_DURATION : prev.duration,
            bestOfferEnabled: false,
          }
        : { ...prev, listingFormat, duration: 'GTC' }
    )
  }, [])

  // eBay rejects a calculated rate without a ship-from ZIP, and the wizard
  // blocks its Next button on the same rule.
  const zipValid = form.postalCode.length === 5

  const priceRule: BulkPriceRule = useMemo(() => {
    if (form.priceMode === 'estimate_pct') {
      const pct = parseInt(form.pricePercent, 10)
      return { mode: 'estimate_pct', percent: Number.isFinite(pct) && pct > 0 ? pct : 100 }
    }
    if (form.priceMode === 'fixed') {
      const amount = parseFloat(form.priceAmount)
      return { mode: 'fixed', amount: Number.isFinite(amount) && amount > 0 ? amount : 0 }
    }
    return { mode: form.priceMode === 'blank' ? 'blank' : 'estimate' }
  }, [form.priceMode, form.pricePercent, form.priceAmount])

  /**
   * The fallbacks above are there so a half-typed number never fights the
   * cursor — but saving one would apply it to every row, and `fixed` falling
   * back to 0 blanks the whole batch's prices. Blocked here, the way the ZIP is.
   */
  const priceValid = useMemo(() => {
    if (form.priceMode === 'fixed') {
      const amount = parseFloat(form.priceAmount)
      return Number.isFinite(amount) && amount > 0
    }
    if (form.priceMode === 'estimate_pct') {
      const pct = parseInt(form.pricePercent, 10)
      return Number.isFinite(pct) && pct >= 1 && pct <= 1000
    }
    return true
  }, [form.priceMode, form.priceAmount, form.pricePercent])
  const canSave = zipValid && priceValid && !saving

  const handleSave = useCallback(async () => {
    if (saving) return
    /**
     * The button stays styled as disabled, but it is pressable: a greyed-out
     * Save that answers nothing is the same "is this app broken?" the wizard's
     * Next button was reported for. Pressing it takes the seller to the field
     * that is stopping them.
     */
    if (!zipValid) {
      setZipTouched(true)
      scrollRef.current?.scrollTo({ y: Math.max(0, zipOffset.current - 12), animated: true })
      zipRef.current?.focus()
      return
    }
    if (!priceValid) return
    setSaving(true)
    setError(null)

    // Package size and ship-from ZIP are the only shipping fields the policies
    // layout shows, so they are the only ones it may send. `shipping` merges
    // partially server-side, so everything left out survives untouched — a
    // policies-mode save must not erase the rate/returns terms the seller set
    // on the web before turning policies on.
    const parcel = {
      postalCode: form.postalCode,
      packageWeightOz: parseInt(form.weightOz, 10) || 4,
      packageLengthIn: parseInt(form.lengthIn, 10) || 10,
      packageWidthIn: parseInt(form.widthIn, 10) || 6,
      packageDepthIn: parseInt(form.depthIn, 10) || 1,
    }
    const shipping: Partial<BulkShippingForm> = usePolicies
      ? parcel
      : {
          shippingType: form.shippingType,
          domesticShippingService: form.domesticService,
          flatRateAmount: parseFloat(form.flatRate) || 5,
          handlingDays: parseInt(form.handlingDays, 10) || 1,
          ...parcel,
          offerInternational: form.offerInternational,
          internationalShippingType: form.intlType,
          internationalShippingService: form.intlService,
          internationalFlatRateCost: parseFloat(form.intlFlatRate) || 15,
          domesticReturnsAccepted: form.returnsAccepted,
          domesticReturnPeriodDays: parseInt(form.returnPeriod, 10) || 30,
          domesticReturnShippingPaidBy: form.returnShipping,
        }

    try {
      const res = await updateBatchSettings(batch.id, {
        priceRule,
        listingFormat: form.listingFormat,
        duration: form.duration,
        // Sent even for an auction, where the server forces it false anyway —
        // the payload is what the sheet shows, not a subset of it.
        bestOfferEnabled: form.bestOfferEnabled,
        shipping: shipping as BulkShippingForm,
      })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      onSaved(res.batch, res.reseeded ?? 0)
      onClose()
    } catch (err) {
      // 409 is "this batch has already been submitted" — the settings are
      // frozen server-side, so there is nothing to retry in here. Close and let
      // the screen render the server's own sentence; the batch stays as it is.
      if (err instanceof BulkApiError && err.status === 409) {
        onConflict(err.message)
        onClose()
        return
      }
      setError(err instanceof Error ? err.message : 'Could not save these settings.')
    } finally {
      setSaving(false)
    }
  }, [saving, zipValid, priceValid, form, usePolicies, priceRule, batch.id, onSaved, onConflict, onClose])

  const policyNames = batch.settings?.policies

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      {/* Half of this sheet is numeric TextInputs and the Save button is pinned
          to the bottom — without this the keyboard covers both. */}
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.sheet, { paddingBottom: 8 + Math.max(insets.bottom, 4) }]}>
          <View style={styles.handleRow}>
            <Text style={styles.sheetTitle}>Batch settings</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close batch settings"
            >
              <Ionicons name="close" size={22} color={Colors.gray[500]} />
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={14} color={Colors.red[600]} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <ScrollView ref={scrollRef} style={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* ── Format ────────────────────────────────────────────────── */}
            <Text style={styles.sectionTitle}>Format</Text>
            <View style={styles.segmentRow}>
              {([
                ['FIXED_PRICE', 'Buy It Now'],
                ['AUCTION', 'Auction'],
              ] as const).map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.segment, form.listingFormat === value && styles.segmentActive]}
                  onPress={() => setFormat(value)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.segmentText, form.listingFormat === value && styles.segmentTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {isAuction && (
              <>
                {/* The Best Offer toggle disappears on an auction; saying why
                    beats leaving the seller to notice it went. */}
                <Text style={styles.helperText}>Best Offer isn&apos;t available on auctions.</Text>
                <Text style={styles.fieldLabel}>Duration</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {BULK_AUCTION_DURATIONS.map(d => (
                    <TouchableOpacity
                      key={d.value}
                      style={[styles.chip, form.duration === d.value && styles.chipActive]}
                      onPress={() => set('duration', d.value)}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.chipText, form.duration === d.value && styles.chipTextActive]}>
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* ── Asking price ──────────────────────────────────────────── */}
            <Text style={styles.sectionTitle}>{isAuction ? 'Starting price' : 'Asking price'}</Text>
            <View style={styles.segmentRow}>
              {([
                ['estimate', 'Estimate'],
                ['estimate_pct', 'Estimate × %'],
                ['fixed', 'Fixed'],
                ['blank', 'Blank'],
              ] as const).map(([mode, label]) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.segment, form.priceMode === mode && styles.segmentActive]}
                  onPress={() => set('priceMode', mode)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.segmentText, form.priceMode === mode && styles.segmentTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {form.priceMode === 'estimate_pct' && (
              <>
                <Text style={styles.fieldLabel}>Percent of estimate</Text>
                <TextInput
                  style={styles.input}
                  value={form.pricePercent}
                  onChangeText={v => set('pricePercent', v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="110"
                  placeholderTextColor={Colors.gray[400]}
                />
                {!priceValid && (
                  <Text style={styles.fieldError}>Enter a percent between 1 and 1000.</Text>
                )}
              </>
            )}
            {form.priceMode === 'fixed' && (
              <>
                <Text style={styles.fieldLabel}>{isAuction ? 'Starting price ($)' : 'Price ($)'}</Text>
                <TextInput
                  style={styles.input}
                  value={form.priceAmount}
                  onChangeText={v => set('priceAmount', v)}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.gray[400]}
                />
                {!priceValid && (
                  <Text style={styles.fieldError}>Enter a price above 0.</Text>
                )}
              </>
            )}
            <Text style={styles.helperText}>Cards where you typed your own price keep it.</Text>

            {/* eBay does not allow Best Offer on an auction, so the toggle is
                gone rather than disabled — as it is in the single-card wizard. */}
            {!isAuction && (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Accept offers (Best Offer)</Text>
                <Switch
                  value={form.bestOfferEnabled}
                  onValueChange={v => set('bestOfferEnabled', v)}
                />
              </View>
            )}
            <Text style={styles.helperText}>
              {isAuction
                ? 'Auction: bidding runs for the length above, then the highest bid wins.'
                : "Format: fixed price, Good Til Cancelled — eBay's only fixed-price duration."}
            </Text>

            {/* ── Shipping ──────────────────────────────────────────────── */}
            <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Shipping</Text>

            {usePolicies && (
              <>
                <View style={styles.policyNoteBox}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={Colors.purple[700]} />
                  <Text style={styles.policyNoteText}>
                    Using your eBay business policies (set on the web). Your saved shipping, returns and
                    payment policies apply to every card in this batch — just confirm where it ships from
                    and how big the package is.
                  </Text>
                </View>
                {(!!policyNames?.shippingPolicyName || !!policyNames?.returnPolicyName) && (
                  <View style={styles.policyList}>
                    {!!policyNames?.shippingPolicyName && (
                      <Text style={styles.policyListText}>Shipping policy: {policyNames.shippingPolicyName}</Text>
                    )}
                    {!!policyNames?.returnPolicyName && (
                      <Text style={styles.policyListText}>Return policy: {policyNames.returnPolicyName}</Text>
                    )}
                  </View>
                )}
                <Text style={styles.helperText}>
                  Choose which policies apply on the web version.
                </Text>
              </>
            )}

            {!usePolicies && (
              <>
                <Text style={styles.fieldLabel}>Shipping Type</Text>
                <View style={styles.segmentRow}>
                  {(['FREE', 'FLAT_RATE', 'CALCULATED'] as const).map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.segment, form.shippingType === t && styles.segmentActive]}
                      onPress={() => set('shippingType', t)}
                    >
                      <Text style={[styles.segmentText, form.shippingType === t && styles.segmentTextActive]}>
                        {t === 'FLAT_RATE' ? 'Flat Rate' : t === 'FREE' ? 'Free' : 'Calculated'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {form.shippingType === 'CALCULATED' && (
                  <Text style={styles.helperText}>
                    eBay quotes the buyer a rate from your package size and ZIP.
                  </Text>
                )}

                <Text style={styles.fieldLabel}>Shipping Service</Text>
                {/* The chip row runs off the edge; the fade says so, since a
                    row that ends flush at the screen edge reads as the end. */}
                <View style={styles.chipScrollWrap}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipRow}>
                      {SHIPPING_SERVICES.map(s => (
                        <TouchableOpacity
                          key={s.value}
                          style={[styles.chip, form.domesticService === s.value && styles.chipActive]}
                          onPress={() => set('domesticService', s.value)}
                        >
                          <Text style={[styles.chipText, form.domesticService === s.value && styles.chipTextActive]}>
                            {s.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(255,255,255,0)', Colors.white]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.chipFade}
                  />
                </View>

                {form.shippingType === 'FLAT_RATE' && (
                  <>
                    <Text style={styles.fieldLabel}>Flat Rate ($)</Text>
                    <TextInput
                      style={styles.input}
                      value={form.flatRate}
                      onChangeText={v => set('flatRate', v)}
                      keyboardType="decimal-pad"
                    />
                  </>
                )}
              </>
            )}

            <View onLayout={e => { zipOffset.current = e.nativeEvent.layout.y }}>
              <Text style={styles.fieldLabel}>
                Postal Code <Text style={{ color: Colors.red[600] }}>*</Text>
              </Text>
              <TextInput
                ref={zipRef}
                style={[
                  styles.input,
                  (zipTouched || form.postalCode.length > 0) && !zipValid && { borderColor: Colors.red[500] },
                ]}
                value={form.postalCode}
                onChangeText={v => { setZipTouched(false); set('postalCode', v.replace(/[^0-9]/g, '')) }}
                keyboardType="number-pad"
                maxLength={5}
                placeholder="12345 (required)"
                placeholderTextColor={Colors.gray[400]}
              />
              {zipTouched && !zipValid && (
                <Text style={styles.fieldError}>Enter your 5-digit ship-from ZIP.</Text>
              )}
              <Text style={styles.helperText}>Required by eBay for shipping calculations.</Text>
            </View>

            {/* Handling time is part of a shipping business policy. */}
            {!usePolicies && (
              <>
                <Text style={styles.fieldLabel}>Handling Days</Text>
                <TextInput
                  style={styles.input}
                  value={form.handlingDays}
                  onChangeText={v => set('handlingDays', v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                />
              </>
            )}

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Package Dimensions</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Weight (oz)</Text>
                <TextInput
                  style={styles.input}
                  value={form.weightOz}
                  onChangeText={v => set('weightOz', v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Length (in)</Text>
                <TextInput
                  style={styles.input}
                  value={form.lengthIn}
                  onChangeText={v => set('lengthIn', v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Width (in)</Text>
                <TextInput
                  style={styles.input}
                  value={form.widthIn}
                  onChangeText={v => set('widthIn', v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Depth (in)</Text>
                <TextInput
                  style={styles.input}
                  value={form.depthIn}
                  onChangeText={v => set('depthIn', v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {!usePolicies && (
              <>
                <View style={[styles.switchRow, { marginTop: 16 }]}>
                  <Text style={styles.switchLabel}>Offer International Shipping</Text>
                  <Switch
                    value={form.offerInternational}
                    onValueChange={v => set('offerInternational', v)}
                  />
                </View>
                {form.offerInternational && (
                  <>
                    <Text style={styles.fieldLabel}>International Rate</Text>
                    <View style={styles.segmentRow}>
                      {(['CALCULATED', 'FLAT_RATE'] as const).map(t => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.segment, form.intlType === t && styles.segmentActive]}
                          onPress={() => set('intlType', t)}
                        >
                          <Text style={[styles.segmentText, form.intlType === t && styles.segmentTextActive]}>
                            {t === 'FLAT_RATE' ? 'Flat Rate' : 'Calculated'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.fieldLabel}>International Service</Text>
                    <View style={styles.chipScrollWrap}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.chipRow}>
                          {INTERNATIONAL_SHIPPING_SERVICES.map(s => (
                            <TouchableOpacity
                              key={s.value}
                              style={[styles.chip, form.intlService === s.value && styles.chipActive]}
                              onPress={() => set('intlService', s.value)}
                            >
                              <Text style={[styles.chipText, form.intlService === s.value && styles.chipTextActive]}>
                                {s.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                      <LinearGradient
                        pointerEvents="none"
                        colors={['rgba(255,255,255,0)', Colors.white]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.chipFade}
                      />
                    </View>
                    {form.intlType === 'FLAT_RATE' && (
                      <>
                        <Text style={styles.fieldLabel}>International Cost ($)</Text>
                        <TextInput
                          style={styles.input}
                          value={form.intlFlatRate}
                          onChangeText={v => set('intlFlatRate', v)}
                          keyboardType="decimal-pad"
                        />
                      </>
                    )}
                  </>
                )}

                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Returns</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Accept Returns</Text>
                  <Switch
                    value={form.returnsAccepted}
                    onValueChange={v => set('returnsAccepted', v)}
                  />
                </View>
                {form.returnsAccepted && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Return Period (days)</Text>
                      <TextInput
                        style={styles.input}
                        value={form.returnPeriod}
                        onChangeText={v => set('returnPeriod', v.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Return Shipping</Text>
                      <View style={styles.segmentRow}>
                        {(['BUYER', 'SELLER'] as const).map(w => (
                          <TouchableOpacity
                            key={w}
                            style={[styles.segment, form.returnShipping === w && styles.segmentActive]}
                            onPress={() => set('returnShipping', w)}
                          >
                            <Text style={[styles.segmentText, form.returnShipping === w && styles.segmentTextActive]}>
                              {w === 'BUYER' ? 'Buyer pays' : 'Seller pays'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}

            <View style={{ height: 12 }} />
          </ScrollView>

          {!zipValid && (
            <Text style={styles.saveHint}>Enter your 5-digit ship-from ZIP to save</Text>
          )}
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save batch settings"
          >
            {saving
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.saveBtnText}>Apply to every card</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 16, paddingTop: 12,
    maxHeight: '88%',
  },
  handleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: Colors.gray[900] },
  scroll: { flexGrow: 0 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.gray[800], marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray[500], marginBottom: 4, marginTop: 8 },
  helperText: { fontSize: 10, color: Colors.gray[500], marginTop: 2, marginBottom: 6 },
  fieldError: { fontSize: 11, color: Colors.red[600], marginTop: 4 },
  input: {
    backgroundColor: Colors.gray[50], borderWidth: 1, borderColor: Colors.gray[200],
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.gray[900],
  },
  segmentRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  segment: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.gray[200], alignItems: 'center',
  },
  segmentActive: { borderColor: Colors.purple[600], backgroundColor: Colors.purple[50] },
  segmentText: { fontSize: 11, fontWeight: '600', color: Colors.gray[500] },
  segmentTextActive: { color: Colors.purple[700] },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.gray[200], backgroundColor: Colors.white,
  },
  chipScrollWrap: { position: 'relative', marginBottom: 8 },
  chipRow: { flexDirection: 'row', gap: 6, paddingRight: 24 },
  chipFade: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 24 },
  chipActive: { borderColor: Colors.purple[600], backgroundColor: Colors.purple[50] },
  chipText: { fontSize: 11, fontWeight: '600', color: Colors.gray[500] },
  chipTextActive: { color: Colors.purple[700] },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: { fontSize: 13, color: Colors.gray[700] },

  policyNoteBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: Colors.purple[50], borderRadius: 8,
    borderWidth: 1, borderColor: Colors.purple[200],
  },
  policyNoteText: { fontSize: 11, color: Colors.purple[700], flex: 1, lineHeight: 15 },
  policyList: { marginTop: 8, gap: 2 },
  policyListText: { fontSize: 11, color: Colors.gray[700] },

  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8,
    backgroundColor: Colors.red[50], borderRadius: 8,
    borderWidth: 1, borderColor: Colors.red[500],
  },
  errorText: { fontSize: 11, color: Colors.red[600], flex: 1, lineHeight: 15 },

  saveHint: { fontSize: 11, color: Colors.amber[600], textAlign: 'center', marginTop: 6 },
  saveBtn: {
    marginTop: 10, backgroundColor: Colors.purple[600], borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
})
