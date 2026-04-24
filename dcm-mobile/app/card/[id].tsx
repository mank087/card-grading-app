import { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, Image, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, Share, Alert, RefreshControl } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Colors, GradeColors, ConditionLabels, ConfidenceColors } from '@/lib/constants'
import { Card } from '@/lib/types'
import GradeBadge from '@/components/ui/GradeBadge'
import SubgradeBar from '@/components/grading/SubgradeBar'
import CollapsibleSection from '@/components/ui/CollapsibleSection'
import SlabCard from '@/components/grading/SlabCard'
import CornerZoomGrid from '@/components/grading/CornerZoomGrid'
import DefectOverlay, { extractDefectMarkers } from '@/components/grading/DefectOverlay'

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { session } = useAuth()
  const [card, setCard] = useState<Card | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [frontUrl, setFrontUrl] = useState<string | null>(null)
  const [backUrl, setBackUrl] = useState<string | null>(null)
  const [activeImage, setActiveImage] = useState<'front' | 'back'>('front')

  const fetchCard = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      console.error('Card fetch error:', error)
      setIsLoading(false)
      setRefreshing(false)
      return
    }

    setCard(data as Card)

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
    setRefreshing(false)
  }, [id])

  useEffect(() => { fetchCard() }, [fetchCard])

  const onRefresh = () => {
    setRefreshing(true)
    fetchCard()
  }

  if (isLoading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.purple[600]} /></View>
  }

  if (!card) {
    return <View style={styles.loading}><Text style={styles.errorText}>Card not found</Text></View>
  }

  const subScores = card.conversational_weighted_sub_scores
  const ci = card.conversational_card_info
  const centering = card.conversational_centering
  const grade = card.conversational_whole_grade
  const limitingFactor = card.conversational_limiting_factor?.toLowerCase()
  const isOwner = session?.user?.id === card.user_id

  const cardName = card.card_name || ci?.card_name || `Card #${card.serial}`
  const setName = card.card_set || ci?.set_name || 'Unknown Set'
  const cardNumber = card.card_number || ci?.card_number || ''
  const year = card.release_date || ci?.year || ''

  const handleShare = async () => {
    const categoryPath = card.category?.toLowerCase().replace(' ', '') || 'other'
    const url = `https://dcmgrading.com/${categoryPath}/${card.id}`
    await Share.share({
      message: `Check out this ${cardName} graded ${grade}/10 by DCM! ${url}`,
      url,
    })
  }

  const handleToggleVisibility = () => {
    const newVis = card.visibility === 'public' ? 'private' : 'public'
    Alert.alert(
      `Make ${newVis}?`,
      newVis === 'public'
        ? 'This card will be visible on your public collection and in search results.'
        : 'This card will be hidden from public view.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Make ${newVis}`,
          onPress: async () => {
            const { error } = await supabase.from('cards').update({ visibility: newVis }).eq('id', card.id)
            if (!error) setCard({ ...card, visibility: newVis })
          }
        },
      ]
    )
  }

  const handleRefreshPrices = async () => {
    if (!session?.access_token) return
    try {
      const API = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'
      await fetch(`${API}/api/ebay/prices`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: card.id }),
      })
      // Refetch card to get updated prices
      fetchCard()
    } catch (err) {
      console.error('Price refresh error:', err)
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.purple[600]} />}
    >
      {/* ======== GRADED SLAB CARDS ======== */}
      <View style={styles.imageSection}>
        <View style={styles.imageToggle}>
          <TouchableOpacity
            style={[styles.imageToggleBtn, activeImage === 'front' && styles.imageToggleActive]}
            onPress={() => setActiveImage('front')}
          >
            <Text style={[styles.imageToggleText, activeImage === 'front' && styles.imageToggleTextActive]}>Front</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.imageToggleBtn, activeImage === 'back' && styles.imageToggleActive]}
            onPress={() => setActiveImage('back')}
          >
            <Text style={[styles.imageToggleText, activeImage === 'back' && styles.imageToggleTextActive]}>Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.slabContainer}>
          <View style={{ position: 'relative' }}>
            <SlabCard
              imageUrl={activeImage === 'front' ? frontUrl : backUrl}
              displayName={cardName}
              contextLine={[setName, cardNumber ? `#${cardNumber}` : null, year].filter(Boolean).join(' \u2022 ')}
              serial={card.serial}
              grade={grade}
              condition={card.conversational_condition_label || ''}
              features={ci?.rarity_or_variant ? [ci.rarity_or_variant] : []}
              size="lg"
              isBack={activeImage === 'back'}
              subScores={subScores}
            />
            {/* Defect overlay on the image portion */}
            {card.conversational_grading && (
              <View style={styles.defectOverlayWrapper}>
                <DefectOverlay
                  defects={extractDefectMarkers(card.conversational_grading, activeImage)}
                />
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ======== GRADE HEADER ======== */}
      <View style={styles.gradeHeader}>
        <GradeBadge grade={grade} size="lg" showLabel />
        <View style={styles.gradeMetaRow}>
          {card.conversational_image_confidence && (
            <View style={[styles.confidenceBadge, { backgroundColor: ConfidenceColors[card.conversational_image_confidence]?.bg || Colors.gray[100] }]}>
              <Text style={[styles.confidenceText, { color: ConfidenceColors[card.conversational_image_confidence]?.text || Colors.gray[600] }]}>
                Confidence {card.conversational_image_confidence}
              </Text>
            </View>
          )}
          {card.conversational_grade_uncertainty && (
            <Text style={styles.uncertaintyText}>{card.conversational_grade_uncertainty}</Text>
          )}
        </View>
      </View>

      {/* ======== CARD INFO ======== */}
      <View style={styles.section}>
        <Text style={styles.cardTitle}>{cardName}</Text>
        <Text style={styles.cardSubtitle}>
          {[setName, cardNumber ? `#${cardNumber}` : null, year].filter(Boolean).join(' \u2022 ')}
        </Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{card.category}</Text>
        </View>
        <View style={styles.serialRow}>
          <Text style={styles.serialLabel}>DCM Serial</Text>
          <Text style={styles.serialValue}>{card.serial}</Text>
        </View>
      </View>

      {/* ======== SUBGRADES ======== */}
      {subScores && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subgrades</Text>
          <SubgradeBar label="Centering" score={subScores.centering} isLimiting={limitingFactor === 'centering'} />
          <SubgradeBar label="Corners" score={subScores.corners} isLimiting={limitingFactor === 'corners'} />
          <SubgradeBar label="Edges" score={subScores.edges} isLimiting={limitingFactor === 'edges'} />
          <SubgradeBar label="Surface" score={subScores.surface} isLimiting={limitingFactor === 'surface'} />
        </View>
      )}

      {/* ======== CENTERING RATIOS ======== */}
      {centering && (
        <CollapsibleSection title="Centering Ratios" icon="resize">
          <View style={styles.centeringGrid}>
            <View style={styles.centeringHalf}>
              <Text style={styles.centeringSide}>Front</Text>
              <InfoRow label="L/R" value={centering.front_left_right || centering.front_lr || 'N/A'} />
              <InfoRow label="T/B" value={centering.front_top_bottom || centering.front_tb || 'N/A'} />
              {centering.front_quality_tier && <Text style={styles.centeringTier}>{centering.front_quality_tier}</Text>}
            </View>
            <View style={styles.centeringDivider} />
            <View style={styles.centeringHalf}>
              <Text style={styles.centeringSide}>Back</Text>
              <InfoRow label="L/R" value={centering.back_left_right || centering.back_lr || 'N/A'} />
              <InfoRow label="T/B" value={centering.back_top_bottom || centering.back_tb || 'N/A'} />
              {centering.back_quality_tier && <Text style={styles.centeringTier}>{centering.back_quality_tier}</Text>}
            </View>
          </View>
        </CollapsibleSection>
      )}

      {/* ======== CONDITION ANALYSIS ======== */}
      {(card.conversational_front_summary || card.conversational_back_summary) && (
        <CollapsibleSection title="Condition Analysis" icon="search">
          {card.conversational_front_summary && (
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>Front</Text>
              <Text style={styles.summaryText}>{card.conversational_front_summary}</Text>
            </View>
          )}
          {card.conversational_back_summary && (
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>Back</Text>
              <Text style={styles.summaryText}>{card.conversational_back_summary}</Text>
            </View>
          )}
        </CollapsibleSection>
      )}

      {/* ======== DEFECT DETAILS ======== */}
      {(card.conversational_defects_front || card.conversational_defects_back) && (
        <CollapsibleSection title="Defect Details" icon="alert-circle">
          {card.conversational_defects_front && (
            <DefectSection side="Front" defects={card.conversational_defects_front} />
          )}
          {card.conversational_defects_back && (
            <DefectSection side="Back" defects={card.conversational_defects_back} />
          )}
        </CollapsibleSection>
      )}

      {/* ======== CORNER ZOOM ======== */}
      {frontUrl && !card.slab_detected && (
        <CollapsibleSection title="Corner Close-ups" icon="scan">
          {frontUrl && <CornerZoomGrid imageUrl={frontUrl} side="Front" />}
          {backUrl && <View style={{ marginTop: 12 }}><CornerZoomGrid imageUrl={backUrl} side="Back" /></View>}
        </CollapsibleSection>
      )}

      {/* ======== PROFESSIONAL GRADE ESTIMATES ======== */}
      {card.estimated_professional_grades && (
        <CollapsibleSection title="Estimated Mail-Away Grades" icon="ribbon">
          {['PSA', 'BGS', 'SGC', 'CGC'].map(company => {
            const est = (card.estimated_professional_grades as any)?.[company]
            if (!est) return null
            return (
              <View key={company} style={styles.proGradeRow}>
                <Text style={styles.proGradeCompany}>{company}</Text>
                <View style={styles.proGradeRight}>
                  <Text style={styles.proGradeValue}>{est.estimated_grade}</Text>
                  <View style={[styles.proConfBadge, {
                    backgroundColor: est.confidence === 'high' ? Colors.green[50] : est.confidence === 'medium' ? Colors.amber[50] : Colors.red[50]
                  }]}>
                    <Text style={[styles.proConfText, {
                      color: est.confidence === 'high' ? Colors.green[600] : est.confidence === 'medium' ? Colors.amber[600] : Colors.red[600]
                    }]}>{est.confidence?.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            )
          })}
        </CollapsibleSection>
      )}

      {/* ======== MARKET PRICING ======== */}
      {(card.ebay_price_median || card.dcm_price_estimate) && (
        <CollapsibleSection title="Market Pricing" icon="trending-up" defaultOpen>
          {card.ebay_price_median && (
            <View>
              <Text style={styles.pricingSource}>eBay Comparable Sales</Text>
              <View style={styles.priceGrid}>
                <PriceCell label="Lowest" value={card.ebay_price_lowest} />
                <PriceCell label="Median" value={card.ebay_price_median} />
                <PriceCell label="Average" value={card.ebay_price_average} />
                <PriceCell label="Highest" value={card.ebay_price_highest} />
              </View>
              {card.ebay_price_listing_count && (
                <Text style={styles.listingCount}>{card.ebay_price_listing_count} listings found</Text>
              )}
              {card.ebay_price_updated_at && (
                <Text style={styles.priceUpdated}>Updated: {new Date(card.ebay_price_updated_at).toLocaleDateString()}</Text>
              )}
              <TouchableOpacity style={styles.refreshBtn} onPress={handleRefreshPrices}>
                <Ionicons name="refresh" size={14} color={Colors.purple[600]} />
                <Text style={styles.refreshText}>Refresh Prices</Text>
              </TouchableOpacity>
            </View>
          )}
          {card.dcm_price_estimate && (
            <View style={{ marginTop: card.ebay_price_median ? 16 : 0 }}>
              <Text style={styles.pricingSource}>DCM Price Estimate</Text>
              <Text style={styles.dcmPrice}>${card.dcm_price_estimate.toFixed(2)}</Text>
            </View>
          )}
        </CollapsibleSection>
      )}

      {/* ======== CARD ACTIONS ======== */}
      {isOwner && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionGrid}>
            <ActionButton icon="share-social" label="Share" onPress={handleShare} />
            <ActionButton
              icon={card.visibility === 'public' ? 'eye' : 'eye-off'}
              label={card.visibility === 'public' ? 'Public' : 'Private'}
              onPress={handleToggleVisibility}
            />
            <ActionButton icon="open" label="View on Web" onPress={() => {
              const catPath = card.category?.toLowerCase().replace(' ', '') || 'other'
              Linking.openURL(`https://dcmgrading.com/${catPath}/${card.id}`)
            }} />
            <ActionButton icon="pricetags" label="Labels" onPress={() => {
              router.push('/pages/label-studio' as any)
            }} />
          </View>
        </View>
      )}

      {/* ======== EVALUATION DETAILS ======== */}
      <CollapsibleSection title="Evaluation Details" icon="information-circle">
        <InfoRow label="Prompt Version" value={card.conversational_prompt_version} />
        <InfoRow label="Graded On" value={card.created_at ? new Date(card.created_at).toLocaleDateString() : 'N/A'} />
        <InfoRow label="Category" value={card.category} />
        <InfoRow label="Visibility" value={card.visibility} />
        {card.conversational_case_detection?.case_type && card.conversational_case_detection.case_type !== 'none' && (
          <InfoRow label="Case Detected" value={card.conversational_case_detection.case_type} />
        )}
        {card.slab_company && <InfoRow label="Slab Company" value={card.slab_company} />}
        {card.slab_grade && <InfoRow label="Slab Grade" value={card.slab_grade} />}
      </CollapsibleSection>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || 'N/A'}</Text>
    </View>
  )
}

function PriceCell({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.priceCell}>
      <Text style={styles.priceCellLabel}>{label}</Text>
      <Text style={styles.priceCellValue}>{value != null ? `$${value.toFixed(2)}` : '—'}</Text>
    </View>
  )
}

function ActionButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={20} color={Colors.purple[600]} />
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

function DefectSection({ side, defects }: { side: string; defects: any }) {
  const areas = ['corners', 'edges', 'surface']
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.defectSideLabel}>{side}</Text>
      {areas.map(area => {
        const areaData = defects[area]
        if (!areaData) return null

        // Handle array format (defects[].description)
        if (Array.isArray(areaData.defects) && areaData.defects.length > 0) {
          return (
            <View key={area} style={styles.defectArea}>
              <Text style={styles.defectAreaLabel}>{area.charAt(0).toUpperCase() + area.slice(1)}</Text>
              {areaData.condition && <Text style={styles.defectCondition}>{areaData.condition}</Text>}
              {areaData.defects.map((d: any, i: number) => (
                <View key={i} style={styles.defectItem}>
                  <View style={[styles.severityDot, {
                    backgroundColor: d.severity === 'heavy' ? Colors.red[500] : d.severity === 'moderate' ? Colors.amber[500] : Colors.green[500]
                  }]} />
                  <Text style={styles.defectDesc}>{d.description}</Text>
                </View>
              ))}
            </View>
          )
        }

        // Handle object format (top_left: { severity, description })
        const entries = Object.entries(areaData).filter(([k]) => !['condition', 'defects'].includes(k))
        const hasDefects = entries.some(([, v]: any) => v?.severity && v.severity !== 'none')
        if (!hasDefects) return null

        return (
          <View key={area} style={styles.defectArea}>
            <Text style={styles.defectAreaLabel}>{area.charAt(0).toUpperCase() + area.slice(1)}</Text>
            {entries.map(([key, val]: any) => {
              if (!val?.severity || val.severity === 'none') return null
              return (
                <View key={key} style={styles.defectItem}>
                  <View style={[styles.severityDot, {
                    backgroundColor: val.severity === 'heavy' ? Colors.red[500] : val.severity === 'moderate' ? Colors.amber[500] : Colors.green[500]
                  }]} />
                  <Text style={styles.defectDesc}>{key.replace(/_/g, ' ')}: {val.description || val.severity}</Text>
                </View>
              )
            })}
          </View>
        )
      })}
    </View>
  )
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { paddingBottom: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.gray[50] },
  errorText: { color: Colors.gray[500], fontSize: 16 },

  // Images / Slab
  imageSection: { backgroundColor: Colors.gray[900], paddingBottom: 12 },
  slabContainer: { paddingHorizontal: 32, paddingVertical: 12 },
  defectOverlayWrapper: { position: 'absolute', bottom: 4, left: 4, right: 4, aspectRatio: 0.714, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, overflow: 'hidden' },
  imageToggle: { flexDirection: 'row', justifyContent: 'center', paddingTop: 8, gap: 4 },
  imageToggleBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  imageToggleActive: { backgroundColor: Colors.purple[600] },
  imageToggleText: { fontSize: 13, fontWeight: '600', color: Colors.gray[400] },
  imageToggleTextActive: { color: Colors.white },
  imageContainer: { alignItems: 'center', paddingVertical: 12 },
  cardImage: { width: 250, height: 350, borderRadius: 8 },
  placeholderImage: { backgroundColor: Colors.gray[700], alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: Colors.gray[500], fontSize: 14 },

  // Grade header
  gradeHeader: { alignItems: 'center', paddingVertical: 20, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[200] },
  gradeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  confidenceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  confidenceText: { fontSize: 12, fontWeight: '700' },
  uncertaintyText: { fontSize: 13, color: Colors.gray[500], fontWeight: '600' },

  // Card info
  section: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, marginHorizontal: 12, marginTop: 12, borderWidth: 1, borderColor: Colors.gray[200] },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray[900], marginBottom: 12 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: Colors.gray[900], marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: Colors.gray[500], marginBottom: 8 },
  categoryBadge: { alignSelf: 'flex-start', backgroundColor: Colors.purple[50], paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 12 },
  categoryText: { fontSize: 12, fontWeight: '600', color: Colors.purple[600] },
  serialRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.gray[100] },
  serialLabel: { fontSize: 12, color: Colors.gray[500] },
  serialValue: { fontSize: 12, fontWeight: '600', color: Colors.gray[700], fontFamily: 'SpaceMono' },

  // Centering
  centeringGrid: { flexDirection: 'row' },
  centeringHalf: { flex: 1 },
  centeringDivider: { width: 1, backgroundColor: Colors.gray[200], marginHorizontal: 12 },
  centeringSide: { fontSize: 13, fontWeight: '700', color: Colors.gray[800], marginBottom: 8 },
  centeringTier: { fontSize: 11, color: Colors.purple[600], fontWeight: '600', marginTop: 4 },

  // Condition summaries
  summaryBlock: { marginBottom: 12 },
  summaryLabel: { fontSize: 13, fontWeight: '700', color: Colors.gray[800], marginBottom: 4 },
  summaryText: { fontSize: 13, color: Colors.gray[600], lineHeight: 20 },

  // Defects
  defectSideLabel: { fontSize: 14, fontWeight: '700', color: Colors.gray[800], marginBottom: 8 },
  defectArea: { marginBottom: 8, marginLeft: 8 },
  defectAreaLabel: { fontSize: 12, fontWeight: '600', color: Colors.gray[600], marginBottom: 4, textTransform: 'capitalize' },
  defectCondition: { fontSize: 11, color: Colors.gray[500], marginBottom: 4 },
  defectItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 3 },
  severityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  defectDesc: { fontSize: 12, color: Colors.gray[600], flex: 1, lineHeight: 16 },

  // Professional grades
  proGradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  proGradeCompany: { fontSize: 15, fontWeight: '700', color: Colors.gray[800] },
  proGradeRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  proGradeValue: { fontSize: 18, fontWeight: '800', color: Colors.purple[600] },
  proConfBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  proConfText: { fontSize: 10, fontWeight: '700' },

  // Pricing
  pricingSource: { fontSize: 13, fontWeight: '700', color: Colors.gray[800], marginBottom: 8 },
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceCell: { width: '47%' as any, backgroundColor: Colors.gray[50], borderRadius: 8, padding: 10, alignItems: 'center' },
  priceCellLabel: { fontSize: 11, color: Colors.gray[500], marginBottom: 2 },
  priceCellValue: { fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  listingCount: { fontSize: 11, color: Colors.gray[500], marginTop: 8 },
  priceUpdated: { fontSize: 11, color: Colors.gray[400], marginTop: 2 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start' },
  refreshText: { fontSize: 13, color: Colors.purple[600], fontWeight: '600' },
  dcmPrice: { fontSize: 24, fontWeight: '800', color: Colors.green[600] },

  // Actions
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: { width: '47%' as any, backgroundColor: Colors.gray[50], borderRadius: 10, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.gray[200] },
  actionLabel: { fontSize: 12, fontWeight: '600', color: Colors.gray[700] },

  // Info rows
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  infoLabel: { fontSize: 13, color: Colors.gray[500] },
  infoValue: { fontSize: 13, fontWeight: '600', color: Colors.gray[900], maxWidth: '60%' as any, textAlign: 'right' },
})
