/**
 * Card notes box + saved notes profiles + "use for every card" lock, for the
 * review screen's condition step. Profiles are shared with the web
 * (/api/user/notes-profiles); the lock lives in the grading run.
 */

import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'
import {
  fetchNotesProfiles,
  saveNotesProfile,
  deleteNotesProfile,
  type NotesProfile,
  type RunNotesLock,
} from '@/lib/gradingRun'

interface Props {
  value: string
  onChange: (text: string) => void
  lockedNotes: RunNotesLock | null
  onLock: (notes: RunNotesLock) => void
  onUnlock: () => void
}

export default function CardNotesField({ value, onChange, lockedNotes, onLock, onUnlock }: Props) {
  const { session } = useAuth()
  const token = session?.access_token
  const [profiles, setProfiles] = useState<NotesProfile[]>([])
  const [available, setAvailable] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(lockedNotes?.profileId ?? null)
  const [naming, setNaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchNotesProfiles(token).then(r => {
      if (cancelled) return
      setProfiles(r.profiles)
      setAvailable(r.available)
    })
    return () => { cancelled = true }
  }, [token])

  const selected = profiles.find(p => p.id === selectedId) || null

  const apply = (p: NotesProfile) => {
    setSelectedId(p.id)
    setMessage(null)
    onChange(p.text.slice(0, 500))
  }

  const handleSave = async () => {
    setBusy(true)
    const r = await saveNotesProfile(token, { name: newName, text: value })
    setBusy(false)
    if (r.error || !r.saved || !r.profiles) {
      setMessage({ error: true, text: r.error || 'Could not save the profile.' })
      return
    }
    setProfiles(r.profiles)
    setSelectedId(r.saved.id)
    setNaming(false)
    setNewName('')
    setMessage({ error: false, text: `Saved "${r.saved.name}".` })
  }

  const handleDelete = async () => {
    if (!selected) return
    setBusy(true)
    const r = await deleteNotesProfile(token, selected.id)
    setBusy(false)
    if (r.error || !r.profiles) {
      setMessage({ error: true, text: r.error || 'Could not delete the profile.' })
      return
    }
    setProfiles(r.profiles)
    setSelectedId(null)
    setMessage({ error: false, text: `Deleted "${selected.name}".` })
  }

  const handleLock = () => {
    const text = value.trim()
    if (!text) return
    const fromProfile = selected && selected.text.trim() === text ? selected : null
    onLock({ profileId: fromProfile?.id ?? null, name: fromProfile?.name ?? 'Custom notes', text })
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Card Notes (Optional)</Text>
      <Text style={styles.hint}>Art style, finish, serial numbering — anything that could be mistaken for damage.</Text>

      {available && profiles.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {profiles.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, selectedId === p.id && styles.chipActive]}
              onPress={() => apply(p)}
              accessibilityRole="button"
              accessibilityLabel={`Use notes profile ${p.name}`}
            >
              <Text style={[styles.chipText, selectedId === p.id && styles.chipTextActive]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <TextInput
        style={styles.input}
        placeholder="E.g., 'Refractor finish with a rainbow sheen — not surface damage'"
        placeholderTextColor={Colors.gray[400]}
        value={value}
        onChangeText={(t) => onChange(t.slice(0, 500))}
        multiline
        maxLength={500}
      />
      <Text style={styles.count}>{value.length}/500</Text>

      {naming ? (
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.nameInput]}
            placeholder="Profile name, e.g. Topps Chrome Refractor"
            placeholderTextColor={Colors.gray[400]}
            value={newName}
            onChangeText={(t) => setNewName(t.slice(0, 60))}
            autoFocus
          />
          <TouchableOpacity style={styles.smallBtn} onPress={handleSave} disabled={busy || !newName.trim()}>
            <Text style={styles.smallBtnText}>{busy ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setNaming(false); setNewName('') }}>
            <Text style={styles.linkMuted}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.row}>
          {available && !!value.trim() && (
            <TouchableOpacity onPress={() => { setNaming(true); setNewName(selected?.name ?? ''); setMessage(null) }} disabled={busy}>
              <Text style={styles.link}>Save as profile</Text>
            </TouchableOpacity>
          )}
          {available && selected && (
            <TouchableOpacity onPress={handleDelete} disabled={busy}>
              <Text style={styles.linkDanger}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {lockedNotes ? (
        <View style={styles.lockChip}>
          <Ionicons name="lock-closed" size={13} color={Colors.purple[700]} />
          <Text style={styles.lockChipText} numberOfLines={1}>Notes locked: {lockedNotes.name}</Text>
          <TouchableOpacity onPress={onUnlock} accessibilityLabel="Unlock notes" hitSlop={8}>
            <Ionicons name="close" size={16} color={Colors.purple[700]} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={handleLock} disabled={!value.trim()} style={styles.lockBtn}>
          <Ionicons name="lock-closed-outline" size={14} color={value.trim() ? Colors.purple[600] : Colors.gray[400]} />
          <Text style={[styles.link, !value.trim() && { color: Colors.gray[400] }]}>Use these notes for every card</Text>
        </TouchableOpacity>
      )}

      {message && <Text style={[styles.message, message.error && { color: Colors.red[600] }]}>{message.text}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.gray[200], padding: 12, marginTop: 12 },
  title: { fontSize: 14, fontWeight: '700', color: Colors.gray[900] },
  hint: { fontSize: 12, color: Colors.gray[500], marginTop: 2, marginBottom: 8 },
  chips: { gap: 8, paddingBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: Colors.gray[300], backgroundColor: Colors.white },
  chipActive: { backgroundColor: Colors.purple[600], borderColor: Colors.purple[600] },
  chipText: { fontSize: 13, color: Colors.gray[700], fontWeight: '500' },
  chipTextActive: { color: Colors.white, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: Colors.gray[300], borderRadius: 8, padding: 10, fontSize: 14, color: Colors.gray[900], minHeight: 70, textAlignVertical: 'top' },
  nameInput: { flex: 1, minHeight: 0 },
  count: { fontSize: 11, color: Colors.gray[400], textAlign: 'right', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
  smallBtn: { backgroundColor: Colors.purple[600], borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  smallBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  link: { fontSize: 13, fontWeight: '600', color: Colors.purple[600] },
  linkMuted: { fontSize: 13, fontWeight: '600', color: Colors.gray[500] },
  linkDanger: { fontSize: 13, fontWeight: '600', color: Colors.red[600] },
  lockBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  lockChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: Colors.purple[50], borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, marginTop: 10, maxWidth: '100%' },
  lockChipText: { fontSize: 12, fontWeight: '700', color: Colors.purple[700], flexShrink: 1 },
  message: { fontSize: 12, color: Colors.green[600], marginTop: 6 },
})
