/**
 * The InstaList seller-terms gate, as a modal.
 *
 * The single-card wizard shows these terms inline as a review step; a batch has
 * no such step — publishing is one button — so the same copy, the same tick box
 * and the same POST are presented as a gate in front of it. The server enforces
 * this either way (publish answers 412 `disclaimer_required`, and the drain
 * PAUSES a running batch for it), so this exists to give the seller somewhere
 * to say yes rather than to be the check itself.
 *
 * `onAccepted` fires only after acceptDisclaimer() has actually returned, so a
 * caller can safely go straight on to publishing or resuming.
 */

import { useEffect, useState } from 'react'
import {
  View, Text, Modal, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Colors } from '@/lib/constants'
import { acceptDisclaimer } from '@/lib/ebayApi'
import {
  DISCLAIMER_SECTIONS, DISCLAIMER_VERSION_LINE, DISCLAIMER_INTRO, DISCLAIMER_CONSENT,
} from '@/lib/ebayDisclaimer'

interface Props {
  visible: boolean
  onClose: () => void
  /** Terms accepted and recorded — carry on with whatever was blocked. */
  onAccepted: () => void
}

export default function SellerTermsGate({ visible, onClose, onAccepted }: Props) {
  const insets = useSafeAreaInsets()
  const [checked, setChecked] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A fresh open starts unticked — an accept that failed must be deliberately
  // agreed to again, not one tap away from a stale checkbox.
  useEffect(() => {
    if (visible) { setChecked(false); setError(null) }
  }, [visible])

  const handleAccept = async () => {
    if (!checked || accepting) return
    setAccepting(true)
    setError(null)
    try {
      await acceptDisclaimer()
      onAccepted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record your acceptance. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>eBay Listing Terms &amp; Conditions</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close the seller terms"
          >
            <Ionicons name="close" size={24} color={Colors.gray[600]} />
          </TouchableOpacity>
        </View>

        <Text style={styles.subhead}>Please review and accept before listing on eBay.</Text>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Text style={styles.intro}>{DISCLAIMER_INTRO}</Text>
          {DISCLAIMER_SECTIONS.map(section => (
            <View key={section.heading} style={{ marginBottom: 10 }}>
              <Text style={styles.heading}>{section.heading}</Text>
              <Text style={styles.text}>{section.body}</Text>
            </View>
          ))}
          <Text style={styles.version}>{DISCLAIMER_VERSION_LINE}</Text>
        </ScrollView>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={[styles.footer, { paddingBottom: 12 + Math.max(insets.bottom, 4) }]}>
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setChecked(v => !v)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel="I agree to the eBay listing terms"
          >
            <Ionicons
              name={checked ? 'checkbox' : 'square-outline'}
              size={22}
              color={checked ? Colors.purple[600] : Colors.gray[400]}
            />
            <Text style={styles.checkText}>{DISCLAIMER_CONSENT}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptBtn, (!checked || accepting) && styles.btnDisabled]}
            onPress={handleAccept}
            disabled={!checked || accepting}
            accessibilityRole="button"
            accessibilityLabel="Accept the seller terms and continue"
          >
            {accepting
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.acceptBtnText}>Accept &amp; Continue</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[200],
  },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: Colors.gray[900] },
  subhead: { fontSize: 11, color: Colors.gray[500], paddingHorizontal: 16, paddingTop: 10 },

  body: { flex: 1, marginTop: 8 },
  bodyContent: { paddingHorizontal: 16, paddingBottom: 16 },
  intro: { fontSize: 12, fontWeight: '700', color: Colors.gray[900], marginBottom: 10 },
  heading: { fontSize: 11, fontWeight: '700', color: Colors.gray[900], marginBottom: 2 },
  text: { fontSize: 11, color: Colors.gray[700], lineHeight: 16 },
  version: {
    fontSize: 9, color: Colors.gray[500], marginTop: 4,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.gray[200],
  },

  errorBanner: { backgroundColor: Colors.red[50], paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { fontSize: 11, color: Colors.red[700], lineHeight: 15 },

  footer: {
    paddingHorizontal: 16, paddingTop: 12, gap: 12,
    borderTopWidth: 1, borderTopColor: Colors.gray[200], backgroundColor: Colors.white,
  },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkText: { flex: 1, fontSize: 12, color: Colors.gray[700], lineHeight: 17 },
  acceptBtn: {
    backgroundColor: Colors.purple[600], borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  acceptBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  btnDisabled: { opacity: 0.4 },
})
