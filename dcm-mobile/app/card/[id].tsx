import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Image, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/lib/constants'
import GradeBadge from '@/components/ui/GradeBadge'

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [card, setCard] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [frontUrl, setFrontUrl] = useState<string | null>(null)
  const [backUrl, setBackUrl] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCard() {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        console.error('Card fetch error:', error)
        setIsLoading(false)
        return
      }

      setCard(data)

      // Get signed URLs
      const paths = [data.front_path, data.back_path].filter(Boolean)
      if (paths.length > 0) {
        const { data: urls } = await supabase.storage.from('cards').createSignedUrls(paths, 3600)
        urls?.forEach(u => {
          if (u.path === data.front_path) setFrontUrl(u.signedUrl)
          if (u.path === data.back_path) setBackUrl(u.signedUrl)
        })
      }

      setIsLoading(false)
    }
    if (id) fetchCard()
  }, [id])

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.purple[600]} />
      </View>
    )
  }

  if (!card) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Card not found</Text>
      </View>
    )
  }

  const subScores = card.conversational_weighted_sub_scores
  const ci = card.conversational_card_info

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Card Images */}
      <View style={styles.imageRow}>
        {frontUrl && <Image source={{ uri: frontUrl }} style={styles.cardImage} resizeMode="contain" />}
        {backUrl && <Image source={{ uri: backUrl }} style={styles.cardImage} resizeMode="contain" />}
      </View>

      {/* Grade */}
      <View style={styles.gradeSection}>
        <GradeBadge grade={card.conversational_whole_grade} size="lg" showLabel />
      </View>

      {/* Card Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Card Information</Text>
        <InfoRow label="Name" value={card.card_name || ci?.card_name} />
        <InfoRow label="Set" value={card.card_set || ci?.set_name} />
        <InfoRow label="Number" value={card.card_number || ci?.card_number} />
        <InfoRow label="Year" value={card.release_date || ci?.year} />
        <InfoRow label="Category" value={card.category} />
        <InfoRow label="Serial" value={card.serial} />
      </View>

      {/* Subgrades */}
      {subScores && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subgrades</Text>
          <SubgradeRow label="Centering" score={subScores.centering} />
          <SubgradeRow label="Corners" score={subScores.corners} />
          <SubgradeRow label="Edges" score={subScores.edges} />
          <SubgradeRow label="Surface" score={subScores.surface} />
          {card.conversational_limiting_factor && (
            <Text style={styles.limitingFactor}>
              Limiting factor: {card.conversational_limiting_factor}
            </Text>
          )}
        </View>
      )}

      {/* Condition */}
      <View style={styles.section}>
        <InfoRow label="Condition" value={card.conversational_condition_label} />
        <InfoRow label="Confidence" value={card.conversational_image_confidence ? `Grade ${card.conversational_image_confidence}` : null} />
      </View>
    </ScrollView>
  )
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || 'N/A'}</Text>
    </View>
  )
}

function SubgradeRow({ label, score }: { label: string; score: number | null }) {
  const barWidth = score ? `${(score / 10) * 100}%` : '0%'
  const color = score && score >= 9 ? Colors.green[500] : score && score >= 7 ? Colors.blue[500] : Colors.amber[500]

  return (
    <View style={styles.subgradeRow}>
      <Text style={styles.subgradeLabel}>{label}</Text>
      <View style={styles.subgradeBar}>
        <View style={[styles.subgradeFill, { width: barWidth as any, backgroundColor: color }]} />
      </View>
      <Text style={styles.subgradeScore}>{score ?? 'N/A'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.gray[50] },
  errorText: { color: Colors.gray[500], fontSize: 16 },
  imageRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 20 },
  cardImage: { width: 150, height: 210, borderRadius: 8 },
  gradeSection: { alignItems: 'center', marginBottom: 20 },
  section: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray[900], marginBottom: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  infoLabel: { fontSize: 14, color: Colors.gray[500] },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.gray[900] },
  subgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  subgradeLabel: { fontSize: 13, color: Colors.gray[600], width: 72 },
  subgradeBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.gray[200],
    borderRadius: 4,
    overflow: 'hidden',
  },
  subgradeFill: { height: '100%', borderRadius: 4 },
  subgradeScore: { fontSize: 14, fontWeight: '700', color: Colors.gray[900], width: 28, textAlign: 'right' },
  limitingFactor: {
    fontSize: 12,
    color: Colors.amber[600],
    fontStyle: 'italic',
    marginTop: 8,
    textTransform: 'capitalize',
  },
})
