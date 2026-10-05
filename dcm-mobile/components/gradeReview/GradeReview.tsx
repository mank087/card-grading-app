import { useState, useRef, useEffect, useCallback } from 'react'
import { View, Text, Modal, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, AppState } from 'react-native'
import { useIsFocused } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/lib/constants'
import { buildReviewRequest, detailsFields, GRADE_REVIEW_NOTE_MIN, reviewStatusLabels, type ReviewState, type DetailsClaim } from '@/lib/gradeReview'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'
export default function GradeReview({ cardId, ownerId, onChanged }: { cardId: string; ownerId: string | undefined; onChanged: () => unknown }) {
  const { user } = useAuth()
  const focused = useIsFocused()
  const insets = useSafeAreaInsets()
  const [state, setState] = useState<ReviewState | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [grade, setGrade] = useState(true)
  const [details, setDetails] = useState(false)
  const [note, setNote] = useState('')
  const [claim, setClaim] = useState<DetailsClaim>({})
  const inFlight = useRef(false)
  const generation = useRef(0)
  const activeOwner = useRef(user?.id)
  activeOwner.current = user?.id
  const load = useCallback(async () => {
    if (!ownerId || activeOwner.current !== ownerId) return
    const epoch = generation.current
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user.id !== ownerId) return
      const response = await fetch(`${API_BASE}/api/cards/${cardId}/grade-review`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!response.ok) throw Error('Unable to load review details. Please retry.')
      const result = await response.json()
      if (epoch === generation.current && activeOwner.current === ownerId) { setState(result); setError('') }
    } catch (reason) {
      if (epoch === generation.current && activeOwner.current === ownerId) setError(reason instanceof Error ? reason.message : 'Unable to load review details.')
    }
  }, [cardId, ownerId])
  useEffect(() => {
    generation.current++; setState(null); setOpen(false); setClaim({}); setNote(''); setBusy(false)
    if (user?.id === ownerId) void load()
    return () => { generation.current++ }
  }, [cardId, ownerId, user?.id, load])
  useEffect(() => {
    if (!focused) return
    void load()
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') void load() })
    const timer = ['queued', 'processing'].includes(state?.review?.status ?? '')
      ? setInterval(() => { if (AppState.currentState === 'active') void load() }, 20000) : null
    return () => { subscription.remove(); if (timer) clearInterval(timer) }
  }, [focused, state?.review?.status, load])

  const mutate = async (decision?: 'accept' | 'keep_original') => {
    if (inFlight.current || !state) return
    inFlight.current = true; setBusy(true); setError('')
    const epoch = generation.current
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !ownerId || session.user.id !== ownerId || activeOwner.current !== ownerId) throw Error('Please sign in as the card owner.')
      const body = decision ? { reviewId: state.review?.id, decision } : buildReviewRequest(state, grade, details, note, claim)
      const response = await fetch(`${API_BASE}/api/cards/${cardId}/grade-review${decision ? '/decision' : ''}`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const result = await response.json()
      if (epoch !== generation.current || activeOwner.current !== ownerId) return
      if (!response.ok) throw Error(result.error || 'Unable to save your request. Please retry.')
      if (result.review) setState(previous => previous ? { ...previous, eligible: false, review: result.review } : previous)
      await load()
      if (decision) { setOpen(false); onChanged() }
    } catch (reason) {
      if (epoch === generation.current && activeOwner.current === ownerId) setError(reason instanceof Error ? reason.message : 'Unable to save your request.')
    } finally { inFlight.current = false; if (epoch === generation.current) setBusy(false) }
  }
  if (!ownerId || user?.id !== ownerId) return null
  if (!state) return error ? <TouchableOpacity onPress={() => void load()} accessibilityRole="button" style={s.box}><Text style={s.body}>Review details unavailable. Tap to retry.</Text></TouchableOpacity> : null
  if (!state.enabled && !state.review) return null
  const review = state.review
  const canStart = !!(state.eligible || state.detailsEligible || review)
  let valid = false
  try { buildReviewRequest(state, grade, details, note, claim); valid = true } catch { /* Show validation in form copy until submission. */ }
  const close = () => { if (!inFlight.current) setOpen(false) }
  const action = (label: string, onPress: () => void, disabled = false, secondary = false) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, secondary && s.secondary, disabled && { opacity: 0.5 }]}><Text style={[s.buttonText, secondary && { color: Colors.purple[700] }]}>{label}</Text></TouchableOpacity>
  return <View style={s.box}>
    {action(review ? 'View Grade Review' : state.eligible ? 'Request Grade Review' : 'Fix Card Details', () => {
      setGrade(!!state.eligible && state.identificationConfidence !== 'low')
      setDetails(!!state.detailsEligible && (!state.eligible || state.identificationConfidence === 'low'))
      setError(''); setOpen(true)
    }, !canStart, true)}
    <Text style={s.body}>{review ? reviewStatusLabels[review.status] : state.eligible ? 'One complimentary manual review is included with this grade.' : state.detailsEligible ? 'Card-detail corrections are free for every owner.' : 'Review is unavailable for this grade.'}</Text>
    <Modal visible={open} onRequestClose={close} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}>
          <Text accessibilityRole="header" style={s.title}>{review ? 'Grade Review' : 'Request a Review'}</Text>
          {review ? <>
            <Text accessibilityLiveRegion="polite" style={s.heading}>{reviewStatusLabels[review.status]}</Text>
            <Text style={s.body}>Requested {new Date(review.requested_at).toLocaleString()}</Text>
            {!!review.note && <Text style={s.body}>Your note: {review.note}</Text>}
            {!!review.details_claim && <><Text style={s.heading}>Card details you reported</Text>{Object.entries(review.details_claim).map(([key, value]) => <Text key={key} style={s.body}>{detailsFields[key as keyof typeof detailsFields] || key}: {value}</Text>)}</>}
            {!!review.details_changes?.length && <><Text style={s.heading}>Card details corrected</Text>{review.details_changes.map(change => <Text key={change.field} style={s.body}>{detailsFields[change.field as keyof typeof detailsFields] || change.field}: {change.from || '(blank)'} → {change.to || '(none)'}</Text>)}</>}
            {review.proposed_grade != null && <>
              <Text style={s.heading}>Overall grade: {review.original_grade} → {review.proposed_grade}</Text>
              {review.changes?.map(change => <Text key={`${change.category}-${change.side}`} style={s.body}>{change.category} ({change.side}): {change.from} → {change.to}</Text>)}
            </>}
            <Text style={s.body}>{review.customer_result || 'Your request is saved. Your current grade remains in place while the review is pending.'}</Text>
            {review.status === 'awaiting_owner' && <>
              <Text style={s.body}>Accept the proposed grade or keep the original. Either choice completes this review. Downloaded files, printed labels, and active eBay listings need to be regenerated or updated separately.</Text>
              {action('Accept Grade Change', () => void mutate('accept'), busy)}
              {action('Keep Original Grade', () => void mutate('keep_original'), busy, true)}
            </>}
            {review.status === 'completed' && action('Refresh card and report', () => { close(); onChanged() }, busy, true)}
          </> : <>
            <Text style={s.body}>Our team checks your original photos and report. Reviews can take up to two business days; we will email you when your card has been evaluated.</Text>
            <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: grade && state.eligible, disabled: !state.eligible || busy }} disabled={!state.eligible || busy} onPress={() => setGrade(value => !value)} style={s.choice}>
              <Text style={s.heading}>{grade && state.eligible ? '☑' : '☐'} Review the grade</Text>
              <Text style={s.body}>{state.eligible ? 'Re-check centering, corners, edges, and surface on both sides.' : 'Grade reviews are available to VIP purchasers and active Card Lovers members.'}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: details, disabled: !state.detailsEligible || busy }} disabled={!state.detailsEligible || busy} onPress={() => setDetails(value => !value)} style={s.choice}>
              <Text style={s.heading}>{details ? '☑' : '☐'} Correct card details</Text>
              <Text style={s.body}>Corrections also refresh the market value. Enter only the fields that are wrong.</Text>
            </TouchableOpacity>
            {details && Object.entries(detailsFields).map(([key, label]) => <View key={key}>
              <Text style={s.heading}>{label}</Text>
              <TextInput accessibilityLabel={`Correct ${label.toLowerCase()}`} editable={!busy} maxLength={200} value={claim[key as keyof DetailsClaim] || ''} onChangeText={value => setClaim(previous => ({ ...previous, [key]: value }))} style={s.input} />
            </View>)}
            <Text style={s.heading}>{grade && state.eligible ? 'What looks wrong? (required)' : 'Additional details (optional)'}</Text>
            <TextInput accessibilityLabel="Review note" multiline editable={!busy} maxLength={1000} value={note} onChangeText={setNote} style={[s.input, { minHeight: 110, textAlignVertical: 'top' }]} placeholder="For example, the back top-left corner looks sharp but the report describes wear." />
            {grade && state.eligible && <Text style={s.body}>At least {GRADE_REVIEW_NOTE_MIN} characters; {note.trim().length} entered.</Text>}
            <Text style={s.body}>A proposed grade change needs your approval. The team may clarify the report without changing the grade.</Text>
            {action(busy ? 'Submitting…' : 'Submit Review Request', () => void mutate(), busy || !valid)}
          </>}
          {!!error && <Text accessibilityRole="alert" style={[s.body, { color: Colors.red[600] }]}>{error}</Text>}
          {busy && <ActivityIndicator accessibilityLabel="Saving review" />}
          {action('Close', close, busy, true)}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  </View>
}
const s = StyleSheet.create({
  box: { padding: 16, gap: 8, backgroundColor: Colors.purple[50] }, title: { fontSize: 23, fontWeight: '700', marginBottom: 16, color: Colors.gray[900] },
  heading: { fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 6, color: Colors.gray[900] }, body: { fontSize: 14, lineHeight: 21, marginBottom: 10, color: Colors.gray[700] },
  button: { padding: 14, minHeight: 48, borderRadius: 10, marginVertical: 6, backgroundColor: Colors.purple[700] }, secondary: { backgroundColor: Colors.purple[50], borderWidth: 1, borderColor: Colors.purple[300] },
  buttonText: { color: '#fff', textAlign: 'center', fontSize: 15, fontWeight: '600' }, choice: { padding: 12, borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 10, marginBottom: 10 },
  input: { padding: 12, borderWidth: 1, borderColor: Colors.gray[300], borderRadius: 8, fontSize: 16, color: Colors.gray[900], marginBottom: 8 },
})
