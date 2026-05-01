import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Easing, ScrollView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef } from 'react'
import { useGradingQueue, GradingStage } from '@/contexts/GradingQueueContext'
import { Colors } from '@/lib/constants'

const STAGE_CONFIG: Record<GradingStage, { label: string; short: string; tint: string }> = {
  uploading:   { label: 'Uploading',                  short: 'Upload',    tint: '#60a5fa' },
  queued:      { label: 'Queued',                     short: 'Queue',     tint: '#facc15' },
  identifying: { label: 'Identifying',                short: 'ID',        tint: '#fb923c' },
  grading:     { label: 'DCM Optic™ Analyzing',       short: 'Analyzing', tint: '#c084fc' },
  calculating: { label: 'Calculating Grade',          short: 'Calculate', tint: '#818cf8' },
  saving:      { label: 'Saving Results',             short: 'Save',      tint: '#22d3ee' },
  slow:        { label: 'Taking Longer…',             short: 'Slow',      tint: '#fbbf24' },
  completed:   { label: 'Complete',                   short: 'Done',      tint: '#34d399' },
  error:       { label: 'Error',                      short: 'Error',     tint: '#f87171' },
}

function getStageMessage(stage: GradingStage, cardName?: string): string {
  switch (stage) {
    case 'uploading':   return 'Uploading images…'
    case 'queued':      return 'In queue, starting soon…'
    case 'identifying': return cardName ? `Identifying: ${cardName}` : 'Identifying card…'
    case 'grading':     return 'DCM Optic™ analyzing condition…'
    case 'calculating': return 'Computing final grade…'
    case 'saving':      return 'Saving results…'
    case 'slow':        return 'Still processing — taking longer than usual…'
    case 'completed':   return 'Grading complete!'
    case 'error':       return 'Took too long — your card may be ready in My Collection.'
  }
}

export default function GradingStatusBar() {
  const { queue, removeFromQueue, clearCompleted } = useGradingQueue()
  const [expanded, setExpanded] = useState(false)
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const pulse = useRef(new Animated.Value(0.4)).current

  // Filter out completed cards older than 5 minutes
  const active = queue.filter(c => {
    if (c.status === 'completed' && c.completedAt) return Date.now() - c.completedAt < 5 * 60 * 1000
    return true
  })

  // Pulse animation on the live indicator
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])

  if (active.length === 0) return null

  const processing = active.filter(c => c.status === 'processing' || c.status === 'uploading')
  const completed = active.filter(c => c.status === 'completed')
  const errored = active.filter(c => c.status === 'error')
  const first = processing[0]
  const displayProgress = first?.progress ?? 0

  return (
    <LinearGradient colors={['#4f46e5', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.wrap, { paddingTop: insets.top }]}>
      {/* Animated progress bar (only while processing) */}
      {first && (
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${displayProgress}%` }]} />
        </View>
      )}

      {/* Collapsed summary */}
      <TouchableOpacity activeOpacity={0.85} onPress={() => setExpanded(v => !v)} style={styles.summaryRow}>
        <View style={styles.summaryLeft}>
          {processing.length > 0 && (
            <View style={styles.summaryItem}>
              <Animated.View style={[styles.dot, { backgroundColor: first ? STAGE_CONFIG[first.stage].tint : '#34d399', opacity: pulse }]} />
              <Text style={styles.summaryText}>
                {processing.length === 1 && first
                  ? `${STAGE_CONFIG[first.stage].label}… ${Math.round(displayProgress)}%`
                  : `${processing.length} cards grading… ${Math.round(displayProgress)}%`}
              </Text>
            </View>
          )}
          {completed.length > 0 && (
            <View style={styles.summaryItem}>
              <View style={[styles.dot, { backgroundColor: '#34d399' }]} />
              <Text style={styles.summaryText}>{completed.length} ready</Text>
            </View>
          )}
          {errored.length > 0 && (
            <View style={styles.summaryItem}>
              <View style={[styles.dot, { backgroundColor: '#f87171' }]} />
              <Text style={styles.summaryText}>{errored.length} need attention</Text>
            </View>
          )}
        </View>
        <View style={styles.summaryRight}>
          {completed.length > 0 && (
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); clearCompleted() }} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Clear {completed.length}</Text>
            </TouchableOpacity>
          )}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* Expanded list */}
      {expanded && (
        <ScrollView style={styles.expandedScroll} contentContainerStyle={{ paddingBottom: 8 }}>
          {active.map(card => {
            const cfg = STAGE_CONFIG[card.stage]
            return (
              <View key={card.id} style={styles.cardRow}>
                <View style={styles.thumb}>
                  {card.frontImageUrl
                    ? <Image source={{ uri: card.frontImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    : <Ionicons name="image" size={20} color="rgba(255,255,255,0.4)" />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{card.cardName || card.category}</Text>
                    <View style={[styles.stageChip, { backgroundColor: `${cfg.tint}33`, borderColor: cfg.tint }]}>
                      <Text style={[styles.stageChipText, { color: '#fff' }]}>{cfg.short}</Text>
                    </View>
                  </View>
                  {(card.status === 'processing' || card.status === 'uploading') && (
                    <View style={styles.miniProgressTrack}>
                      <View style={[styles.miniProgressFill, { width: `${card.progress}%` }]} />
                    </View>
                  )}
                  <Text style={styles.cardSub} numberOfLines={2}>
                    {card.status === 'error' ? (card.errorMessage || cfg.label) : getStageMessage(card.stage, card.cardName)}
                    {card.estimatedTimeRemaining != null && card.status === 'processing' ? ` · ~${card.estimatedTimeRemaining}s left` : ''}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {card.status === 'completed' && card.resultPath && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#10b981' }]}
                      onPress={() => router.push(card.resultPath as any)}
                    >
                      <Text style={styles.actionBtnText}>View</Text>
                    </TouchableOpacity>
                  )}
                  {card.status === 'error' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}
                      onPress={() => router.push('/(tabs)/collection' as any)}
                    >
                      <Text style={styles.actionBtnText}>Collection</Text>
                    </TouchableOpacity>
                  )}
                  {(card.status === 'completed' || card.status === 'error') && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
                      onPress={() => removeFromQueue(card.id)}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.18 : 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  progressTrack: { height: 3, backgroundColor: 'rgba(0,0,0,0.25)' },
  progressFill: { height: '100%', backgroundColor: '#34d399' },
  summaryRow: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  summaryText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  summaryRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 6 },
  clearBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  expandedScroll: { maxHeight: 320, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(0,0,0,0.18)' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  thumb: { width: 40, height: 56, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  cardName: { color: '#fff', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  cardSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 4 },
  stageChip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, borderWidth: 1 },
  stageChipText: { fontSize: 9, fontWeight: '700' },
  miniProgressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 4 },
  miniProgressFill: { height: '100%', backgroundColor: '#34d399', borderRadius: 2 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
})
