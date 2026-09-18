/**
 * "Confirm your card details", native.
 *
 * Mirrors src/components/cards/ConfirmCardDetailsDialog.tsx on the web, which is
 * the source of truth for behaviour and wording. The owner sees their two photos
 * and a short form of what DCM thinks the card is. Nothing here decides anything:
 * a value read off the card is labelled as read, a value DCM recognized is
 * labelled "Please check", and a disagreement is offered as a suggestion the
 * owner can take or ignore.
 *
 * Saving sends ONLY the fields that differ from what is stored, plus
 * `confirm: true` and the revision the owner was looking at, to
 * PATCH /api/cards/[id]/details, then the version pick to /api/pricing/dcm-select
 * when it changed. A stale revision (409) reloads the review state and keeps
 * everything the owner typed. A pricing failure never undoes a saved identity.
 *
 * Mount it only while open (the parent renders it conditionally), so each opening
 * starts from the review state it was given.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, Modal, Pressable, TextInput, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'
import {
  changedFieldPayload,
  mergeReviewFields,
  mergeReviewValues,
  NO_CANDIDATE,
  parallelFromListingName,
  REVIEW_ALTERNATIVE_FIELD,
  REVIEW_ALTERNATIVE_LABEL,
  REVIEW_MAX_LENGTH,
  reviewOwnerEdited,
  versionPickNeedsSaving,
  type IdentityReviewState,
  type ReviewAlternative,
  type ReviewCandidate,
  type ReviewField,
} from '@/lib/reviewClient'
import {
  dismissIdentityReview,
  loadSetOptions,
  patchCardDetails,
  requestFirstLook,
  selectPricingProduct,
  type SetOption,
} from '@/lib/identityReviewApi'
import SetPickerModal, { type SetChoice } from './SetPickerModal'

interface Props {
  cardId: string
  review: IdentityReviewState
  frontUrl?: string | null
  backUrl?: string | null
  /** Back button, backdrop or the close button. Not a dismissal: the banner stays. */
  onClose: () => void
  /** "Review later" was saved. */
  onDismissed: () => void
  /**
   * Identity saved. The screen refreshes its card the way it already does.
   * `repriced` is true when the save changed what the card is or which version
   * prices it, so the screen should look the price up again.
   */
  onSaved: (card: unknown, info: { repriced: boolean }) => void
  onOpenMoreDetails: () => void
  /** Re-read the review state, for the conflict path. */
  onReload: () => Promise<IdentityReviewState | null>
  /** Ask for a first look in the background when the card has none. */
  fetchFirstLook?: boolean
}

export default function ConfirmCardDetailsSheet({
  cardId,
  review,
  frontUrl,
  backUrl,
  onClose,
  onDismissed,
  onSaved,
  onOpenMoreDetails,
  onReload,
  fetchFirstLook = false,
}: Props) {
  const insets = useSafeAreaInsets()
  const [fields, setFields] = useState<ReviewField[]>(review.fields)
  const [revision, setRevision] = useState<number | null>(review.identity_revision)
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(review.fields.map(f => [f.key, f.value])),
  )
  const [touched, setTouched] = useState<Record<string, true>>({})
  // The background first look resolves long after its effect ran, so it reads
  // the owner's edits through a ref rather than a stale closure.
  const touchedRef = useRef<Record<string, true>>({})
  useEffect(() => { touchedRef.current = touched }, [touched])
  const [candidates, setCandidates] = useState<ReviewCandidate[]>(review.candidates)
  const [candidateId, setCandidateId] = useState<string>(review.suggested_candidate_id || NO_CANDIDATE)
  const [saving, setSaving] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [savedCard, setSavedCard] = useState<unknown | null>(null)
  const savedRepricedRef = useRef(false)
  const [zoom, setZoom] = useState<{ url: string; label: string } | null>(null)
  const scrollRef = useRef<ScrollView | null>(null)

  // Set names from DCM's own card databases (TCG categories only), so the set is
  // spelled the way the catalog and the price lookups spell it.
  const [setOptions, setSetOptions] = useState<SetOption[]>([])
  const [customSet, setCustomSet] = useState(false)
  const [setPickerOpen, setSetPickerOpen] = useState(false)
  useEffect(() => {
    if (review.is_sports || !review.category) return
    let cancelled = false
    loadSetOptions(review.category).then(sets => { if (!cancelled) setSetOptions(sets) })
    return () => { cancelled = true }
  }, [review.is_sports, review.category])

  const changed = useMemo(() => changedFieldPayload(fields, values), [fields, values])
  // What the sheet opened with (DCM's findings). The button reads "Update details"
  // only once the owner moves something away from these, and "Reset to original
  // findings" puts every box and the version pick back.
  const defaultCandidateId = review.suggested_candidate_id || NO_CANDIDATE
  const ownerEdited = reviewOwnerEdited(fields, values, candidateId, defaultCandidateId)
  const resetToFindings = () => {
    setValues(Object.fromEntries(fields.map(f => [f.key, f.value])))
    touchedRef.current = {}
    setTouched({})
    setCandidateId(defaultCandidateId)
    setCustomSet(false)
    setError(null)
  }

  const busy = saving || dismissing
  const requestClose = () => { if (!saving) onClose() }

  /* ---------------- merging a later first look ---------------- */

  /** Adopt new prefill metadata, but never overwrite a box the owner has typed in. */
  const mergeFields = useCallback((incoming: ReviewField[]) => {
    setFields(previous => mergeReviewFields(previous, incoming))
    setValues(previous => mergeReviewValues(previous, incoming, touchedRef.current))
  }, [])

  useEffect(() => {
    if (!fetchFirstLook) return
    let cancelled = false
    setChecking(true)
    requestFirstLook(cardId)
      .then(incoming => { if (!cancelled && incoming) mergeFields(incoming) })
      .finally(() => { if (!cancelled) setChecking(false) })
    return () => { cancelled = true }
  }, [cardId, fetchFirstLook, mergeFields])

  /* ---------------- editing ---------------- */

  const setValue = (key: string, value: string) => {
    touchedRef.current = { ...touchedRef.current, [key]: true }
    setValues(previous => ({ ...previous, [key]: value }))
    setTouched(previous => ({ ...previous, [key]: true }))
  }

  // Picking a version also fills the Parallel box, so Card Information shows it
  // after saving. A parallel the owner typed themselves is left alone.
  const chooseCandidate = (candidate: ReviewCandidate) => {
    setCandidateId(candidate.id)
    if (fields.some(f => f.key === 'parallel_type') && !touched.parallel_type) {
      setValues(previous => ({ ...previous, parallel_type: parallelFromListingName(candidate.name) }))
    }
  }

  // The owner already picked a version for pricing but the card has no parallel on
  // file: start the Parallel box from that pick, as part of the findings (so the
  // button still reads "Looks correct" and saving records it on the card).
  useEffect(() => {
    const picked = review.current_product_id ? review.candidates.find(c => c.id === review.current_product_id) : null
    if (!picked) return
    const derived = parallelFromListingName(picked.name)
    setFields(previous => previous.map(f => (f.key === 'parallel_type' && !f.value ? { ...f, value: derived, origin: 'suggested' as const } : f)))
    setValues(previous => (previous.parallel_type ? previous : { ...previous, parallel_type: derived }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * The set picker. Picking a catalog set also fills an empty Year from that
   * set's release date; "Type a set that is not listed" opens a free-text box so
   * a brand new release or a promo can still be confirmed.
   */
  const chooseSet = (choice: SetChoice) => {
    setSetPickerOpen(false)
    if (choice.kind === 'custom') {
      setCustomSet(true)
      setValue('card_set', '')
      return
    }
    setCustomSet(false)
    if (choice.kind === 'not_sure') {
      setValue('card_set', '')
      return
    }
    setValue('card_set', choice.option.name)
    const year = choice.option.year
    if (year && !(values.release_date || '').trim()) setValue('release_date', year)
  }

  const applyAlternative = (alternative: ReviewAlternative) => {
    const key = REVIEW_ALTERNATIVE_FIELD[alternative.differs_in]
    if (!key || !fields.some(f => f.key === key)) return
    setValue(key, alternative.value)
  }

  /* ---------------- saving ---------------- */

  const showMessageAtBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setNote(null)
    try {
      const body: Record<string, unknown> = { ...changed, confirm: true }
      if (typeof revision === 'number') body.expected_identity_revision = revision

      const result = await patchCardDetails(cardId, body)
      const data = result.data || {}

      if (result.status === 409) {
        const fresh = await onReload()
        if (fresh) {
          mergeFields(fresh.fields)
          setRevision(fresh.identity_revision)
          setCandidates(fresh.candidates)
        }
        setError('This card was updated somewhere else while you were reviewing it. Your entries are still here. Check them once more and save again.')
        showMessageAtBottom()
        return
      }
      if (!result.ok) {
        // 423 (sold lock) carries its own explanation, like every other refusal.
        throw new Error(data?.error || 'We could not save your card details. Please try again.')
      }

      // The identity is saved. A pricing failure from here on is reported softly:
      // it must never look like the correction was lost.
      const identityChanged = Object.keys(changed).length > 0 || data?.pricing_invalidated === true
      savedRepricedRef.current = identityChanged
      if (versionPickNeedsSaving({
        isSports: review.is_sports,
        candidateId,
        currentProductId: review.current_product_id,
        pricingInvalidated: data?.pricing_invalidated === true,
      })) {
        const candidate = candidates.find(c => c.id === candidateId)
        if (candidate) {
          try {
            await selectPricingProduct(cardId, candidate.id, candidate.name)
            savedRepricedRef.current = true
          } catch {
            setSavedCard(data.card ?? {})
            setNote('Your card details are saved. We could not save the version you picked, so you can set that in Market Pricing below.')
            showMessageAtBottom()
            return
          }
        }
      }

      onSaved(data.card, { repriced: savedRepricedRef.current })
    } catch (err: any) {
      setError(err?.message || 'We could not save your card details. Please try again.')
      showMessageAtBottom()
    } finally {
      setSaving(false)
    }
  }

  const reviewLater = async () => {
    setDismissing(true)
    setError(null)
    try {
      await dismissIdentityReview(cardId)
      onDismissed()
    } catch (err: any) {
      setError(err?.message || 'We could not save that. Please try again.')
      showMessageAtBottom()
    } finally {
      setDismissing(false)
    }
  }

  /* ---------------- rendering ---------------- */

  const marker = (field: ReviewField) => {
    if (field.needsCheck) {
      return <View style={[st.marker, st.markerCheck]}><Text style={[st.markerText, { color: Colors.amber[700] }]}>Please check</Text></View>
    }
    if (field.origin === 'read_from_card') {
      return <View style={[st.marker, st.markerRead]}><Text style={[st.markerText, { color: Colors.gray[600] }]}>Read from card</Text></View>
    }
    return null
  }

  const photo = (url: string | null | undefined, label: string) => (
    <View style={{ flex: 1, minWidth: 0 }}>
      {url ? (
        <TouchableOpacity
          onPress={() => setZoom({ url, label })}
          activeOpacity={0.85}
          style={st.photoBox}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Enlarge the ${label.toLowerCase()}`}
        >
          <Image source={url} style={st.photo} contentFit="contain" cachePolicy="memory-disk" transition={150} />
        </TouchableOpacity>
      ) : (
        <View style={[st.photoBox, st.photoEmpty]} />
      )}
      <Text style={st.photoLabel}>{label}</Text>
    </View>
  )

  // A separate touchable (not a nested Text press) so the action gets a finger-sized target.
  const inlineAction = (text: string, action: string, onPress: () => void) => (
    <View style={st.inlineRow}>
      <Text style={[st.hint, { flexShrink: 1 }]}>{text} · </Text>
      <TouchableOpacity onPress={onPress} hitSlop={{ top: 10, bottom: 10, left: 8, right: 12 }} accessibilityRole="button" accessibilityLabel={`${action}: ${text}`}>
        <Text style={[st.hint, st.hintAction]}>{action}</Text>
      </TouchableOpacity>
    </View>
  )

  const setInCatalog = setOptions.some(option => option.name === (values.card_set || ''))
  const serial = values.serial_numbering || ''

  const renderField = (field: ReviewField) => {
    const current = values[field.key] ?? ''
    const useSetPicker = field.key === 'card_set' && setOptions.length > 0
    return (
      <View key={field.key} style={st.field}>
        <View style={st.fieldHead}>
          <Text style={st.fieldLabel}>{field.label.toUpperCase()}</Text>
          {marker(field)}
        </View>

        {/* TCG categories get the game's real set list, from DCM's own set tables.
            "Type a set that is not listed" keeps a new release or a promo confirmable. */}
        {useSetPicker ? (
          <>
            <TouchableOpacity
              style={st.selectBox}
              onPress={() => setSetPickerOpen(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Set: ${customSet ? 'Type a set that is not listed' : current || 'Not sure'}`}
            >
              <Text style={[st.selectText, !current && !customSet && { color: Colors.gray[500] }]} numberOfLines={2}>
                {customSet || (current && !setInCatalog) ? 'Type a set that is not listed' : (current || 'Not sure')}
                {!customSet && setInCatalog ? (() => {
                  const year = setOptions.find(o => o.name === current)?.year
                  return year ? ` (${year})` : ''
                })() : ''}
              </Text>
              <Ionicons name="chevron-down" size={16} color={Colors.gray[500]} />
            </TouchableOpacity>
            {(customSet || (!!current && !setInCatalog)) && (
              <TextInput
                style={[st.input, { marginTop: 8 }]}
                value={current}
                onChangeText={text => setValue('card_set', text)}
                maxLength={200}
                placeholder="Type the set name"
                placeholderTextColor={Colors.gray[400]}
                accessibilityLabel="Set name that is not in the list"
                autoFocus={customSet && !current}
                autoCorrect={false}
              />
            )}
            <Text style={st.hintMuted}>
              {setInCatalog
                ? 'This set is in our catalog.'
                : (current ? 'This set is not in our catalog, so pricing may not find a match.' : `${setOptions.length.toLocaleString()} sets to choose from.`)}
            </Text>
          </>
        ) : (
          <TextInput
            style={st.input}
            value={current}
            onChangeText={text => setValue(field.key, text)}
            maxLength={REVIEW_MAX_LENGTH[field.key] ?? 200}
            placeholder={field.key === 'release_date' ? 'YYYY' : 'Leave blank if you are not sure'}
            placeholderTextColor={Colors.gray[400]}
            keyboardType={field.key === 'release_date' ? 'number-pad' : 'default'}
            autoCorrect={false}
            autoCapitalize={field.key === 'release_date' || field.key === 'serial_numbering' || field.key === 'card_number' ? 'none' : 'words'}
            accessibilityLabel={field.label}
          />
        )}

        {field.catalogNote && current === field.value && (
          <Text style={st.catalogNote}>{field.catalogNote}</Text>
        )}
        {field.displayValue && field.displayValue !== current && (
          <Text style={st.hintMuted}>Printed as {field.displayValue}</Text>
        )}
        {/* A value read off the card replaced what was on file: say so, and make
            the old value one tap away. A transcription can be wrong too. */}
        {field.differsFromStored && !!field.storedValue && field.storedValue !== current && (
          inlineAction(`We had: ${field.storedValue}`, 'Keep that', () => {
            if (field.key === 'card_set') setCustomSet(false)
            setValue(field.key, field.storedValue)
          })
        )}
        {field.suggestion && field.suggestion.value !== current && (
          inlineAction(
            `Possible ${field.label.toLowerCase()} alternative: ${field.suggestion.displayValue || field.suggestion.value}`,
            'Use',
            () => {
              if (field.key === 'card_set') setCustomSet(false)
              setValue(field.key, field.suggestion!.value)
            },
          )
        )}
      </View>
    )
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => { if (zoom) setZoom(null); else requestClose() }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={st.backdrop}>
          <Pressable style={{ height: insets.top + 24 }} onPress={requestClose} accessibilityLabel="Close" />
          <View style={st.sheet}>
            <View style={st.header}>
              <View style={{ flex: 1 }}>
                <Text style={st.title} accessibilityRole="header">Confirm your card details</Text>
                <Text style={st.subtitle}>Check what we have against your photos. Correct anything that is wrong.</Text>
              </View>
              <TouchableOpacity onPress={requestClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={Colors.gray[500]} />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={st.body}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
              <View style={st.photoRow}>
                {photo(frontUrl, 'Front')}
                {photo(backUrl, 'Back')}
              </View>

              {checking && (
                <Text style={st.checking} accessibilityLiveRegion="polite">Checking the card...</Text>
              )}

              {fields.map(renderField)}

              {review.alternatives.length > 0 && (
                <View style={st.panel}>
                  <Text style={st.panelTitle}>Could also be</Text>
                  {review.alternatives.map((alternative, index) => (
                    <View key={`${alternative.differs_in}-${index}`} style={{ marginTop: 4 }}>
                      {REVIEW_ALTERNATIVE_FIELD[alternative.differs_in]
                        ? inlineAction(
                          `${REVIEW_ALTERNATIVE_LABEL[alternative.differs_in] || alternative.differs_in}: ${alternative.value}`,
                          'Use',
                          () => applyAlternative(alternative),
                        )
                        : (
                          <Text style={st.panelText}>
                            {REVIEW_ALTERNATIVE_LABEL[alternative.differs_in] || alternative.differs_in}: {alternative.value}
                          </Text>
                        )}
                      {!!alternative.what_would_settle_it && (
                        <Text style={st.hintMuted}>Check: {alternative.what_would_settle_it}</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {review.is_sports ? (
                <View style={st.panelPlain}>
                  <Text style={st.panelTitle}>Which version is it?</Text>
                  {candidates.length > 0 && serial.includes('/') && (
                    <Text style={[st.panelText, { marginTop: 4 }]}>
                      Your card is numbered <Text style={{ fontWeight: '700', color: Colors.gray[800] }}>{serial}</Text>. Pick the version with that print run (/{serial.split('/').pop()}).
                      {candidates.every(c => !c.serialDenominator) ? ' The catalog does not list print runs for these versions, so go by the name and colour.' : ''}
                    </Text>
                  )}
                  {candidates.length === 0 ? (
                    <Text style={[st.panelText, { marginTop: 4 }]}>
                      {review.candidates_error
                        ? 'We could not load the catalog versions right now. You can pick one in Market Pricing below.'
                        : 'We have no catalog versions for this card yet. You can pick one in Market Pricing below.'}
                    </Text>
                  ) : (
                    <ScrollView style={{ maxHeight: 280, marginTop: 6 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {candidates.map(candidate => {
                        const checked = candidateId === candidate.id
                        const meta = [
                          candidate.setName,
                          candidate.serialDenominator ? `Numbered /${candidate.serialDenominator}` : null,
                          candidate.rawPrice ? `about ${candidate.rawPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} ungraded` : null,
                        ].filter(Boolean).join(' · ')
                        return (
                          <TouchableOpacity
                            key={candidate.id}
                            style={st.radioRow}
                            onPress={() => chooseCandidate(candidate)}
                            activeOpacity={0.7}
                            accessibilityRole="radio"
                            accessibilityState={{ checked }}
                          >
                            <Ionicons name={checked ? 'radio-button-on' : 'radio-button-off'} size={20} color={checked ? Colors.purple[600] : Colors.gray[400]} />
                            <View style={{ flex: 1 }}>
                              <Text style={st.radioName}>{candidate.name}{candidate.isBase ? ' (Base)' : ''}</Text>
                              {!!meta && <Text style={st.radioMeta}>{meta}</Text>}
                            </View>
                          </TouchableOpacity>
                        )
                      })}
                      <TouchableOpacity
                        style={[st.radioRow, st.radioNone]}
                        onPress={() => setCandidateId(NO_CANDIDATE)}
                        activeOpacity={0.7}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: candidateId === NO_CANDIDATE }}
                      >
                        <Ionicons
                          name={candidateId === NO_CANDIDATE ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={candidateId === NO_CANDIDATE ? Colors.purple[600] : Colors.gray[400]}
                        />
                        <Text style={st.radioName}>None of these / not sure</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  )}
                </View>
              ) : null}

              {/* What Market Pricing is matched to, for every category. */}
              <View style={st.panel}>
                <Text style={st.panelTitle}>Market pricing match</Text>
                {review.pricing_match ? (
                  <>
                    <Text style={st.matchName}>{review.pricing_match.product_name}</Text>
                    <Text style={st.hintMuted}>
                      {review.pricing_match.picked_by_owner ? 'You picked this listing.' : 'Matched automatically.'}
                      {' '}If it is not your card, {review.is_sports ? 'pick the right version above.' : 'correct the details here, then choose the right listing in Market Pricing on the card page.'}
                    </Text>
                  </>
                ) : (
                  <Text style={[st.panelText, { marginTop: 4 }]}>
                    No market pricing match yet. Make sure the card name and card number are correct, because pricing is looked up from them.
                  </Text>
                )}
              </View>

              {error && (
                <View style={st.errorBox} accessibilityRole="alert"><Text style={st.errorText}>{error}</Text></View>
              )}
              {note && (
                <View style={st.noteBox}><Text style={st.noteText}>{note}</Text></View>
              )}
            </ScrollView>

            <View style={[st.footer, { paddingBottom: insets.bottom + 12 }]}>
              {savedCard ? (
                <TouchableOpacity style={st.primaryBtn} onPress={() => onSaved(savedCard, { repriced: savedRepricedRef.current })}>
                  <Text style={st.primaryText}>Done</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <View style={st.buttonRow}>
                    <TouchableOpacity style={[st.primaryBtn, { flex: 1 }, busy && st.disabled]} onPress={save} disabled={busy}>
                      {saving
                        ? <View style={st.busyRow}><ActivityIndicator color={Colors.white} size="small" /><Text style={st.primaryText}>Saving...</Text></View>
                        : <Text style={st.primaryText}>{ownerEdited ? 'Update details' : 'Looks correct'}</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={[st.secondaryBtn, busy && st.disabled]} onPress={reviewLater} disabled={busy}>
                      <Text style={st.secondaryText}>{dismissing ? 'Saving...' : 'Review later'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={st.linkRow}>
                    <TouchableOpacity onPress={resetToFindings} disabled={!ownerEdited || busy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={[st.linkText, (!ownerEdited || busy) && { opacity: 0.4, textDecorationLine: 'none' }]}>Reset to original findings</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onOpenMoreDetails} disabled={busy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={st.linkText}>More details</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <SetPickerModal
        visible={setPickerOpen}
        sets={setOptions}
        selected={customSet ? '' : (values.card_set || '')}
        onChoose={chooseSet}
        onClose={() => setSetPickerOpen(false)}
      />

      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable style={st.zoomBackdrop} onPress={() => setZoom(null)} accessibilityLabel={zoom ? `${zoom.label}. Tap to close.` : undefined}>
          {zoom && <Image source={zoom.url} style={st.zoomImage} contentFit="contain" cachePolicy="memory-disk" />}
          <View style={[st.zoomClose, { top: insets.top + 12 }]}>
            <Ionicons name="close" size={26} color={Colors.white} />
          </View>
        </Pressable>
      </Modal>
    </Modal>
  )
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { flex: 1, backgroundColor: Colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.gray[200],
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.gray[900] },
  subtitle: { fontSize: 12, color: Colors.gray[600], marginTop: 2 },
  body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24, gap: 14 },

  photoRow: { flexDirection: 'row', gap: 8 },
  photoBox: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.gray[200], backgroundColor: Colors.gray[50] },
  photo: { width: '100%', height: 170 },
  photoEmpty: { height: 96, borderStyle: 'dashed' },
  photoLabel: { fontSize: 11, color: Colors.gray[500], textAlign: 'center', marginTop: 4 },

  checking: { fontSize: 12, color: Colors.gray[500] },

  field: {},
  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.gray[700], letterSpacing: 0.4, flexShrink: 1 },
  marker: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  markerCheck: { backgroundColor: Colors.amber[50], borderColor: Colors.amber[200] },
  markerRead: { backgroundColor: Colors.gray[100], borderColor: Colors.gray[200] },
  markerText: { fontSize: 11, fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: Colors.gray[300], borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15, color: Colors.gray[900], backgroundColor: Colors.white,
  },
  selectBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.gray[300], borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 11, backgroundColor: Colors.white,
  },
  selectText: { flex: 1, fontSize: 15, color: Colors.gray[900] },
  catalogNote: { fontSize: 11, fontWeight: '600', color: Colors.green[700], marginTop: 4 },
  inlineRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 4 },
  hint: { fontSize: 12, color: Colors.gray[600], lineHeight: 18 },
  hintMuted: { fontSize: 11, color: Colors.gray[500], marginTop: 4 },
  hintAction: { fontWeight: '700', color: Colors.gray[800], textDecorationLine: 'underline' },

  panel: { borderRadius: 8, borderWidth: 1, borderColor: Colors.gray[200], backgroundColor: Colors.gray[50], padding: 12 },
  panelPlain: { borderRadius: 8, borderWidth: 1, borderColor: Colors.gray[200], padding: 12 },
  panelTitle: { fontSize: 12, fontWeight: '700', color: Colors.gray[700] },
  panelText: { fontSize: 12, color: Colors.gray[600], lineHeight: 18 },
  matchName: { fontSize: 14, color: Colors.gray[900], marginTop: 4 },

  radioRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8 },
  radioNone: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.gray[200], marginTop: 2 },
  radioName: { fontSize: 13, fontWeight: '600', color: Colors.gray[800] },
  radioMeta: { fontSize: 12, color: Colors.gray[500], marginTop: 1 },

  errorBox: { borderRadius: 8, borderWidth: 1, borderColor: Colors.red[200], backgroundColor: Colors.red[50], padding: 12 },
  errorText: { fontSize: 13, color: Colors.red[700] },
  noteBox: { borderRadius: 8, borderWidth: 1, borderColor: Colors.gray[200], backgroundColor: Colors.gray[50], padding: 12 },
  noteText: { fontSize: 13, color: Colors.gray[700] },

  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.gray[200], paddingHorizontal: 16, paddingTop: 10, backgroundColor: Colors.white },
  buttonRow: { flexDirection: 'row', gap: 8 },
  primaryBtn: { backgroundColor: Colors.purple[600], borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  secondaryBtn: { borderWidth: 1, borderColor: Colors.gray[300], borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: Colors.gray[700], fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  linkRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 10 },
  linkText: { fontSize: 12, color: Colors.gray[600], textDecorationLine: 'underline' },

  zoomBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  zoomImage: { width: '100%', height: '100%' },
  zoomClose: { position: 'absolute', right: 16 },
})
