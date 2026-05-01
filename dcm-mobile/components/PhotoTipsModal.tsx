import { useState, useEffect } from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Colors } from '@/lib/constants'

const STORAGE_KEY = 'dcm_hide_photo_tips'

const TIPS: Array<{ icon: string; text: string }> = [
  { icon: '☀️', text: 'Use natural lighting or a bright, diffused light source' },
  { icon: '⚡', text: 'Avoid flash photography that creates glare' },
  { icon: '📐', text: 'Keep the card flat and parallel to the camera' },
  { icon: '🔓', text: 'Remove from holders if possible for clearest images' },
  { icon: '🔍', text: 'Fill the frame with the card, leaving minimal background' },
  { icon: '✨', text: 'Ensure the entire card is in sharp focus' },
  { icon: '🎨', text: 'Use a contrasting, solid-color background' },
]

interface PhotoTipsModalProps {
  visible: boolean
  onCancel: () => void
  onProceed: () => void
}

export default function PhotoTipsModal({ visible, onCancel, onProceed }: PhotoTipsModalProps) {
  const [hideForever, setHideForever] = useState(false)

  useEffect(() => {
    if (visible) setHideForever(false)
  }, [visible])

  const persistChoiceIfNeeded = async () => {
    if (hideForever) await AsyncStorage.setItem(STORAGE_KEY, 'true')
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={st.backdrop}>
        <View style={st.card}>
          {/* Header */}
          <LinearGradient
            colors={['#4f46e5', '#7c3aed']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={st.header}
          >
            <View style={st.iconBubble}>
              <Text style={{ fontSize: 22 }}>💡</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.title}>Pro Tip</Text>
              <Text style={st.subtitle}>Getting an A-Grade Confidence Rating</Text>
            </View>
          </LinearGradient>

          {/* Tips */}
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={st.tipsList}>
            {TIPS.map((t, i) => (
              <View key={i} style={st.tipRow}>
                <Text style={st.tipIcon}>{t.icon}</Text>
                <Text style={st.tipText}>{t.text}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Don't show again checkbox */}
          <Pressable
            style={st.checkboxRow}
            onPress={() => setHideForever(v => !v)}
          >
            <View style={[st.checkbox, hideForever && st.checkboxChecked]}>
              {hideForever && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={st.checkboxLabel}>Don't show this again</Text>
          </Pressable>

          {/* Buttons */}
          <View style={st.btnRow}>
            <TouchableOpacity
              style={[st.btn, st.btnCancel]}
              onPress={async () => { await persistChoiceIfNeeded(); onCancel() }}
            >
              <Text style={st.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.btn, st.btnProceed]}
              onPress={async () => { await persistChoiceIfNeeded(); onProceed() }}
            >
              <LinearGradient
                colors={['#4f46e5', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={st.btnGradient}
              >
                <Text style={st.btnProceedText}>Got it, proceed</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

/** Helper: returns true if the user hasn't ticked "don't show again". */
export async function shouldShowPhotoTips(): Promise<boolean> {
  const v = await AsyncStorage.getItem(STORAGE_KEY)
  return v !== 'true'
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  header: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBubble: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontWeight: '800', fontSize: 16 },
  subtitle: { color: '#e0e7ff', fontSize: 12, marginTop: 1 },
  tipsList: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  tipIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  tipText: { flex: 1, fontSize: 13, color: Colors.gray[700], lineHeight: 18 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.gray[100] },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.gray[300], backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: Colors.purple[600], borderColor: Colors.purple[600] },
  checkboxLabel: { fontSize: 13, color: Colors.gray[700] },
  btnRow: { flexDirection: 'row', gap: 8, padding: 12 },
  btn: { flex: 1, height: 44, borderRadius: 10, overflow: 'hidden' },
  btnCancel: { backgroundColor: Colors.gray[100], borderWidth: 1, borderColor: Colors.gray[200], alignItems: 'center', justifyContent: 'center' },
  btnCancelText: { fontSize: 14, fontWeight: '600', color: Colors.gray[700] },
  btnProceed: {},
  btnGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  btnProceedText: { fontSize: 14, fontWeight: '700', color: '#fff' },
})
