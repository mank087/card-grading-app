import React, { useState } from 'react'
import { View, Text, Modal, Pressable, TextInput, StyleSheet } from 'react-native'
import { Colors } from '@/lib/constants'

/**
 * Mark-as-sold dialog for the app, matching the web fields.
 *
 * The app previously marked sales with no price at all, so anything recorded
 * from a phone was a second-class record — the realized-value data this whole
 * feature exists to capture was silently missing.
 *
 * The date is a plain text field rather than a native picker on purpose: a
 * date-picker package is a NATIVE module, which would force a store build and
 * break the over-the-air path this feature ships on. It defaults to today, so
 * most people never touch it.
 */
export interface SaleDetails {
  sold_price?: string
  sold_at?: string
  sold_note?: string
}

const today = () => new Date().toISOString().slice(0, 10)

export default function MarkAsSoldModal({
  visible,
  cardName,
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean
  cardName: string
  busy: boolean
  onCancel: () => void
  onConfirm: (details: SaleDetails) => void
}) {
  const [price, setPrice] = useState('')
  const [soldAt, setSoldAt] = useState(today())
  const [note, setNote] = useState('')

  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(soldAt) &&
    !isNaN(new Date(soldAt).getTime()) &&
    new Date(soldAt).getTime() <= Date.now() + 86400000

  const submit = () => {
    if (busy || !dateValid) return
    onConfirm({
      sold_price: price.trim() || undefined,
      sold_at: soldAt ? new Date(soldAt).toISOString() : undefined,
      sold_note: note.trim() || undefined,
    })
    setPrice(''); setSoldAt(today()); setNote('')
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={s.backdrop} onPress={onCancel}>
        <Pressable style={s.card} onPress={() => {}}>
          <Text style={s.title}>Mark as sold</Text>
          <Text style={s.sub} numberOfLines={1}>{cardName}</Text>

          <View style={s.keepBox}>
            <Text style={s.keepTxt}>
              It leaves your collection and the eBay listing picker, but its grade page
              stays online so the buyer can still scan the label and verify it.
            </Text>
          </View>

          <Text style={s.label}>Sale price (optional)</Text>
          <TextInput
            value={price}
            onChangeText={(t) => setPrice(t.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            placeholderTextColor={Colors.gray[400]}
            keyboardType="decimal-pad"
            style={s.input}
          />

          <Text style={s.label}>Sale date</Text>
          <TextInput
            value={soldAt}
            onChangeText={setSoldAt}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.gray[400]}
            style={[s.input, !dateValid && s.inputBad]}
            autoCapitalize="none"
          />
          {!dateValid && <Text style={s.err}>Use YYYY-MM-DD, and not a future date.</Text>}

          <Text style={s.label}>Note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={(t) => setNote(t.slice(0, 200))}
            placeholder="e.g. Sold at the Portland show"
            placeholderTextColor={Colors.gray[400]}
            style={s.input}
          />

          <View style={s.row}>
            <Pressable
              onPress={submit}
              disabled={busy || !dateValid}
              style={[s.primary, (busy || !dateValid) && { opacity: 0.5 }]}
            >
              <Text style={s.primaryTxt}>{busy ? 'Saving…' : 'Mark as sold'}</Text>
            </Pressable>
            <Pressable onPress={onCancel} disabled={busy} style={s.cancel}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 22 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  title: { fontSize: 17, fontWeight: '800', color: Colors.gray[900] },
  sub: { fontSize: 13, color: Colors.gray[600], marginTop: 2 },
  keepBox: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  keepTxt: { fontSize: 12, color: '#047857', lineHeight: 17 },
  label: { fontSize: 11, fontWeight: '700', color: Colors.gray[600], marginTop: 14, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: Colors.gray[300], borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: Colors.gray[900] },
  inputBad: { borderColor: '#dc2626' },
  err: { fontSize: 11, color: '#dc2626', marginTop: 4 },
  row: { flexDirection: 'row', gap: 8, marginTop: 18 },
  primary: { flex: 1, backgroundColor: '#059669', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancel: { paddingHorizontal: 18, backgroundColor: Colors.gray[100], borderRadius: 10, paddingVertical: 12, justifyContent: 'center' },
  cancelTxt: { color: Colors.gray[700], fontWeight: '700', fontSize: 15 },
})
