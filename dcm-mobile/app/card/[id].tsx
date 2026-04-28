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

  const subRaw = card.conversational_weighted_sub_scores || card.conversational_sub_scores
  const ci = card.conversational_card_info

  // Parse grading JSON early — needed for centering fallback
  let gradingJsonEarly: any = null
  try { gradingJsonEarly = card.conversational_grading ? JSON.parse(card.conversational_grading) : null } catch {}

  // Centering: try column first, then grading JSON
  const cen = card.conversational_centering || gradingJsonEarly?.centering || null

  // Extract numeric score from either flat number or nested { weighted: N } format
  const extractScore = (obj: any, key: string): number | null => {
    if (!obj) return null
    const v = obj[key]
    if (typeof v === 'number') return v
    if (v && typeof v === 'object') {
      if (typeof v.weighted === 'number') return v.weighted
      if (typeof v.raw === 'number') return v.raw
    }
    // Try conversational_sub_scores as fallback
    const sr = card.conversational_sub_scores
    if (sr) {
      const sv = sr[key]
      if (typeof sv === 'number') return sv
      if (sv && typeof sv === 'object' && typeof sv.weighted === 'number') return sv.weighted
    }
    return null
  }

  const sub = subRaw ? {
    centering: extractScore(subRaw, 'centering'),
    corners: extractScore(subRaw, 'corners'),
    edges: extractScore(subRaw, 'edges'),
    surface: extractScore(subRaw, 'surface'),
  } : null
  const grade = card.conversational_whole_grade
  const lf = card.conversational_limiting_factor?.toLowerCase()
  const isOwner = session?.user?.id === card.user_id
  const cardName = card.card_name || ci?.card_name || `Card #${card.serial}`
  const setName = card.card_set || ci?.set_name || ''
  const cardNumber = card.card_number || ci?.card_number || ''
  const year = card.release_date || ci?.year || ''
  const confidence = card.conversational_image_confidence || ''

  const gradingJson = gradingJsonEarly

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
        <View style={s.imageToggle}>
          {['front', 'back'].map(side => (
            <TouchableOpacity key={side} style={[s.toggleBtn, activeImage === side && s.toggleBtnActive]} onPress={() => setActiveImage(side as any)}>
              <Text style={[s.toggleText, activeImage === side && s.toggleTextActive]}>{side === 'front' ? 'Front' : 'Back'}</Text>
            </TouchableOpacity>
          ))}
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
      {sub && (sub.centering != null || sub.corners != null) && (
        <View style={s.subgradeGrid}>
          {[
            { label: 'Centering', icon: '🎯', score: sub.centering },
            { label: 'Corners', icon: '📐', score: sub.corners },
            { label: 'Edges', icon: '📏', score: sub.edges },
            { label: 'Surface', icon: '✨', score: sub.surface },
          ].map(sg => {
            const val = sg.score != null ? Math.round(sg.score) : null
            return (
              <View key={sg.label} style={s.subBox}>
                <Text style={[s.subBoxScore, { color: (val ?? 0) >= 9 ? Colors.green[600] : (val ?? 0) >= 7 ? Colors.blue[600] : Colors.amber[600] }]}>{val ?? 'N/A'}</Text>
                <Text style={s.subBoxLabel}>{sg.icon} {sg.label}</Text>
              </View>
            )
          })}
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
        <TouchableOpacity style={s.shareBtn} onPress={() => {
          Alert.alert('Labels & Downloads', 'Choose an option:', [
            { text: 'Open Label Studio', onPress: () => router.push({ pathname: '/pages/label-studio', params: { cardId: card.id } } as any) },
            { text: 'Download Slab Label (Modern)', onPress: () => router.push({ pathname: '/pages/label-studio', params: { cardId: card.id, autoDownload: 'slab-modern' } } as any) },
            { text: 'Download Slab Label (Traditional)', onPress: () => router.push({ pathname: '/pages/label-studio', params: { cardId: card.id, autoDownload: 'slab-traditional' } } as any) },
            { text: 'Download One-Touch Label', onPress: () => router.push({ pathname: '/pages/label-studio', params: { cardId: card.id, autoDownload: 'onetouch' } } as any) },
            { text: 'Download Toploader Labels', onPress: () => router.push({ pathname: '/pages/label-studio', params: { cardId: card.id, autoDownload: 'toploader' } } as any) },
            { text: 'Cancel', style: 'cancel' },
          ])
        }}>
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
        <CollapsibleSection title={`Centering Analysis${sub?.centering != null ? `  ${Math.round(sub.centering)}/10` : ''}`} icon="resize">
          {cen ? (
            <>
              {/* Card images for centering reference */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {frontUrl && (
                  <View style={{ flex: 1 }}>
                    <Text style={[s.centeringSide, { marginBottom: 4 }]}>Front</Text>
                    <Image source={{ uri: frontUrl }} style={{ width: '100%', aspectRatio: 2.5/3.5, borderRadius: 6, borderWidth: 1, borderColor: Colors.gray[200] }} resizeMode="contain" />
                  </View>
                )}
                {backUrl && (
                  <View style={{ flex: 1 }}>
                    <Text style={[s.centeringSide, { marginBottom: 4 }]}>Back</Text>
                    <Image source={{ uri: backUrl }} style={{ width: '100%', aspectRatio: 2.5/3.5, borderRadius: 6, borderWidth: 1, borderColor: Colors.gray[200] }} resizeMode="contain" />
                  </View>
                )}
              </View>
              <View style={s.centeringGrid}>
                {['front', 'back'].map(side => {
                  // Handle both flat column format and nested JSON format
                  const sideData = (cen as any)?.[side] || cen
                  const lr = sideData?.left_right || sideData?.[`${side}_left_right`] || sideData?.[`${side}_lr`] || 'N/A'
                  const tb = sideData?.top_bottom || sideData?.[`${side}_top_bottom`] || sideData?.[`${side}_tb`] || 'N/A'
                  const tier = sideData?.quality_tier || sideData?.[`${side}_quality_tier`] || null
                  const analysis = sideData?.analysis || sideData?.[`${side}_analysis`] || sideData?.[`${side}_notes`] || null
                  const score = sideData?.score ?? (sub?.centering != null ? Math.round(sub.centering) : null)
                  return (
                    <View key={side} style={s.centeringHalf}>
                      <Text style={s.centeringSide}>{side === 'front' ? 'Front' : 'Back'}</Text>
                      <Text style={s.centeringScore}>{score ?? 'N/A'}/10</Text>
                      <InfoRow label="L/R" value={lr} />
                      <InfoRow label="T/B" value={tb} />
                      {tier && <Text style={s.centeringTier}>{tier}</Text>}
                      {analysis && <Text style={s.analysisText}>{analysis}</Text>}
                      {side === 'front' && <View style={s.centeringDivider} />}
                    </View>
                  )
                })}
              </View>
            </>
          ) : (
            <Text style={s.naText}>No centering data available</Text>
          )}
        </CollapsibleSection>

        {/* ══════ 3. CORNERS, EDGES & SURFACE ANALYSIS ══════ */}
        <CollapsibleSection title="Corners, Edges & Surface Analysis" icon="cube">
          {/* Subgrade scores for this section */}
          {sub && (
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {[
                { label: 'Corners', score: sub.corners },
                { label: 'Edges', score: sub.edges },
                { label: 'Surface', score: sub.surface },
              ].map(sg => {
                const val = sg.score != null ? Math.round(sg.score) : null
                return (
                  <View key={sg.label} style={[s.subBox, { flex: 1 }]}>
                    <Text style={[s.subBoxScore, { fontSize: 16, color: (val ?? 0) >= 9 ? Colors.green[600] : (val ?? 0) >= 7 ? Colors.blue[600] : Colors.amber[600] }]}>{val ?? 'N/A'}</Text>
                    <Text style={[s.subBoxLabel, { fontSize: 9 }]}>{sg.label}</Text>
                  </View>
                )
              })}
            </View>
          )}

          {/* Corner Zooms */}
          {frontUrl && !card.slab_detected && (
            <>
              <CornerZoomGrid imageUrl={frontUrl} side="Front" />
              {backUrl && <View style={{ marginTop: 12 }}><CornerZoomGrid imageUrl={backUrl} side="Back" /></View>}
            </>
          )}

          {/* Front/Back summaries — from column or grading JSON */}
          {(card.conversational_front_summary || gradingJson?.front_summary) && (
            <View style={s.analysisSummary}>
              <Text style={s.analysisSideLabel}>Front Analysis</Text>
              <Text style={s.analysisText}>{card.conversational_front_summary || gradingJson?.front_summary}</Text>
            </View>
          )}
          {(card.conversational_back_summary || gradingJson?.back_summary) && (
            <View style={s.analysisSummary}>
              <Text style={s.analysisSideLabel}>Back Analysis</Text>
              <Text style={s.analysisText}>{card.conversational_back_summary || gradingJson?.back_summary}</Text>
            </View>
          )}

          {/* Corners/Edges/Surface structured details from DB or grading JSON */}
          {(() => {
            const cesRaw = card.conversational_corners_edges_surface || gradingJson?.corners_edges_surface
            if (!cesRaw) return null
            const ces = typeof cesRaw === 'string' ? JSON.parse(cesRaw) : cesRaw

            // Extract analysis text — handles both flat summary and per-side detailed keys
            const getAnalysis = (area: string) => {
              const summaryKey = `${area}_summary`
              if (ces[summaryKey]) return ces[summaryKey]
              // Try to build from front/back detailed entries
              const frontKey = `front_${area}`
              const backKey = `back_${area}`
              const parts: string[] = []
              if (ces[frontKey]) {
                const fd = ces[frontKey]
                if (typeof fd === 'string') parts.push(`Front: ${fd}`)
                else if (fd.analysis || fd.summary) parts.push(`Front: ${fd.analysis || fd.summary}`)
                else {
                  // It's an object with top/bottom/left/right or top_left/etc
                  Object.entries(fd).forEach(([k, v]) => {
                    if (typeof v === 'string' && v.length > 20) parts.push(`${k}: ${v}`)
                  })
                }
              }
              if (ces[backKey]) {
                const bd = ces[backKey]
                if (typeof bd === 'string') parts.push(`Back: ${bd}`)
                else if (bd.analysis || bd.summary) parts.push(`Back: ${bd.analysis || bd.summary}`)
                else {
                  Object.entries(bd).forEach(([k, v]) => {
                    if (typeof v === 'string' && v.length > 20) parts.push(`${k}: ${v}`)
                  })
                }
              }
              return parts.length > 0 ? parts.join('\n\n') : null
            }

            const cornersText = getAnalysis('corners')
            const edgesText = getAnalysis('edges')
            const surfaceText = getAnalysis('surface')

            if (!cornersText && !edgesText && !surfaceText) return null

            return (
              <View style={{ marginTop: 12, gap: 8 }}>
                {cornersText && (
                  <View style={s.analysisSummary}>
                    <Text style={s.analysisSideLabel}>Corners {sub?.corners != null ? `(${Math.round(sub.corners)}/10)` : ''}</Text>
                    <Text style={s.analysisText}>{cornersText}</Text>
                  </View>
                )}
                {edgesText && (
                  <View style={s.analysisSummary}>
                    <Text style={s.analysisSideLabel}>Edges {sub?.edges != null ? `(${Math.round(sub.edges)}/10)` : ''}</Text>
                    <Text style={s.analysisText}>{edgesText}</Text>
                  </View>
                )}
                {surfaceText && (
                  <View style={s.analysisSummary}>
                    <Text style={s.analysisSideLabel}>Surface {sub?.surface != null ? `(${Math.round(sub.surface)}/10)` : ''}</Text>
                    <Text style={s.analysisText}>{surfaceText}</Text>
                  </View>
                )}
              </View>
            )
          })()}

          {/* Detailed defects */}
          {(card.conversational_defects_front || card.conversational_defects_back) && (
            <View style={{ marginTop: 12 }}>
              {card.conversational_defects_front && <DefectSection side="Front" defects={card.conversational_defects_front} />}
              {card.conversational_defects_back && <DefectSection side="Back" defects={card.conversational_defects_back} />}
            </View>
          )}
        </CollapsibleSection>

        {/* ══════ 4. DCM OPTIC™ CONFIDENCE SCORE ══════ */}
        <CollapsibleSection title={`DCM Optic™ Confidence Score${confidence ? `  ${confidence}` : ''}`} icon="shield-checkmark">
          {/* Confidence bar */}
          <View style={s.confBarContainer}>
            <View style={[s.confBarFill, { width: `${confidence === 'A' ? 100 : confidence === 'B' ? 75 : confidence === 'C' ? 50 : 25}%`, backgroundColor: ConfidenceColors[confidence]?.text || Colors.gray[400] }]} />
          </View>
          <View style={[s.confBadgeLarge, { backgroundColor: ConfidenceColors[confidence]?.bg || Colors.gray[100] }]}>
            <Text style={[s.confBadgeGrade, { color: ConfidenceColors[confidence]?.text || Colors.gray[600] }]}>
              Grade {confidence} — {confidence === 'A' ? 'Very High Confidence' : confidence === 'B' ? 'High Confidence' : confidence === 'C' ? 'Moderate Confidence' : 'Low Confidence'}
            </Text>
          </View>
          <Text style={s.confDescription}>
            {confidence === 'A'
              ? `Excellent image quality. Grade uncertainty ${card.conversational_grade_uncertainty || '±0'} — the assigned grade is highly reliable.`
              : confidence === 'B'
              ? `Good image quality. Grade uncertainty ${card.conversational_grade_uncertainty || '±0.5'} — the assigned grade is reliable with minor margin.`
              : confidence === 'C'
              ? `Fair image quality. Grade uncertainty ${card.conversational_grade_uncertainty || '±1.0'} — consider retaking photos for a more accurate grade.`
              : `Poor image quality. Grade uncertainty ${card.conversational_grade_uncertainty || '±1.5'} — we recommend retaking clearer photos for reliable grading.`}
          </Text>
          {card.conversational_case_detection?.case_type && card.conversational_case_detection.case_type !== 'none' && (
            <InfoRow label="Protective Case" value={card.conversational_case_detection.case_type.replace('_', ' ')} />
          )}
          {card.conversational_case_detection?.case_type === 'none' && (
            <Text style={s.rawCardNote}>Raw card — no protective case detected</Text>
          )}
          <InfoRow label="Image Quality Grade" value={confidence || 'N/A'} />
        </CollapsibleSection>

        {/* ══════ 5. MARKET VALUE ══════ */}
        <CollapsibleSection title={`Market Value${card.ebay_price_median || card.dcm_price_estimate ? `  ~$${(card.dcm_price_estimate || card.ebay_price_median || 0).toFixed(2)}` : ''}`} icon="trending-up">
          {/* DCM Price Estimate */}
          {card.dcm_price_estimate != null && (
            <View style={s.dcmPriceCard}>
              <Text style={s.pricingSource}>DCM Price Estimate</Text>
              <Text style={s.dcmPrice}>${card.dcm_price_estimate.toFixed(2)}</Text>
              {card.dcm_price_match_confidence && (
                <Text style={s.priceNote}>Match confidence: {card.dcm_price_match_confidence}</Text>
              )}
              {card.dcm_price_product_name && (
                <Text style={[s.priceNote, { marginTop: 2 }]}>Matched: {card.dcm_price_product_name}</Text>
              )}
              {card.dcm_price_at_grading != null && (
                <Text style={s.priceNote}>Price at grading: ${card.dcm_price_at_grading.toFixed(2)}</Text>
              )}
              {card.dcm_prices_cached_at && (
                <Text style={s.priceNote}>Updated: {new Date(card.dcm_prices_cached_at).toLocaleDateString()}</Text>
              )}
            </View>
          )}

          {/* eBay Comparable Sales */}
          {card.ebay_price_median != null && (
            <View style={{ marginTop: card.dcm_price_estimate ? 16 : 0 }}>
              <Text style={s.pricingSource}>eBay Comparable Sales</Text>
              <View style={s.priceGrid}>
                <PriceCell label="Lowest" value={card.ebay_price_lowest} />
                <PriceCell label="Median" value={card.ebay_price_median} />
                <PriceCell label="Average" value={card.ebay_price_average} />
                <PriceCell label="Highest" value={card.ebay_price_highest} />
              </View>
              {card.ebay_price_listing_count != null && <Text style={s.priceNote}>{card.ebay_price_listing_count} comparable listings found</Text>}
              {card.ebay_price_updated_at && <Text style={s.priceNote}>Updated: {new Date(card.ebay_price_updated_at).toLocaleDateString()}</Text>}
            </View>
          )}

          {/* Scryfall (MTG/Pokemon) */}
          {card.scryfall_price_usd != null && (
            <View style={{ marginTop: 16 }}>
              <Text style={s.pricingSource}>TCG Market Price</Text>
              <Text style={s.dcmPrice}>${card.scryfall_price_usd}</Text>
            </View>
          )}

          {!card.ebay_price_median && !card.dcm_price_estimate && !card.scryfall_price_usd && (
            <Text style={s.naText}>No pricing data available yet. Pricing is fetched automatically after grading.</Text>
          )}
        </CollapsibleSection>

        {/* ══════ 6. ESTIMATED MAIL-AWAY GRADES ══════ */}
        {card.estimated_professional_grades && (
          <CollapsibleSection title="Estimated Mail-Away Grade Scores" icon="ribbon">
            {['PSA', 'BGS', 'SGC', 'CGC'].map(company => {
              const est = (card.estimated_professional_grades as any)?.[company]
              if (!est) return null
              return (
                <View key={company} style={s.proCard}>
                  <View style={s.proHeader}>
                    <Text style={s.proCompany}>{company}</Text>
                    <View style={s.proRight}>
                      <Text style={s.proGrade}>{est.estimated_grade}</Text>
                      {est.numeric_score != null && (
                        <Text style={s.proNumeric}>({est.numeric_score})</Text>
                      )}
                      <View style={[s.proBadge, { backgroundColor: est.confidence === 'high' ? Colors.green[50] : est.confidence === 'medium' ? Colors.amber[50] : Colors.red[50] }]}>
                        <Text style={[s.proConfText, { color: est.confidence === 'high' ? Colors.green[600] : est.confidence === 'medium' ? Colors.amber[600] : Colors.red[600] }]}>{est.confidence?.toUpperCase()}</Text>
                      </View>
                    </View>
                  </View>
                  {est.notes && <Text style={s.proNotes}>{est.notes}</Text>}
                </View>
              )
            })}
            <Text style={s.disclaimer}>These are estimated projections based on DCM's AI grading analysis. They are not official grades from PSA, BGS, SGC, or CGC. Actual grades may vary.</Text>
          </CollapsibleSection>
        )}

        {/* ══════ 7. INSTA-LIST ON EBAY ══════ */}
        {isOwner && (
          <CollapsibleSection title="Insta-List on eBay" icon="pricetag">
            <Text style={s.ebayInfo}>Automatically includes front & back card images with DCM grade labels, mini grading report, and pre-filled title.</Text>
            <TouchableOpacity style={s.ebayButton} onPress={() => {
              const catPath = card.category?.toLowerCase().replace(' ', '') || 'other'
              router.push({ pathname: '/pages/ebay-list' as any, params: { cardPath: `/${catPath}/${card.id}` } })
            }}>
              <Ionicons name="cart" size={18} color={Colors.white} />
              <Text style={s.ebayButtonText}>List on eBay</Text>
            </TouchableOpacity>
          </CollapsibleSection>
        )}

        {/* ══════ 8. DCM OPTIC™ REPORT ══════ */}
        <CollapsibleSection title="DCM Optic™ Report" icon="document-text">
          {/* Card Info */}
          {ci && (
            <View style={{ marginBottom: 12 }}>
              <Text style={s.reportSubhead}>Card Information</Text>
              <InfoRow label="Card Name" value={ci.card_name || cardName} />
              <InfoRow label="Set" value={ci.set_name || setName} />
              {ci.year && <InfoRow label="Year" value={ci.year} />}
              {ci.manufacturer && <InfoRow label="Manufacturer" value={ci.manufacturer} />}
              {ci.card_number && <InfoRow label="Card Number" value={ci.card_number} />}
              {ci.player_or_character && <InfoRow label="Character" value={ci.player_or_character} />}
              {ci.rarity_tier && <InfoRow label="Rarity" value={ci.rarity_tier} />}
            </View>
          )}

          {/* Three-Pass Evaluation */}
          {gradingJson?.grading_passes && (
            <View style={{ marginBottom: 12 }}>
              <Text style={s.reportSubhead}>Three-Pass Evaluation</Text>
              <Text style={s.analysisText}>DCM Optic™ performs three independent evaluations of each card to ensure accuracy.</Text>
              <View style={{ marginTop: 8, borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 8, overflow: 'hidden' }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', backgroundColor: Colors.gray[100], paddingVertical: 6, paddingHorizontal: 8 }}>
                  <Text style={{ flex: 1, fontSize: 9, fontWeight: '700', color: Colors.gray[600] }}>Pass</Text>
                  <Text style={{ width: 36, fontSize: 9, fontWeight: '700', color: Colors.gray[600], textAlign: 'center' }}>C</Text>
                  <Text style={{ width: 36, fontSize: 9, fontWeight: '700', color: Colors.gray[600], textAlign: 'center' }}>Co</Text>
                  <Text style={{ width: 36, fontSize: 9, fontWeight: '700', color: Colors.gray[600], textAlign: 'center' }}>E</Text>
                  <Text style={{ width: 36, fontSize: 9, fontWeight: '700', color: Colors.gray[600], textAlign: 'center' }}>S</Text>
                  <Text style={{ width: 36, fontSize: 9, fontWeight: '700', color: Colors.gray[600], textAlign: 'center' }}>Final</Text>
                </View>
                {/* Pass rows */}
                {[1, 2, 3].map(passNum => {
                  const pass = gradingJson.grading_passes?.[`pass_${passNum}`] || gradingJson.grading_passes?.passes?.[passNum - 1]
                  if (!pass) return null
                  const sc = pass.sub_scores || pass
                  return (
                    <View key={passNum} style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: Colors.gray[100] }}>
                      <Text style={{ flex: 1, fontSize: 10, color: Colors.gray[700] }}>Pass {passNum}</Text>
                      <Text style={{ width: 36, fontSize: 10, color: Colors.gray[800], textAlign: 'center', fontWeight: '600' }}>{sc.centering ?? '-'}</Text>
                      <Text style={{ width: 36, fontSize: 10, color: Colors.gray[800], textAlign: 'center', fontWeight: '600' }}>{sc.corners ?? '-'}</Text>
                      <Text style={{ width: 36, fontSize: 10, color: Colors.gray[800], textAlign: 'center', fontWeight: '600' }}>{sc.edges ?? '-'}</Text>
                      <Text style={{ width: 36, fontSize: 10, color: Colors.gray[800], textAlign: 'center', fontWeight: '600' }}>{sc.surface ?? '-'}</Text>
                      <Text style={{ width: 36, fontSize: 10, color: Colors.purple[600], textAlign: 'center', fontWeight: '700' }}>{pass.final_grade ?? pass.whole_grade ?? '-'}</Text>
                    </View>
                  )
                })}
                {/* Average row */}
                {gradingJson.grading_passes?.averaged_rounded && (
                  <View style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: Colors.gray[200], backgroundColor: Colors.purple[50] }}>
                    <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: Colors.gray[800] }}>Average</Text>
                    <Text style={{ width: 36, fontSize: 10, color: Colors.gray[800], textAlign: 'center', fontWeight: '700' }}>{gradingJson.grading_passes.averaged_rounded.centering ?? '-'}</Text>
                    <Text style={{ width: 36, fontSize: 10, color: Colors.gray[800], textAlign: 'center', fontWeight: '700' }}>{gradingJson.grading_passes.averaged_rounded.corners ?? '-'}</Text>
                    <Text style={{ width: 36, fontSize: 10, color: Colors.gray[800], textAlign: 'center', fontWeight: '700' }}>{gradingJson.grading_passes.averaged_rounded.edges ?? '-'}</Text>
                    <Text style={{ width: 36, fontSize: 10, color: Colors.gray[800], textAlign: 'center', fontWeight: '700' }}>{gradingJson.grading_passes.averaged_rounded.surface ?? '-'}</Text>
                    <Text style={{ width: 36, fontSize: 10, color: Colors.purple[600], textAlign: 'center', fontWeight: '800' }}>{gradingJson.grading_passes.averaged_rounded.final ?? '-'}</Text>
                  </View>
                )}
              </View>
              {/* Consistency */}
              {gradingJson.grading_passes?.consistency && (
                <Text style={[s.priceNote, { marginTop: 4 }]}>Consistency: {gradingJson.grading_passes.consistency} · Variance: {gradingJson.grading_passes.variance ?? '0'}</Text>
              )}
              {/* Consensus notes */}
              {gradingJson.grading_passes?.consensus_notes && (
                <View style={{ marginTop: 6 }}>
                  {(Array.isArray(gradingJson.grading_passes.consensus_notes)
                    ? gradingJson.grading_passes.consensus_notes
                    : [gradingJson.grading_passes.consensus_notes]
                  ).map((note: string, i: number) => (
                    <Text key={i} style={[s.analysisText, { marginTop: 2 }]}>• {note}</Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Final Grade */}
          {gradingJson?.final_grade && (
            <View style={{ marginBottom: 12 }}>
              <Text style={s.reportSubhead}>Final Grade</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 28, fontWeight: '800', color: Colors.purple[600] }}>{gradingJson.final_grade.whole_grade ?? grade}</Text>
                  <Text style={{ fontSize: 10, color: Colors.gray[500] }}>{gradingJson.final_grade.condition_label || card.conversational_condition_label}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  {gradingJson.final_grade.decimal_grade != null && (
                    <InfoRow label="Decimal Grade" value={String(gradingJson.final_grade.decimal_grade)} />
                  )}
                  <InfoRow label="Grade Range" value={card.conversational_grade_uncertainty || '±0'} />
                </View>
              </View>
              {gradingJson.final_grade.summary && (
                <Text style={[s.analysisText, { marginTop: 8 }]}>{gradingJson.final_grade.summary}</Text>
              )}
            </View>
          )}
          {card.conversational_final_grade_summary && !gradingJson?.final_grade?.summary && (
            <View style={{ marginBottom: 12 }}>
              <Text style={s.reportSubhead}>Grading Summary</Text>
              <Text style={s.analysisText}>{card.conversational_final_grade_summary}</Text>
            </View>
          )}

          {/* Metadata */}
          <View style={{ marginTop: 4, borderTopWidth: 1, borderTopColor: Colors.gray[100], paddingTop: 8 }}>
            <InfoRow label="DCM Optic™ Version" value={card.conversational_prompt_version || 'N/A'} />
            <InfoRow label="Graded Date" value={card.created_at ? new Date(card.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'} />
            <InfoRow label="Category" value={card.category} />
            {card.conversational_limiting_factor && (
              <InfoRow label="Limiting Factor" value={card.conversational_limiting_factor} />
            )}
          </View>
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
  confBarContainer: { height: 8, backgroundColor: Colors.gray[200], borderRadius: 4, marginBottom: 10, overflow: 'hidden' as const },
  confBarFill: { height: '100%' as any, borderRadius: 4 },
  confDescription: { fontSize: 12, color: Colors.gray[600], lineHeight: 18, marginBottom: 10 },
  confBadgeLarge: { padding: 16, borderRadius: 12, alignItems: 'center' as const, marginBottom: 12 },
  confBadgeGrade: { fontSize: 16, fontWeight: '700' },
  rawCardNote: { fontSize: 12, color: Colors.gray[500], fontStyle: 'italic', marginTop: 4 },

  // Pricing
  pricingSource: { fontSize: 13, fontWeight: '700', color: Colors.gray[800], marginBottom: 8 },
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceCell: { width: '47%' as any, backgroundColor: Colors.gray[50], borderRadius: 8, padding: 10, alignItems: 'center' },
  priceCellLabel: { fontSize: 11, color: Colors.gray[500] },
  priceCellValue: { fontSize: 16, fontWeight: '700', color: Colors.gray[900], marginTop: 2 },
  priceNote: { fontSize: 11, color: Colors.gray[400], marginTop: 4 },
  dcmPriceCard: { backgroundColor: Colors.green[50], borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.green[100] },
  dcmPrice: { fontSize: 24, fontWeight: '800' as const, color: Colors.green[600] },
  reportSubhead: { fontSize: 12, fontWeight: '700' as const, color: Colors.gray[700], marginBottom: 4 },
  naText: { fontSize: 13, color: Colors.gray[400], fontStyle: 'italic' },

  // Professional grades
  proCard: { backgroundColor: Colors.gray[50], borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.gray[200] },
  proHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  proNumeric: { fontSize: 12, color: Colors.gray[500], marginLeft: 4 },
  proNotes: { fontSize: 11, color: Colors.gray[600], marginTop: 6, lineHeight: 16 },
  proRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
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
