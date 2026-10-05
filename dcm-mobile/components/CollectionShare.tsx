import { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, Modal, TouchableOpacity, ActivityIndicator, Share, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/lib/constants'
import Button from '@/components/ui/Button'
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'

export default function CollectionShare() {
  const { user } = useAuth()
  const owner = useRef(user?.id)
  owner.current = user?.id
  const generation = useRef(0)
  const saving = useRef(false)
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { generation.current++; setOpen(false); setUsername(null); setDraft(''); setLoaded(false); return () => { generation.current++ } }, [user?.id])
  const request = async (method: 'GET' | 'POST') => {
    if (saving.current) return
    const epoch = generation.current
    const userId = owner.current
    saving.current = true; setBusy(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || session.user.id !== userId) throw Error('Please sign in again.')
      const response = await fetch(`${API_BASE}/api/profile/username`, {
        method, headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: JSON.stringify({ username: draft.trim() }) } : {}),
      })
      const data = await response.json()
      if (epoch !== generation.current || userId !== owner.current) return
      if (!response.ok) throw Error(data.error || 'Unable to load collection sharing.')
      setUsername(data.username || null); setLoaded(true)
    } catch (reason) {
      if (epoch === generation.current) setError(reason instanceof Error ? reason.message : 'Please retry.')
    } finally { saving.current = false; if (epoch === generation.current) setBusy(false) }
  }
  const url = username ? `${API_BASE}/collection/${encodeURIComponent(username)}` : ''
  return <>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Share collection" style={s.trigger} onPress={() => { setOpen(true); void request('GET') }}><Text style={s.triggerText}>Share Collection</Text></TouchableOpacity>
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!busy) setOpen(false) }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }}>
          <Text accessibilityRole="header" style={s.title}>Share your collection</Text>
          <Text style={s.body}>Your public collection link shows cards marked public. Private cards stay private. Change an individual card’s visibility from its report before sharing.</Text>
          {busy && <ActivityIndicator accessibilityLabel="Loading collection sharing" />}
          {loaded && !username && <>
            <Text style={s.body}>Choose a collection name for your public link.</Text>
            <TextInput accessibilityLabel="Collection name" value={draft} onChangeText={setDraft} editable={!busy} maxLength={50} autoCapitalize="none" autoCorrect={false} style={s.input} placeholder="my-card-collection" />
            <Button title="Create Collection Link" disabled={busy || !draft.trim()} onPress={() => void request('POST')} />
          </>}
          {!!username && <>
            <Text selectable style={s.body}>{url}</Text>
            <Button title="Share Link" onPress={() => { void Share.share({ message: `View my DCM collection: ${url}`, ...(Platform.OS === 'ios' ? { url } : {}) }).catch(() => setError('Unable to open sharing. Please try again.')) }} />
          </>}
          {!!error && <Text accessibilityRole="alert" style={[s.body, { color: Colors.red[600] }]}>{error}</Text>}
          {!loaded && !busy && <Button title="Retry" onPress={() => void request('GET')} />}
          <Button title="Close" variant="secondary" disabled={busy} onPress={() => setOpen(false)} style={{ marginTop: 16 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  </>
}
const s = StyleSheet.create({
  trigger: { alignSelf: 'flex-end', marginHorizontal: 16, marginVertical: 6, paddingHorizontal: 14, paddingVertical: 12, minHeight: 44 },
  triggerText: { color: Colors.purple[700], fontWeight: '600', fontSize: 14 }, title: { fontSize: 24, color: Colors.gray[900], fontWeight: '700', marginBottom: 16 },
  body: { fontSize: 16, lineHeight: 24, color: Colors.gray[700], marginVertical: 12 }, input: { borderWidth: 1, borderColor: Colors.gray[300], borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
})
