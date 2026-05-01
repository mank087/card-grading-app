import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState, useCallback } from 'react'
import { Colors } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useUserEmblems } from '@/hooks/useUserEmblems'

/**
 * LabelBadgesPicker — mirrors the web's "Label Badges" panel from
 * src/app/labels/LabelStudioClient.tsx (lines 2585–2697). Three checkbox
 * tiles (Founder ★, VIP ◆, Card Lovers ♥) with these states:
 *   - Entitled + selected:    colored bg + checkmark
 *   - Entitled + unselected:  white bg, hover border
 *   - Entitled + at-limit:    greyed (max 2 active)
 *   - Not entitled:           greyed + "Founders only" / "VIP package only" / "Subscribers only"
 *
 * Persists to user_credits.preferred_label_emblem (same column the web writes
 * via /api/user/label-emblem-preference) so the choice round-trips with web.
 */

type EmblemKey = 'founder' | 'vip' | 'card_lover'

const MAX_BADGES = 2

export default function LabelBadgesPicker() {
  const { user } = useAuth()
  const emblems = useUserEmblems()
  const [selected, setSelected] = useState<Set<EmblemKey>>(new Set())
  const [loaded, setLoaded] = useState(false)

  // Hydrate from the entitlements hook once it loads
  useEffect(() => {
    if (!emblems.loading && !loaded) {
      setSelected(new Set(emblems.selectedEmblems as EmblemKey[]))
      setLoaded(true)
    }
  }, [emblems.loading, emblems.selectedEmblems, loaded])

  const persist = useCallback(async (next: Set<EmblemKey>) => {
    if (!user?.id) return
    const csv = Array.from(next).join(',')
    const { error } = await supabase
      .from('user_credits')
      .update({ preferred_label_emblem: csv || 'none' })
      .eq('user_id', user.id)
    if (error) console.warn('[LabelBadgesPicker] save error:', error.message)
  }, [user?.id])

  const toggle = (key: EmblemKey, entitled: boolean) => {
    if (!entitled) return
    const next = new Set(selected)
    if (next.has(key)) {
      next.delete(key)
    } else {
      if (next.size >= MAX_BADGES) {
        Alert.alert('Maximum reached', `You can apply at most ${MAX_BADGES} badges to a label. Deselect one to choose a different badge.`)
        return
      }
      next.add(key)
    }
    setSelected(next)
    persist(next)
  }

  const atLimit = selected.size >= MAX_BADGES
  const anyEntitlement = emblems.isFounder || emblems.isVip || emblems.isCardLover

  const Tile = ({ keyId, entitled, label, icon, iconColor, gateText, activeBg, activeBorder }: {
    keyId: EmblemKey
    entitled: boolean
    label: string
    icon: string
    iconColor: string
    gateText: string
    activeBg: string
    activeBorder: string
  }) => {
    const isOn = selected.has(keyId)
    const disabled = !entitled || (atLimit && !isOn)
    return (
      <TouchableOpacity
        style={[
          st.tile,
          isOn && entitled && { backgroundColor: activeBg, borderColor: activeBorder },
          disabled && st.tileDisabled,
        ]}
        onPress={() => toggle(keyId, entitled)}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <View style={[st.checkbox, isOn && entitled && { backgroundColor: iconColor, borderColor: iconColor }]}>
          {isOn && entitled && <Ionicons name="checkmark" size={11} color="#fff" />}
        </View>
        <Text style={{ fontSize: 16, color: iconColor }}>{icon}</Text>
        <Text style={st.tileLabel}>{label}</Text>
        {!entitled && <Text style={st.tileGate}>{gateText}</Text>}
      </TouchableOpacity>
    )
  }

  return (
    <View style={st.card}>
      <View style={st.header}>
        <Ionicons name="bookmark" size={14} color={Colors.purple[600]} />
        <Text style={st.title}>Label Badges</Text>
        <Text style={st.subtitle}>Show on back of labels (max 2)</Text>
      </View>
      <View style={st.row}>
        <Tile keyId="founder" entitled={emblems.isFounder} label="Founder" icon="★" iconColor="#d97706" gateText="Founders only" activeBg="#fef9c3" activeBorder="#fde047" />
        <Tile keyId="vip" entitled={emblems.isVip} label="VIP" icon="◆" iconColor="#6366f1" gateText="VIP package only" activeBg="#eef2ff" activeBorder="#c7d2fe" />
        <Tile keyId="card_lover" entitled={emblems.isCardLover} label="Card Lovers" icon="♥" iconColor="#f43f5e" gateText="Subscribers only" activeBg="#ffe4e6" activeBorder="#fda4af" />
      </View>
      {atLimit && <Text style={st.limitNote}>Maximum of 2 badges can be applied to labels. Deselect one to choose a different badge.</Text>}
      {!anyEntitlement && <Text style={st.gateNote}>Badge emblems are available for Founder, VIP, and Card Lovers subscribers.</Text>}
    </View>
  )
}

const st = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 12, padding: 12, marginHorizontal: 12, marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  title: { fontSize: 13, fontWeight: '700', color: Colors.gray[900] },
  subtitle: { fontSize: 11, color: Colors.gray[400] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 8, backgroundColor: '#fff' },
  tileDisabled: { backgroundColor: Colors.gray[50], opacity: 0.55 },
  checkbox: { width: 14, height: 14, borderRadius: 3, borderWidth: 1, borderColor: Colors.gray[300], backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 12, fontWeight: '600', color: Colors.gray[700] },
  tileGate: { fontSize: 9, fontStyle: 'italic', color: Colors.gray[400], marginLeft: 2 },
  limitNote: { fontSize: 11, color: Colors.amber[600], marginTop: 8 },
  gateNote: { fontSize: 11, color: Colors.gray[400], marginTop: 8 },
})
