/**
 * Proposed grade change from a manual review, at the top of the card screen.
 *
 * Mirrors src/components/grade-review/PendingGradeChangeBanner.tsx on the web
 * (Sept 2026). The app had no grade-review screen at all, so an owner who got
 * the "Review and decide on your card" email and opened the card in the app
 * had no way to accept. Same endpoints as the web:
 *   GET  /api/cards/[id]/grade-review           -> { review: { status, ... } }
 *   POST /api/cards/[id]/grade-review/decision  { reviewId, decision }
 * Shown only to the owner, only while the review is awaiting their decision.
 */
import { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { supabase } from '@/lib/supabase'
import { API_BASE } from '@/lib/identityReviewApi'
import { Colors } from '@/lib/constants'

type ReviewChange = { category: string; side: string; from: number; to: number }
type PendingReview = {
  id: string
  status: string
  original_grade?: number | null
  proposed_grade?: number | null
  customer_result?: string | null
  changes?: ReviewChange[]
}

const CATEGORY_LABELS: Record<string, string> = {
  centering: 'Centering', corners: 'Corners', edges: 'Edges', surface: 'Surface',
}

async function token(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch {
    return null
  }
}

export default function PendingGradeChangeBanner({ cardId, isOwner, onDecided }: {
  cardId: string | undefined
  isOwner: boolean
  /** Reload the card so the new (or kept) grade is on screen. */
  onDecided: () => void
}) {
  const [review, setReview] = useState<PendingReview | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setReview(null)
    if (!cardId || !isOwner) return
    const access = await token()
    if (!access) return
    try {
      const response = await fetch(`${API_BASE}/api/cards/${cardId}/grade-review`, {
        headers: { Authorization: `Bearer ${access}` },
      })
      if (!response.ok) return
      const data = await response.json()
      const r = data?.review as PendingReview | undefined
      if (r?.status === 'awaiting_owner' && r.proposed_grade != null) setReview(r)
    } catch { /* Stay hidden; nothing else on the screen depends on this. */ }
  }, [cardId, isOwner])

  useEffect(() => { load() }, [load])

  const decide = useCallback(async (decision: 'accept' | 'keep_original') => {
    if (!review || !cardId || busy) return
    setBusy(true)
    try {
      const access = await token()
      if (!access) throw new Error('Please sign in again to save your decision.')
      const response = await fetch(`${API_BASE}/api/cards/${cardId}/grade-review/decision`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: review.id, decision }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || 'Unable to save your decision.')
      setReview(null)
      onDecided()
    } catch (err) {
      Alert.alert('Grade review', err instanceof Error ? err.message : 'Unable to save your decision.')
    } finally {
      setBusy(false)
    }
  }, [review, cardId, busy, onDecided])

  const confirm = (decision: 'accept' | 'keep_original') => {
    if (!review) return
    const grade = decision === 'accept' ? review.proposed_grade : review.original_grade
    Alert.alert(
      decision === 'accept' ? `Accept grade ${grade}?` : `Keep your original ${grade}?`,
      decision === 'accept'
        ? 'Your grade, report and label update to the new grade. Labels you already printed and live eBay listings keep the old grade until you regenerate them.'
        : 'Your grade stays as it is. This completes your review.',
      [{ text: 'Cancel', style: 'cancel' }, { text: decision === 'accept' ? 'Accept' : 'Keep original', onPress: () => decide(decision) }],
    )
  }

  if (!review) return null

  return (
    <View style={s.box} accessibilityLabel="Grade review decision">
      <Text style={s.eyebrow}>MANUAL GRADE REVIEW · YOUR DECISION NEEDED</Text>
      <Text style={s.title}>
        We propose changing this grade from {review.original_grade} to {review.proposed_grade}
      </Text>
      {review.changes?.length ? review.changes.map(c => (
        <Text key={`${c.category}-${c.side}`} style={s.change}>
          • {CATEGORY_LABELS[c.category] ?? c.category} ({c.side}): {c.from} → {c.to}
        </Text>
      )) : null}
      {review.customer_result ? (
        <View style={{ marginTop: 8 }}>
          <Text style={s.noteTitle}>Note from the DCM review team</Text>
          <Text style={s.note}>{review.customer_result}</Text>
        </View>
      ) : null}
      <View style={s.actions}>
        <TouchableOpacity style={[s.primary, busy && s.disabled]} disabled={busy} onPress={() => confirm('accept')}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Accept grade {review.proposed_grade}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[s.secondary, busy && s.disabled]} disabled={busy} onPress={() => confirm('keep_original')}>
          <Text style={s.secondaryText}>Keep original {review.original_grade}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  box: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 4, padding: 16, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.purple[300] ?? '#d8b4fe', backgroundColor: Colors.purple[50] ?? '#faf5ff',
  },
  eyebrow: { fontSize: 11, fontWeight: '700', color: Colors.purple[700] ?? '#7e22ce', letterSpacing: 0.4 },
  title: { marginTop: 4, fontSize: 18, fontWeight: '700', color: '#111827' },
  change: { marginTop: 4, fontSize: 14, color: '#1f2937' },
  noteTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  note: { marginTop: 2, fontSize: 14, color: '#374151' },
  actions: { marginTop: 14, gap: 10 },
  primary: { backgroundColor: Colors.purple[700] ?? '#7e22ce', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: { backgroundColor: '#fff', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#d1d5db' },
  secondaryText: { color: '#1f2937', fontWeight: '600', fontSize: 16 },
  disabled: { opacity: 0.5 },
})
