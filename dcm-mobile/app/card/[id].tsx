import { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, Image, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, Share, Alert, RefreshControl } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Colors, GradeColors, ConfidenceColors } from '@/lib/constants'
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
    const { data, error } = await supabase.from('cards').select('*').eq('id', id).single()
    if (error || !data) { setIsLoading(false); setRefreshing(false); return }
    setCard(data as Card)
    const paths = [data.front_path, data.back_path].filter(Boolean)
    if (paths.length > 0) {
      const { data: urls } = await supabase.storage.from('cards').createSignedUrls(paths, 3600)
      urls?.forEach(u => {
        if (u.path === data.front_path) setFrontUrl(u.signedUrl)
        if (u.path === data.back_path) setBackUrl(u.signedUrl)
      })
    }
    setIsLoading(false); setRefreshing(false)
  }, [id])

  useEffect(() => { fetchCard() }, [fetchCard])

  if (isLoading) return <View style={s.loading}><ActivityIndicator size="large" color={Colors.purple[600]} /></View>
  if (!card) return <View style={s.loading}><Text style={{ color: Colors.gray[500] }}>Card not found</Text></View>

  const sub = card.conversational_weighted_sub_scores
  const ci = card.conversational_card_info
  const cen = card.conversational_centering
  const grade = card.conversational_whole_grade
  const lf = card.conversational_limiting_factor?.toLowerCase()
  const isOwner = session?.user?.id === card.user_id
  const cardName = card.card_name || ci?.card_name || `Card #${card.serial}`
  const setName = card.card_set || ci?.set_name || ''
  const cardNumber = card.card_number || ci?.card_number || ''
  const year = card.release_date || ci?.year || ''
  const confidence = card.conversational_image_confidence || ''

  // Parse grading JSON for detailed data
  let gradingJson: any = null
  try { gradingJson = card.conversational_grading ? JSON.parse(card.conversational_grading) : null } catch {}

  const handleShare = async () => {
    const catPath = card.category?.toLowerCase().replace(' ', '') || 'other'
    await Share.share({ message: `Check out this ${cardName} graded ${grade}/10 by DCM! https://dcmgrading.com/${catPath}/${card.id}` })
  }

  const handleDelete = () => {
    Alert.alert('Delete Card', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('cards').delete().eq('id', card.id)
        router.back()
      }},
    ])
  }

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCard() }} tintColor={Colors.purple[600]} />}>

      {/* ══════ SLAB PREVIEW ══════ */}
      <View style={s.slabSection}>
        <View style={s.imageToggle}>
          {['front', 'back'].map(side => (
            <TouchableOpacity key={side} style={[s.toggleBtn, activeImage === side && s.toggleBtnActive]} onPress={() => setActiveImage(side as any)}>
              <Text style={[s.toggleText, activeImage === side && s.toggleTextActive]}>{side === 'front' ? 'Front' : 'Back'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.slabContainer}>
          <SlabCard
            imageUrl={activeImage === 'front' ? frontUrl : backUrl}
            displayName={cardName}
            contextLine={[setName, cardNumber ? `#${cardNumber}` : null, year].filter(Boolean).join(' \u2022 ')}
            serial={card.serial}
            grade={grade}
            condition={card.conversational_condition_label || ''}
            size="lg"
            isBack={activeImage === 'back'}
            subScores={sub}
          />
        </View>
      </View>

      {/* ══════ GRADE + SUBGRADES ══════ */}
      <View style={s.gradeArea}>
        <GradeBadge grade={grade} size="lg" showLabel />
        <View style={s.gradeMetaRow}>
          <Text style={s.metaText}>Uncertainty: {card.conversational_grade_uncertainty || '±0'}</Text>
          <Text style={s.metaText}>Confidence Score: {confidence}</Text>
        </View>
      </View>

      {/* 4 Subgrade Boxes */}
      {sub && (
        <View style={s.subgradeGrid}>
          {[
            { label: 'Centering', icon: '🎯', score: sub.centering },
            { label: 'Corners', icon: '📐', score: sub.corners },
            { label: 'Edges', icon: '📏', score: sub.edges },
            { label: 'Surface', icon: '✨', score: sub.surface },
          ].map(sg => (
            <View key={sg.label} style={s.subBox}>
              <Text style={[s.subBoxScore, { color: (sg.score ?? 0) >= 9 ? Colors.green[600] : (sg.score ?? 0) >= 7 ? Colors.blue[600] : Colors.amber[600] }]}>{sg.score ?? 'N/A'}</Text>
              <Text style={s.subBoxLabel}>{sg.icon} {sg.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ══════ ESTIMATED VALUE + SUMMARY ══════ */}
      {(card.ebay_price_median || card.dcm_price_estimate) && (
        <View style={s.valueCard}>
          <Text style={s.valueLabel}>DCM Estimated Value</Text>
          <Text style={s.valueAmount}>${(card.dcm_price_estimate || card.ebay_price_median || 0).toFixed(2)}</Text>
        </View>
      )}

      {/* Overall Condition Summary */}
      {(card.conversational_front_summary || gradingJson?.final_grade?.summary) && (
        <View style={s.summaryCard}>
          <Text style={s.summaryTitle}>Overall Card Condition Summary</Text>
          <Text style={s.summaryText}>{gradingJson?.final_grade?.summary || card.conversational_front_summary}</Text>
        </View>
      )}

      {/* Serial + Actions */}
      <View style={s.serialRow}>
        <Text style={s.serialLabel}>DCM Serial#:</Text>
        <Text style={s.serialValue}>{card.serial}</Text>
      </View>

      {/* Share Buttons */}
      <View style={s.shareRow}>
        <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
          <Ionicons name="share-social" size={16} color={Colors.purple[600]} />
          <Text style={s.shareBtnText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.shareBtn} onPress={async () => {
          const catPath = card.category?.toLowerCase().replace(' ', '') || 'other'
          const url = `https://dcmgrading.com/${catPath}/${card.id}`
          await Clipboard.setStringAsync(url)
          Alert.alert('Link Copied', url)
        }}>
          <Ionicons name="copy" size={16} color={Colors.purple[600]} />
          <Text style={s.shareBtnText}>Copy Link</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.shareBtn} onPress={() => router.push('/pages/label-studio' as any)}>
          <Ionicons name="pricetags" size={16} color={Colors.purple[600]} />
          <Text style={s.shareBtnText}>Labels</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 12, paddingBottom: 40 }}>

        {/* ══════ 1. CARD INFORMATION ══════ */}
        <CollapsibleSection title="Card Information" icon="information-circle">
          <InfoRow label="Card Name" value={cardName} />
          <InfoRow label="Set" value={setName} />
          <InfoRow label="Card Number" value={cardNumber} />
          <InfoRow label="Year" value={year} />
          <InfoRow label="Category" value={card.category} />
          {card.sub_category && <InfoRow label="Sub-Category" value={card.sub_category} />}
          <InfoRow label="Manufacturer" value={ci?.manufacturer} />
          {ci?.rarity_or_variant && <InfoRow label="Rarity" value={ci.rarity_or_variant} />}
          {card.rookie_card && <InfoRow label="Rookie Card" value="Yes" />}
          {card.autographed && <InfoRow label="Autograph" value={card.autograph_type || 'Yes'} />}
          {card.memorabilia_type && <InfoRow label="Memorabilia" value={card.memorabilia_type} />}
          {card.serial_numbering && <InfoRow label="Serial Numbering" value={card.serial_numbering} />}
          {card.is_foil && <InfoRow label="Foil" value={card.foil_type || 'Yes'} />}
          {card.slab_company && <InfoRow label="Slab Company" value={card.slab_company} />}
          {card.slab_grade && <InfoRow label="Slab Grade" value={card.slab_grade} />}
        </CollapsibleSection>

        {/* ══════ 2. CENTERING ANALYSIS ══════ */}
        <CollapsibleSection title={`Centering Analysis${sub?.centering ? `  ${sub.centering}/10` : ''}`} icon="resize">
          {cen ? (
            <View style={s.centeringGrid}>
              <View style={s.centeringHalf}>
                <Text style={s.centeringSide}>Front</Text>
                <Text style={s.centeringScore}>{sub?.centering ?? 'N/A'}</Text>
                <InfoRow label="L/R" value={cen.front_left_right || cen.front_lr || 'N/A'} />
                <InfoRow label="T/B" value={cen.front_top_bottom || cen.front_tb || 'N/A'} />
                {cen.front_quality_tier && <Text style={s.centeringTier}>{cen.front_quality_tier}</Text>}
              </View>
              <View style={s.centeringDivider} />
              <View style={s.centeringHalf}>
                <Text style={s.centeringSide}>Back</Text>
                <Text style={s.centeringScore}>{sub?.centering ?? 'N/A'}</Text>
                <InfoRow label="L/R" value={cen.back_left_right || cen.back_lr || 'N/A'} />
                <InfoRow label="T/B" value={cen.back_top_bottom || cen.back_tb || 'N/A'} />
                {cen.back_quality_tier && <Text style={s.centeringTier}>{cen.back_quality_tier}</Text>}
              </View>
            </View>
          ) : (
            <Text style={s.naText}>No centering data available</Text>
          )}
        </CollapsibleSection>

        {/* ══════ 3. CORNERS, EDGES & SURFACE ANALYSIS ══════ */}
        <CollapsibleSection title="Corners, Edges & Surface Analysis" icon="cube">
          {/* Corner Zooms */}
          {frontUrl && !card.slab_detected && (
            <>
              <CornerZoomGrid imageUrl={frontUrl} side="Front" />
              {backUrl && <View style={{ marginTop: 12 }}><CornerZoomGrid imageUrl={backUrl} side="Back" /></View>}
            </>
          )}

          {/* Front/Back summaries */}
          {card.conversational_front_summary && (
            <View style={s.analysisSummary}>
              <Text style={s.analysisSideLabel}>Front Analysis</Text>
              <Text style={s.analysisText}>{card.conversational_front_summary}</Text>
            </View>
          )}
          {card.conversational_back_summary && (
            <View style={s.analysisSummary}>
              <Text style={s.analysisSideLabel}>Back Analysis</Text>
              <Text style={s.analysisText}>{card.conversational_back_summary}</Text>
            </View>
          )}

          {/* Detailed defects */}
          {(card.conversational_defects_front || card.conversational_defects_back) && (
            <View style={{ marginTop: 12 }}>
              {card.conversational_defects_front && <DefectSection side="Front" defects={card.conversational_defects_front} />}
              {card.conversational_defects_back && <DefectSection side="Back" defects={card.conversational_defects_back} />}
            </View>
          )}
        </CollapsibleSection>

        {/* ══════ 4. DCM OPTIC CONFIDENCE SCORE ══════ */}
        <CollapsibleSection title={`DCM Optic\u2122 Confidence Score${confidence ? `  ${confidence}` : ''}`} icon="shield-checkmark">
          <View style={[s.confBadgeLarge, { backgroundColor: ConfidenceColors[confidence]?.bg || Colors.gray[100] }]}>
            <Text style={[s.confBadgeGrade, { color: ConfidenceColors[confidence]?.text || Colors.gray[600] }]}>
              Grade {confidence} — {confidence === 'A' ? 'Excellent' : confidence === 'B' ? 'Good' : confidence === 'C' ? 'Fair' : 'Poor'}
            </Text>
          </View>
          {card.conversational_case_detection?.case_type && card.conversational_case_detection.case_type !== 'none' && (
            <InfoRow label="Protective Case" value={card.conversational_case_detection.case_type.replace('_', ' ')} />
          )}
          {card.conversational_case_detection?.case_type === 'none' && (
            <Text style={s.rawCardNote}>Raw card — no protective case detected</Text>
          )}
          <InfoRow label="Grade Uncertainty" value={card.conversational_grade_uncertainty || '±0'} />
        </CollapsibleSection>

        {/* ══════ 5. MARKET VALUE ══════ */}
        <CollapsibleSection title={`Market Value${card.ebay_price_median || card.dcm_price_estimate ? `  ~$${(card.dcm_price_estimate || card.ebay_price_median || 0).toFixed(2)}` : ''}`} icon="trending-up">
          {card.ebay_price_median && (
            <>
              <Text style={s.pricingSource}>eBay Comparable Sales</Text>
              <View style={s.priceGrid}>
                <PriceCell label="Lowest" value={card.ebay_price_lowest} />
                <PriceCell label="Median" value={card.ebay_price_median} />
                <PriceCell label="Average" value={card.ebay_price_average} />
                <PriceCell label="Highest" value={card.ebay_price_highest} />
              </View>
              {card.ebay_price_listing_count && <Text style={s.priceNote}>{card.ebay_price_listing_count} listings found</Text>}
              {card.ebay_price_updated_at && <Text style={s.priceNote}>Updated: {new Date(card.ebay_price_updated_at).toLocaleDateString()}</Text>}
            </>
          )}
          {card.dcm_price_estimate && (
            <View style={{ marginTop: card.ebay_price_median ? 16 : 0 }}>
              <Text style={s.pricingSource}>DCM Price Estimate</Text>
              <Text style={s.dcmPrice}>${card.dcm_price_estimate.toFixed(2)}</Text>
            </View>
          )}
          {!card.ebay_price_median && !card.dcm_price_estimate && (
            <Text style={s.naText}>No pricing data available</Text>
          )}
        </CollapsibleSection>

        {/* ══════ 6. ESTIMATED MAIL-AWAY GRADES ══════ */}
        {card.estimated_professional_grades && (
          <CollapsibleSection title="Estimated Mail-Away Grade Scores" icon="ribbon">
            {['PSA', 'BGS', 'SGC', 'CGC'].map(company => {
              const est = (card.estimated_professional_grades as any)?.[company]
              if (!est) return null
              return (
                <View key={company} style={s.proRow}>
                  <Text style={s.proCompany}>{company}</Text>
                  <View style={s.proRight}>
                    <Text style={s.proGrade}>{est.estimated_grade}</Text>
                    <View style={[s.proBadge, { backgroundColor: est.confidence === 'high' ? Colors.green[50] : est.confidence === 'medium' ? Colors.amber[50] : Colors.red[50] }]}>
                      <Text style={[s.proConfText, { color: est.confidence === 'high' ? Colors.green[600] : est.confidence === 'medium' ? Colors.amber[600] : Colors.red[600] }]}>{est.confidence?.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
              )
            })}
            <Text style={s.disclaimer}>These are projections only and not official grades.</Text>
          </CollapsibleSection>
        )}

        {/* ══════ 7. INSTA-LIST ON EBAY ══════ */}
        {isOwner && (
          <CollapsibleSection title="Insta-List on eBay" icon="pricetag">
            <Text style={s.ebayInfo}>Automatically includes front & back card images with DCM grade labels, mini grading report, and pre-filled title.</Text>
            <TouchableOpacity style={s.ebayButton} onPress={() => {
              // eBay listing requires the web interface for OAuth + listing creation
              // Opens in in-app WebView via the pages route
              const catPath = card.category?.toLowerCase().replace(' ', '') || 'other'
              router.push({ pathname: '/pages/ebay-list' as any, params: { cardPath: `/${catPath}/${card.id}` } })
            }}>
              <Ionicons name="cart" size={18} color={Colors.white} />
              <Text style={s.ebayButtonText}>List on eBay</Text>
            </TouchableOpacity>
          </CollapsibleSection>
        )}

        {/* ══════ 8. DCM OPTIC REPORT ══════ */}
        <CollapsibleSection title="DCM Optic\u2122 Report" icon="document-text">
          <InfoRow label="DCM Optic\u2122 Version" value={card.conversational_prompt_version || 'N/A'} />
          <InfoRow label="Graded Date" value={card.created_at ? new Date(card.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'} />
          <InfoRow label="Category" value={card.category} />
          <InfoRow label="Visibility" value={card.visibility} />
        </CollapsibleSection>

        {/* ══════ DELETE ══════ */}
        {isOwner && (
          <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash" size={16} color={Colors.red[600]} />
            <Text style={s.deleteBtnText}>Delete card from collection</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  )
}

// ── Sub-components ──

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={2}>{value || 'N/A'}</Text>
    </View>
  )
}

function PriceCell({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={s.priceCell}>
      <Text style={s.priceCellLabel}>{label}</Text>
      <Text style={s.priceCellValue}>{value != null ? `$${value.toFixed(2)}` : '—'}</Text>
    </View>
  )
}

function DefectSection({ side, defects }: { side: string; defects: any }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={s.defectSideLabel}>{side}</Text>
      {['corners', 'edges', 'surface'].map(area => {
        const d = defects[area]
        if (!d) return null
        if (Array.isArray(d.defects) && d.defects.length > 0) {
          return (
            <View key={area} style={s.defectArea}>
              <Text style={s.defectAreaLabel}>{area.charAt(0).toUpperCase() + area.slice(1)}</Text>
              {d.defects.map((def: any, i: number) => (
                <View key={i} style={s.defectItem}>
                  <View style={[s.sevDot, { backgroundColor: def.severity === 'heavy' ? Colors.red[500] : def.severity === 'moderate' ? Colors.amber[500] : Colors.green[500] }]} />
                  <Text style={s.defectDesc}>{def.description}</Text>
                </View>
              ))}
            </View>
          )
        }
        const entries = Object.entries(d).filter(([k]) => !['condition', 'defects'].includes(k))
        const hasDefects = entries.some(([, v]: any) => v?.severity && v.severity !== 'none')
        if (!hasDefects) return null
        return (
          <View key={area} style={s.defectArea}>
            <Text style={s.defectAreaLabel}>{area.charAt(0).toUpperCase() + area.slice(1)}</Text>
            {entries.map(([key, val]: any) => {
              if (!val?.severity || val.severity === 'none') return null
              return (
                <View key={key} style={s.defectItem}>
                  <View style={[s.sevDot, { backgroundColor: val.severity === 'heavy' ? Colors.red[500] : val.severity === 'moderate' ? Colors.amber[500] : Colors.green[500] }]} />
                  <Text style={s.defectDesc}>{key.replace(/_/g, ' ')}: {val.description || val.severity}</Text>
                </View>
              )
            })}
          </View>
        )
      })}
    </View>
  )
}

// ── Styles ──

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.gray[50] },

  // Slab
  slabSection: { backgroundColor: Colors.gray[900], paddingBottom: 12 },
  imageToggle: { flexDirection: 'row', justifyContent: 'center', paddingTop: 8, gap: 4 },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  toggleBtnActive: { backgroundColor: Colors.purple[600] },
  toggleText: { fontSize: 13, fontWeight: '600', color: Colors.gray[400] },
  toggleTextActive: { color: Colors.white },
  slabContainer: { paddingHorizontal: 32, paddingVertical: 12 },

  // Grade
  gradeArea: { alignItems: 'center', paddingVertical: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[200] },
  gradeMetaRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  metaText: { fontSize: 12, color: Colors.gray[500], fontWeight: '600' },

  // Subgrade boxes
  subgradeGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  subBox: { width: '47%' as any, backgroundColor: Colors.white, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.gray[200] },
  subBoxScore: { fontSize: 28, fontWeight: '800' },
  subBoxLabel: { fontSize: 12, color: Colors.gray[600], marginTop: 4, fontWeight: '600' },

  // Value
  valueCard: { marginHorizontal: 12, marginTop: 12, backgroundColor: Colors.green[50], borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.green[500] },
  valueLabel: { fontSize: 13, fontWeight: '600', color: Colors.green[600] },
  valueAmount: { fontSize: 28, fontWeight: '800', color: Colors.green[600], marginTop: 4 },

  // Summary
  summaryCard: { marginHorizontal: 12, marginTop: 12, backgroundColor: Colors.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.gray[200] },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: Colors.gray[900], marginBottom: 8 },
  summaryText: { fontSize: 13, color: Colors.gray[600], lineHeight: 20 },

  // Serial
  serialRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 12, marginTop: 12, padding: 12, backgroundColor: Colors.white, borderRadius: 10, borderWidth: 1, borderColor: Colors.gray[200] },
  serialLabel: { fontSize: 13, color: Colors.gray[500] },
  serialValue: { fontSize: 13, fontWeight: '700', color: Colors.gray[800], fontFamily: 'SpaceMono' },

  // Share
  shareRow: { flexDirection: 'row', gap: 8, marginHorizontal: 12, marginTop: 8, marginBottom: 12 },
  shareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: Colors.white, borderRadius: 10, borderWidth: 1, borderColor: Colors.gray[200] },
  shareBtnText: { fontSize: 13, fontWeight: '600', color: Colors.purple[600] },

  // Centering
  centeringGrid: { flexDirection: 'row' },
  centeringHalf: { flex: 1, alignItems: 'center' },
  centeringDivider: { width: 1, backgroundColor: Colors.gray[200], marginHorizontal: 8 },
  centeringSide: { fontSize: 13, fontWeight: '700', color: Colors.gray[800], marginBottom: 4 },
  centeringScore: { fontSize: 28, fontWeight: '800', color: Colors.purple[600], marginBottom: 8 },
  centeringTier: { fontSize: 11, color: Colors.purple[600], fontWeight: '600', marginTop: 4 },

  // Analysis
  analysisSummary: { marginTop: 12, padding: 12, backgroundColor: Colors.gray[50], borderRadius: 8 },
  analysisSideLabel: { fontSize: 13, fontWeight: '700', color: Colors.gray[800], marginBottom: 4 },
  analysisText: { fontSize: 12, color: Colors.gray[600], lineHeight: 18 },

  // Confidence
  confBadgeLarge: { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  confBadgeGrade: { fontSize: 16, fontWeight: '700' },
  rawCardNote: { fontSize: 12, color: Colors.gray[500], fontStyle: 'italic', marginTop: 4 },

  // Pricing
  pricingSource: { fontSize: 13, fontWeight: '700', color: Colors.gray[800], marginBottom: 8 },
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceCell: { width: '47%' as any, backgroundColor: Colors.gray[50], borderRadius: 8, padding: 10, alignItems: 'center' },
  priceCellLabel: { fontSize: 11, color: Colors.gray[500] },
  priceCellValue: { fontSize: 16, fontWeight: '700', color: Colors.gray[900], marginTop: 2 },
  priceNote: { fontSize: 11, color: Colors.gray[400], marginTop: 4 },
  dcmPrice: { fontSize: 24, fontWeight: '800', color: Colors.green[600] },
  naText: { fontSize: 13, color: Colors.gray[400], fontStyle: 'italic' },

  // Professional grades
  proRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  proCompany: { fontSize: 15, fontWeight: '700', color: Colors.gray[800] },
  proRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  proGrade: { fontSize: 18, fontWeight: '800', color: Colors.purple[600] },
  proBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  proConfText: { fontSize: 10, fontWeight: '700' },
  disclaimer: { fontSize: 11, color: Colors.gray[400], fontStyle: 'italic', marginTop: 8 },

  // eBay
  ebayInfo: { fontSize: 13, color: Colors.gray[600], marginBottom: 12, lineHeight: 18 },
  ebayButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.blue[600], paddingVertical: 14, borderRadius: 12 },
  ebayButtonText: { color: Colors.white, fontSize: 15, fontWeight: '700' },

  // Info rows
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  infoLabel: { fontSize: 13, color: Colors.gray[500], flex: 1 },
  infoValue: { fontSize: 13, fontWeight: '600', color: Colors.gray[900], flex: 1, textAlign: 'right' },

  // Defects
  defectSideLabel: { fontSize: 14, fontWeight: '700', color: Colors.gray[800], marginBottom: 6 },
  defectArea: { marginBottom: 8, marginLeft: 8 },
  defectAreaLabel: { fontSize: 12, fontWeight: '600', color: Colors.gray[600], marginBottom: 4, textTransform: 'capitalize' },
  defectItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 3 },
  sevDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  defectDesc: { fontSize: 12, color: Colors.gray[600], flex: 1, lineHeight: 16 },

  // Delete
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.red[100], backgroundColor: Colors.red[50] },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: Colors.red[600] },
})
