import { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, Image, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, Share, Alert, RefreshControl, Modal, Dimensions, Pressable } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
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
  const [zoomImage, setZoomImage] = useState<string | null>(null)

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

      {/* Image Zoom Modal */}
      <Modal visible={!!zoomImage} transparent animationType="fade" onRequestClose={() => setZoomImage(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setZoomImage(null)}>
          {zoomImage && (
            <Image source={{ uri: zoomImage }} style={{ width: Dimensions.get('window').width - 24, height: Dimensions.get('window').height * 0.7 }} resizeMode="contain" />
          )}
          <Text style={{ color: '#fff', fontSize: 12, marginTop: 12, opacity: 0.6 }}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>

      {/* ══════ SLAB PREVIEW ══════ */}
      <View style={s.slabSection}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => { const url = activeImage === 'front' ? frontUrl : backUrl; if (url) setZoomImage(url) }}>
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
        </TouchableOpacity>
        <Text style={{ fontSize: 9, color: Colors.gray[400], textAlign: 'center', marginTop: 2 }}>Tap image to zoom</Text>
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

      {/* Category badge */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 4 }}>
        <View style={{ backgroundColor: Colors.purple[50], paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: Colors.purple[200] }}>
          <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.purple[700] }}>{card.category || 'Card'}</Text>
        </View>
      </View>

      {/* Serial + QR */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 8 }}>
        <View>
          <Text style={s.serialLabel}>DCM Serial#:</Text>
          <Text style={s.serialValue}>{card.serial}</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            const catPath = card.category?.toLowerCase().replace(' ', '') || 'other'
            Linking.openURL(`https://dcmgrading.com/verify/${card.serial}`)
          }}
          style={{ alignItems: 'center' }}
        >
          <View style={{ width: 48, height: 48, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: Colors.gray[200], justifyContent: 'center', alignItems: 'center', padding: 4 }}>
            <Ionicons name="qr-code" size={32} color={Colors.purple[600]} />
          </View>
          <Text style={{ fontSize: 8, color: Colors.gray[400], marginTop: 2 }}>Verify</Text>
        </TouchableOpacity>
      </View>

      {/* Owner controls: Visibility + Regrade */}
      {isOwner && (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8 }}>
          <TouchableOpacity
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: card.visibility === 'public' ? Colors.green[500] : Colors.gray[300], backgroundColor: card.visibility === 'public' ? Colors.green[50] : Colors.gray[50] }}
            onPress={async () => {
              const newVis = card.visibility === 'public' ? 'private' : 'public'
              await supabase.from('cards').update({ visibility: newVis }).eq('id', card.id)
              setCard((prev: any) => prev ? { ...prev, visibility: newVis } : prev)
            }}
          >
            <Ionicons name={card.visibility === 'public' ? 'eye' : 'eye-off'} size={14} color={card.visibility === 'public' ? Colors.green[600] : Colors.gray[500]} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: card.visibility === 'public' ? Colors.green[600] : Colors.gray[500] }}>{card.visibility === 'public' ? 'Public' : 'Private'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.blue[300], backgroundColor: Colors.blue[50] }}
            onPress={() => {
              Alert.alert('Regrade Card', 'This will use 1 credit to regrade this card with the latest DCM Optic™ AI. Continue?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Regrade', onPress: async () => {
                  const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'
                  const endpoint = card.category === 'Sports' ? 'sports' : card.category === 'Pokemon' ? 'pokemon' : card.category === 'MTG' ? 'mtg' : 'other'
                  try {
                    await fetch(`${API_BASE}/api/${endpoint}/${card.id}`)
                    Alert.alert('Regrading', 'Your card is being regraded. Check back in 1-2 minutes.')
                  } catch {
                    Alert.alert('Error', 'Failed to start regrading.')
                  }
                }},
              ])
            }}
          >
            <Ionicons name="refresh" size={14} color={Colors.blue[600]} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.blue[600] }}>Regrade</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Share Buttons */}
      <View style={s.shareRow}>
        <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
          <Ionicons name="share-social" size={16} color={Colors.purple[600]} />
          <Text style={s.shareBtnText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.shareBtn} onPress={() => {
          const catPath = card.category?.toLowerCase().replace(' ', '') || 'other'
          const url = `https://dcmgrading.com/${catPath}/${card.id}`
          Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)
        }}>
          <Ionicons name="logo-facebook" size={16} color="#1877F2" />
          <Text style={s.shareBtnText}>Facebook</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.shareBtn} onPress={() => {
          const catPath = card.category?.toLowerCase().replace(' ', '') || 'other'
          const url = `https://dcmgrading.com/${catPath}/${card.id}`
          const text = `Check out this ${cardName} graded ${grade}/10 by DCM Grading!`
          Linking.openURL(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`)
        }}>
          <Ionicons name="logo-twitter" size={16} color="#1DA1F2" />
          <Text style={s.shareBtnText}>X</Text>
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
        {/* Professional Slab Detection */}
        {card.slab_detected && card.slab_company && (
          <View style={{ marginHorizontal: 0, marginBottom: 8, borderRadius: 12, borderWidth: 2, borderColor: Colors.amber[500], backgroundColor: Colors.amber[50], padding: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.amber[600], marginBottom: 8 }}>Professional Grade Detected</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: Colors.amber[200] }}>
                <Text style={{ fontSize: 9, color: Colors.gray[500], fontWeight: '600' }}>{card.slab_company}</Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: Colors.amber[600] }}>{card.slab_grade || 'N/A'}</Text>
                <Text style={{ fontSize: 8, color: Colors.gray[400] }}>Professional Grade</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: Colors.purple[200] }}>
                <Text style={{ fontSize: 9, color: Colors.gray[500], fontWeight: '600' }}>DCM Optic™</Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: Colors.purple[600] }}>{grade != null ? Math.round(grade) : 'N/A'}</Text>
                <Text style={{ fontSize: 8, color: Colors.gray[400] }}>Independent Grade</Text>
              </View>
            </View>
            {card.slab_cert_number && <Text style={{ fontSize: 9, color: Colors.gray[500], marginTop: 6 }}>Cert #: {card.slab_cert_number}</Text>}
            <Text style={{ fontSize: 8, color: Colors.gray[400], marginTop: 4 }}>DCM analysis grade is provided as independent verification of the professional grade.</Text>
          </View>
        )}

        <CollapsibleSection title="Card Information" icon="information-circle">
          <InfoRow label="Card Name" value={cardName} />
          <InfoRow label="Set" value={setName} />
          <InfoRow label="Card Number" value={cardNumber} />
          <InfoRow label="Year" value={year} />
          <InfoRow label="Category" value={card.category} />
          {card.sub_category && <InfoRow label="Sub-Category" value={card.sub_category} />}
          <InfoRow label="Manufacturer" value={ci?.manufacturer} />
          {ci?.rarity_tier && <InfoRow label="Rarity" value={ci.rarity_tier} />}
          {ci?.rarity_or_variant && !ci?.rarity_tier && <InfoRow label="Rarity" value={ci.rarity_or_variant} />}
          {ci?.player_or_character && <InfoRow label="Character" value={ci.player_or_character} />}
          {card.rookie_card && <InfoRow label="Rookie Card" value="Yes" />}
          {card.autographed && <InfoRow label="Autograph" value={card.autograph_type || 'Yes'} />}
          {card.memorabilia_type && card.memorabilia_type !== 'none' && <InfoRow label="Memorabilia" value={card.memorabilia_type} />}
          {card.serial_numbering && <InfoRow label="Serial Numbering" value={card.serial_numbering} />}
          {card.is_foil && <InfoRow label="Foil" value={card.foil_type || 'Yes'} />}
          {card.slab_company && <InfoRow label="Slab Company" value={card.slab_company} />}
          {card.slab_grade && <InfoRow label="Slab Grade" value={card.slab_grade} />}
          {/* Edit button */}
          {isOwner && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.purple[50], borderRadius: 8, borderWidth: 1, borderColor: Colors.purple[200], alignSelf: 'flex-start' }}
              onPress={() => {
                Alert.prompt ? Alert.prompt('Edit Card Name', 'Enter new card name:', async (newName) => {
                  if (newName && newName.trim()) {
                    await supabase.from('cards').update({ card_name: newName.trim() }).eq('id', card.id)
                    setCard((prev: any) => prev ? { ...prev, card_name: newName.trim() } : prev)
                  }
                }, 'plain-text', cardName) : Alert.alert('Edit Card', 'Use Label Studio to edit card details.', [
                  { text: 'Open Label Studio', onPress: () => router.push({ pathname: '/pages/label-studio' as any, params: { cardId: card.id } }) },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }}
            >
              <Ionicons name="create-outline" size={14} color={Colors.purple[600]} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.purple[600] }}>Edit Card Info</Text>
            </TouchableOpacity>
          )}
        </CollapsibleSection>

        {/* ══════ 2. CENTERING ANALYSIS ══════ */}
        <CollapsibleSection title={`Centering Analysis${sub?.centering != null ? `  ${Math.round(sub.centering)}/10` : ''}`} icon="resize">
          {cen ? (
            <>
              {/* Front and Back centering cards */}
              {['front', 'back'].map(side => {
                const sideData = (cen as any)?.[side] || cen
                const lr = sideData?.left_right || sideData?.[`${side}_left_right`] || sideData?.[`${side}_lr`] || 'N/A'
                const tb = sideData?.top_bottom || sideData?.[`${side}_top_bottom`] || sideData?.[`${side}_tb`] || 'N/A'
                const tier = sideData?.quality_tier || sideData?.[`${side}_quality_tier`] || null
                const analysis = sideData?.analysis || sideData?.[`${side}_analysis`] || sideData?.[`${side}_notes`] || null
                const scoreVal = sideData?.score ?? (sub?.centering != null ? Math.round(sub.centering) : null)
                const imageUrl = side === 'front' ? frontUrl : backUrl
                const measurements = sideData?.measurements
                const cardType = sideData?.card_type
                const measureMethod = sideData?.measurement_method
                const worstAxis = sideData?.worst_axis

                // Quality tier color
                const tierColor = tier === 'Perfect' || tier === 'Excellent' ? Colors.green[600]
                  : tier === 'Good' ? Colors.blue[600]
                  : tier === 'Fair' ? Colors.amber[600]
                  : tier === 'Off-Center' ? Colors.red[600] : Colors.gray[600]
                const tierIcon = tier === 'Perfect' || tier === 'Excellent' || tier === 'Good' ? '✓' : tier === 'Fair' ? '⚠' : tier === 'Off-Center' ? '✗' : '•'
                const tierBg = tier === 'Perfect' || tier === 'Excellent' ? Colors.green[50]
                  : tier === 'Good' ? Colors.blue[50]
                  : tier === 'Fair' ? Colors.amber[50]
                  : tier === 'Off-Center' ? Colors.red[50] : Colors.gray[50]

                return (
                  <View key={side} style={{ marginBottom: 16, backgroundColor: Colors.purple[50], borderRadius: 12, borderWidth: 1, borderColor: Colors.purple[200], overflow: 'hidden' }}>
                    {/* Side header */}
                    <LinearGradient colors={[Colors.purple[600], '#4f46e5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 6, paddingHorizontal: 12 }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{side === 'front' ? 'Front' : 'Back'}</Text>
                    </LinearGradient>

                    <View style={{ padding: 12 }}>
                      {/* Score + Image row */}
                      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                        {/* Score display */}
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 9, color: Colors.gray[500], fontWeight: '600' }}>Centering Score</Text>
                          <Text style={{ fontSize: 28, fontWeight: '800', color: Colors.purple[600] }}>{scoreVal ?? 'N/A'}<Text style={{ fontSize: 14, color: Colors.gray[400] }}>/10</Text></Text>
                        </View>
                        {/* Card image */}
                        {imageUrl && (
                          <View style={{ flex: 1 }}>
                            <Image source={{ uri: imageUrl }} style={{ width: '100%', aspectRatio: 2.5 / 3.5, borderRadius: 8, borderWidth: 3, borderColor: Colors.purple[300] }} resizeMode="contain" />
                          </View>
                        )}
                      </View>

                      {/* DCM Optic Analysis box */}
                      <View style={{ backgroundColor: '#fff', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.purple[200] }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.purple[700] }}>DCM Optic™ Analysis</Text>
                          {tier && <Text style={{ fontSize: 12 }}>{tierIcon}</Text>}
                        </View>

                        {/* Ratio info box */}
                        <View style={{ backgroundColor: Colors.gray[50], borderRadius: 8, padding: 8, gap: 4 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 10, color: Colors.gray[500], fontWeight: '600' }}>Horizontal (L/R):</Text>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.purple[700] }}>{lr}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 10, color: Colors.gray[500], fontWeight: '600' }}>Vertical (T/B):</Text>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.purple[700] }}>{tb}</Text>
                          </View>
                          {tier && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 10, color: Colors.gray[500], fontWeight: '600' }}>Quality:</Text>
                              <View style={{ backgroundColor: tierBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: tierColor }}>{tier}</Text>
                              </View>
                            </View>
                          )}
                        </View>

                        {/* Analysis text */}
                        {analysis && <Text style={{ fontSize: 10, color: Colors.gray[600], lineHeight: 15, marginTop: 6 }}>{analysis}</Text>}
                      </View>

                      {/* Card type + measurements */}
                      {(cardType || measurements) && (
                        <View style={{ marginTop: 6 }}>
                          {cardType && <Text style={{ fontSize: 9, color: Colors.gray[400] }}>Card type: {cardType}. {measureMethod || ''}</Text>}
                          {measurements && <Text style={{ fontSize: 9, color: Colors.gray[400] }}>{measurements}</Text>}
                        </View>
                      )}
                    </View>
                  </View>
                )
              })}

              {/* Orientation info */}
              {(() => {
                const frontData = (cen as any)?.front || cen
                const worstAxis = frontData?.worst_axis
                if (!worstAxis) return null
                return (
                  <View style={{ backgroundColor: '#eef2ff', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#c7d2fe', marginBottom: 8 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#4338ca', marginBottom: 4 }}>Card Orientation</Text>
                    <InfoRow label="Worst Axis" value={worstAxis.replace('_', ' ')} />
                  </View>
                )
              })()}

              {/* How Centering Was Measured (accordion) */}
              {(() => {
                const frontData = (cen as any)?.front || {}
                const backData = (cen as any)?.back || {}
                const hasMeasurementDetails = frontData.measurement_method || frontData.card_type
                if (!hasMeasurementDetails) return null
                return (
                  <CollapsibleSection title="How Centering Was Measured" icon="help-circle">
                    {frontData.analysis && (
                      <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.blue[100], marginBottom: 8 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.blue[600], marginBottom: 4 }}>Front Analysis</Text>
                        <Text style={{ fontSize: 10, color: Colors.gray[600], lineHeight: 15 }}>{frontData.analysis}</Text>
                      </View>
                    )}
                    {backData.analysis && (
                      <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#06b6d4', marginBottom: 8 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#0891b2', marginBottom: 4 }}>Back Analysis</Text>
                        <Text style={{ fontSize: 10, color: Colors.gray[600], lineHeight: 15 }}>{backData.analysis}</Text>
                      </View>
                    )}
                    <View style={{ backgroundColor: Colors.amber[50], borderRadius: 8, padding: 8, borderWidth: 1, borderColor: Colors.amber[100] }}>
                      <Text style={{ fontSize: 9, color: Colors.amber[600] }}>This analysis explains the specific visual elements and measurements used to determine centering ratios.</Text>
                    </View>
                  </CollapsibleSection>
                )
              })()}
            </>
          ) : (
            <Text style={s.naText}>No centering data available</Text>
          )}
        </CollapsibleSection>

        {/* ══════ 3. CORNERS, EDGES & SURFACE ANALYSIS ══════ */}
        <CollapsibleSection title="Corners, Edges & Surface Analysis" icon="cube">
          {/* Subgrade score row */}
          {sub && (
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {[{ label: 'Corners', score: sub.corners }, { label: 'Edges', score: sub.edges }, { label: 'Surface', score: sub.surface }].map(sg => {
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

          {/* Front and Back sides */}
          {['front', 'back'].map(side => {
            const imageUrl = side === 'front' ? frontUrl : backUrl
            const isBlue = side === 'front'
            const headerColors: [string, string] = isBlue ? [Colors.blue[600], '#4f46e5'] : [Colors.purple[600], '#db2777']
            const themeBg = isBlue ? Colors.blue[50] : Colors.purple[50]
            const themeBorder = isBlue ? Colors.blue[100] : Colors.purple[100]
            const themeText = isBlue ? Colors.blue[600] : Colors.purple[600]
            const themeHeading = isBlue ? Colors.blue[600] : Colors.purple[600]

            const cornersData = gradingJson?.corners?.[side]
            const edgesData = gradingJson?.edges?.[side]
            const surfaceData = gradingJson?.surface?.[side]

            // Also try CES from column
            const cesRaw = card.conversational_corners_edges_surface || gradingJson?.corners_edges_surface
            const ces = cesRaw ? (typeof cesRaw === 'string' ? JSON.parse(cesRaw) : cesRaw) : null

            const hasData = cornersData || edgesData || surfaceData || imageUrl

            if (!hasData) return null

            return (
              <View key={side} style={{ marginBottom: 16, borderRadius: 12, borderWidth: 1, borderColor: themeBorder, overflow: 'hidden' }}>
                {/* Side header */}
                <LinearGradient colors={headerColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{side === 'front' ? 'Front Side' : 'Back Side'}</Text>
                </LinearGradient>

                <View style={{ padding: 10 }}>
                  {/* Corner zoom images */}
                  {imageUrl && !card.slab_detected && (
                    <View style={{ marginBottom: 10 }}>
                      <CornerZoomGrid imageUrl={imageUrl} side={side === 'front' ? 'Front' : 'Back'} />
                    </View>
                  )}

                  {/* Corners */}
                  {cornersData && (
                    <View style={{ marginBottom: 10, backgroundColor: themeBg, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: themeBorder }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: themeHeading }}>Corners</Text>
                        {cornersData.score != null && <Text style={{ fontSize: 13, fontWeight: '800', color: themeText }}>{cornersData.score}/10</Text>}
                      </View>
                      {/* Per-corner detail grid */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                        {['top_left', 'top_right', 'bottom_left', 'bottom_right'].map(pos => {
                          const cd = cornersData[pos]
                          if (!cd) return null
                          const label = pos.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                          const text = typeof cd === 'object' ? cd.condition : (typeof cd === 'string' ? cd : null)
                          const score = typeof cd === 'object' ? cd.score : null
                          return (
                            <View key={pos} style={{ width: '48%', backgroundColor: '#fff', borderRadius: 6, padding: 6, borderWidth: 1, borderColor: themeBorder }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 9, fontWeight: '700', color: Colors.gray[700] }}>{label}</Text>
                                {score != null && <Text style={{ fontSize: 9, fontWeight: '700', color: themeText }}>{score}/10</Text>}
                              </View>
                              {text && <Text style={{ fontSize: 8, color: Colors.gray[500], lineHeight: 12, marginTop: 2 }} numberOfLines={4}>{text}</Text>}
                            </View>
                          )
                        })}
                      </View>
                      {cornersData.summary && (
                        <View style={{ marginTop: 6, borderTopWidth: 1, borderTopColor: themeBorder, paddingTop: 6 }}>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: themeText }}>DCM Optic™ Analysis:</Text>
                          <Text style={{ fontSize: 9, color: Colors.gray[600], lineHeight: 13, marginTop: 2 }}>{cornersData.summary}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Edges */}
                  {edgesData && (
                    <View style={{ marginBottom: 10, backgroundColor: themeBg, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: themeBorder }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: themeHeading }}>Edges</Text>
                        {edgesData.score != null && <Text style={{ fontSize: 13, fontWeight: '800', color: themeText }}>{edgesData.score}/10</Text>}
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                        {['top', 'bottom', 'left', 'right'].map(pos => {
                          const ed = edgesData[pos]
                          if (!ed) return null
                          const label = pos.charAt(0).toUpperCase() + pos.slice(1)
                          const text = typeof ed === 'object' ? ed.condition : (typeof ed === 'string' ? ed : null)
                          const score = typeof ed === 'object' ? ed.score : null
                          return (
                            <View key={pos} style={{ width: '48%', backgroundColor: '#fff', borderRadius: 6, padding: 6, borderWidth: 1, borderColor: themeBorder }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 9, fontWeight: '700', color: Colors.gray[700] }}>{label}</Text>
                                {score != null && <Text style={{ fontSize: 9, fontWeight: '700', color: themeText }}>{score}/10</Text>}
                              </View>
                              {text && <Text style={{ fontSize: 8, color: Colors.gray[500], lineHeight: 12, marginTop: 2 }} numberOfLines={4}>{text}</Text>}
                            </View>
                          )
                        })}
                      </View>
                      {edgesData.summary && (
                        <View style={{ marginTop: 6, borderTopWidth: 1, borderTopColor: themeBorder, paddingTop: 6 }}>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: themeText }}>DCM Optic™ Analysis:</Text>
                          <Text style={{ fontSize: 9, color: Colors.gray[600], lineHeight: 13, marginTop: 2 }}>{edgesData.summary}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Surface */}
                  {surfaceData && (
                    <View style={{ backgroundColor: themeBg, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: themeBorder }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: themeHeading }}>Surface</Text>
                        {surfaceData.score != null && <Text style={{ fontSize: 13, fontWeight: '800', color: themeText }}>{surfaceData.score}/10</Text>}
                      </View>
                      {surfaceData.finish_type && <Text style={{ fontSize: 9, color: Colors.gray[500], marginBottom: 4 }}>Finish: {surfaceData.finish_type}</Text>}
                      {surfaceData.condition && <Text style={{ fontSize: 9, color: Colors.gray[600], lineHeight: 13 }}>{surfaceData.condition}</Text>}
                      {surfaceData.defects && Array.isArray(surfaceData.defects) && surfaceData.defects.length > 0 && (
                        <View style={{ marginTop: 6 }}>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: Colors.gray[700], marginBottom: 2 }}>Defects:</Text>
                          {surfaceData.defects.map((d: any, i: number) => (
                            <View key={i} style={{ backgroundColor: '#fff', borderRadius: 4, padding: 4, marginTop: 2, borderWidth: 1, borderColor: themeBorder }}>
                              <Text style={{ fontSize: 8, fontWeight: '600', color: Colors.gray[700] }}>{d.type} ({d.severity})</Text>
                              {d.location && <Text style={{ fontSize: 8, color: Colors.gray[500] }}>Location: {d.location}</Text>}
                              {d.description && <Text style={{ fontSize: 8, color: Colors.gray[500] }}>{d.description}</Text>}
                            </View>
                          ))}
                        </View>
                      )}
                      {surfaceData.summary && (
                        <View style={{ marginTop: 6, borderTopWidth: 1, borderTopColor: themeBorder, paddingTop: 6 }}>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: themeText }}>DCM Optic™ Analysis:</Text>
                          <Text style={{ fontSize: 9, color: Colors.gray[600], lineHeight: 13, marginTop: 2 }}>{surfaceData.summary}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
            )
          })}

          {/* Detailed defects fallback */}
          {(card.conversational_defects_front || card.conversational_defects_back) && (
            <View style={{ marginTop: 4 }}>
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
        <CollapsibleSection title={`Market Value${card.dcm_price_estimate ? `  ~$${card.dcm_price_estimate.toFixed(2)}` : ''}`} icon="trending-up">
          {(() => {
            const cached = card.dcm_cached_prices
            const prices = cached?.prices
            const raw = prices?.raw
            const dcmEst = cached?.estimatedValue || card.dcm_price_estimate
            const salesVol = prices?.salesVolume
            const matchConf = cached?.matchConfidence || card.dcm_price_match_confidence
            const prodName = prices?.productName || card.dcm_price_product_name

            // Build price-by-grade chart data
            const chartData: { label: string; price: number; color: string }[] = []
            if (raw && raw > 0) chartData.push({ label: 'Raw', price: raw, color: Colors.amber[500] })
            if (prices?.psa) {
              ['7','8','9','9.5','10'].forEach(g => {
                const p = prices.psa[g]
                if (p && p > 0) chartData.push({ label: `Grade ${g}`, price: p, color: Colors.green[500] })
              })
            }
            if (dcmEst && dcmEst > 0) chartData.push({ label: `DCM ${grade || ''}`, price: dcmEst, color: Colors.purple[600] })
            chartData.sort((a, b) => a.price - b.price)
            const maxPrice = Math.max(...chartData.map(d => d.price), 1)

            // Grading premium
            const psa10 = prices?.psa?.['10']
            const premium = raw && psa10 && raw > 0 ? Math.round(((psa10 - raw) / raw) * 100) : null

            return (
              <>
                {/* DCM Estimated Value */}
                {dcmEst != null && (
                  <View style={s.dcmPriceCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={s.pricingSource}>Your DCM Grade</Text>
                        <Text style={s.dcmPrice}>${dcmEst.toFixed(2)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 28, fontWeight: '800', color: Colors.purple[600] }}>{grade}</Text>
                        <Text style={{ fontSize: 9, color: Colors.gray[500] }}>Estimated Value</Text>
                      </View>
                    </View>
                    {matchConf && <Text style={[s.priceNote, { marginTop: 4 }]}>Match: {matchConf} · {prodName || ''}</Text>}
                    {card.dcm_prices_cached_at && (
                      <Text style={s.priceNote}>Updated: {new Date(card.dcm_prices_cached_at).toLocaleDateString()}</Text>
                    )}
                  </View>
                )}

                {/* Market Price Range */}
                {prices && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={s.pricingSource}>Market Price Range</Text>
                    {salesVol && <Text style={[s.priceNote, { marginBottom: 4 }]}>Sales Volume: {salesVol}</Text>}
                    <View style={s.priceGrid}>
                      <PriceCell label="Low" value={raw} />
                      <PriceCell label="Median" value={prices.psa?.['9'] || card.ebay_price_median} />
                      <PriceCell label="Average" value={card.dcm_price_average || dcmEst} />
                      <PriceCell label="High" value={psa10 || prices.bgs?.['10'] || card.ebay_price_highest} />
                    </View>
                    {premium != null && <Text style={[s.priceNote, { marginTop: 4, color: Colors.green[600] }]}>Grading premium: +{premium}% from raw to graded</Text>}
                  </View>
                )}

                {/* Price by Grade Chart */}
                {chartData.length >= 2 && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={s.pricingSource}>Price by Grade</Text>
                    <Text style={[s.priceNote, { marginBottom: 8 }]}>Market prices from raw to graded</Text>
                    {chartData.map((d, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ width: 55, fontSize: 10, color: Colors.gray[600], fontWeight: '500' }}>{d.label}</Text>
                        <View style={{ flex: 1, height: 18, backgroundColor: Colors.gray[100], borderRadius: 4, overflow: 'hidden' }}>
                          <View style={{ width: `${Math.max(5, (d.price / maxPrice) * 100)}%`, height: '100%', backgroundColor: d.color, borderRadius: 4, justifyContent: 'center', paddingLeft: 4 }}>
                            {d.price >= maxPrice * 0.15 && <Text style={{ fontSize: 8, color: '#fff', fontWeight: '700' }}>${d.price.toFixed(2)}</Text>}
                          </View>
                        </View>
                        {d.price < maxPrice * 0.15 && <Text style={{ fontSize: 8, color: Colors.gray[500], marginLeft: 4 }}>${d.price.toFixed(2)}</Text>}
                      </View>
                    ))}
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: Colors.amber[500] }} />
                        <Text style={{ fontSize: 8, color: Colors.gray[500] }}>Raw</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: Colors.purple[600] }} />
                        <Text style={{ fontSize: 8, color: Colors.gray[500] }}>DCM</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: Colors.green[500] }} />
                        <Text style={{ fontSize: 8, color: Colors.gray[500] }}>PSA/BGS/CGC</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Grading Company Prices */}
                {prices && (prices.psa || prices.bgs || prices.cgc) && (
                  <View style={{ marginTop: 14 }}>
                    {['PSA', 'BGS', 'SGC', 'CGC'].map(company => {
                      const companyPrices = prices[company.toLowerCase() as 'psa' | 'bgs' | 'cgc']
                      if (!companyPrices || Object.keys(companyPrices).length === 0) return null
                      const sorted = Object.entries(companyPrices).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
                      return (
                        <View key={company} style={{ marginBottom: 10 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.gray[700], marginBottom: 4 }}>{company}</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                            {sorted.map(([g, p]) => (
                              <View key={g} style={{ backgroundColor: parseFloat(g) >= 9 ? Colors.green[50] : Colors.gray[50], borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: parseFloat(g) >= 9 ? Colors.green[100] : Colors.gray[200] }}>
                                <Text style={{ fontSize: 9, fontWeight: '700', color: Colors.gray[700] }}>Grade {g}</Text>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: parseFloat(g) >= 9 ? Colors.green[600] : Colors.gray[800] }}>${(p as number).toFixed(2)}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )
                    })}
                    <Text style={[s.priceNote, { marginTop: 4 }]}>Data from PriceCharting</Text>
                  </View>
                )}

                {/* eBay fallback */}
                {!prices && card.ebay_price_median != null && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={s.pricingSource}>eBay Comparable Sales</Text>
                    <View style={s.priceGrid}>
                      <PriceCell label="Lowest" value={card.ebay_price_lowest} />
                      <PriceCell label="Median" value={card.ebay_price_median} />
                      <PriceCell label="Average" value={card.ebay_price_average} />
                      <PriceCell label="Highest" value={card.ebay_price_highest} />
                    </View>
                    {card.ebay_price_listing_count != null && <Text style={s.priceNote}>{card.ebay_price_listing_count} listings found</Text>}
                  </View>
                )}

                {/* TCG Market */}
                {card.scryfall_price_usd != null && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={s.pricingSource}>TCG Market Price</Text>
                    <Text style={s.dcmPrice}>${card.scryfall_price_usd}</Text>
                  </View>
                )}

                {!dcmEst && !prices && !card.ebay_price_median && !card.scryfall_price_usd && (
                  <Text style={s.naText}>No pricing data available yet. Pricing is fetched automatically after grading.</Text>
                )}
              </>
            )
          })()}
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
          {/* Card Info — from card_info column or grading JSON */}
          {(() => {
            const info = ci || gradingJson?.card_info
            if (!info) return null
            return (
              <View style={{ marginBottom: 12 }}>
                <Text style={s.reportSubhead}>Card Information</Text>
                <InfoRow label="Card Name" value={info.card_name || cardName} />
                <InfoRow label="Set Name" value={info.set_name || setName} />
                {info.year && <InfoRow label="Year" value={info.year} />}
                {info.manufacturer && <InfoRow label="Manufacturer" value={info.manufacturer} />}
                {info.card_number && <InfoRow label="Card Number" value={info.card_number} />}
                {info.player_or_character && <InfoRow label="Character" value={info.player_or_character} />}
                {info.authentic != null && <InfoRow label="Authentic" value={String(info.authentic)} />}
                {info.rarity_tier && <InfoRow label="Rarity Tier" value={info.rarity_tier} />}
                {info.subset && <InfoRow label="Subset" value={info.subset} />}
                {info.serial_number && <InfoRow label="Serial Number" value={info.serial_number} />}
                {info.card_type && <InfoRow label="Card Type" value={info.card_type} />}
                {info.game && <InfoRow label="Game" value={info.game} />}
                {info.card_front_text && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={{ fontSize: 9, fontWeight: '600', color: Colors.gray[500] }}>Card Front Text:</Text>
                    <Text style={[s.analysisText, { fontSize: 10 }]}>{info.card_front_text}</Text>
                  </View>
                )}
                {info.card_back_text && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={{ fontSize: 9, fontWeight: '600', color: Colors.gray[500] }}>Card Back Text:</Text>
                    <Text style={[s.analysisText, { fontSize: 10 }]}>{info.card_back_text}</Text>
                  </View>
                )}
              </View>
            )
          })()}

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

          {/* Centering Analysis from grading JSON */}
          {gradingJson?.centering && (
            <View style={{ marginBottom: 12 }}>
              <Text style={s.reportSubhead}>Centering Analysis</Text>
              {['front', 'back'].map(side => {
                const sd = gradingJson.centering[side]
                if (!sd) return null
                return (
                  <View key={side} style={{ marginTop: 6, backgroundColor: Colors.gray[50], borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.gray[200] }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.gray[700] }}>{side === 'front' ? 'Front' : 'Back'}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.purple[600] }}>{sd.score}/10</Text>
                    </View>
                    {sd.card_type && <Text style={s.priceNote}>Card type: {sd.card_type}. {sd.measurement_method}</Text>}
                    {sd.measurements && <Text style={[s.priceNote, { marginTop: 2 }]}>{sd.measurements}</Text>}
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                      <InfoRow label="L/R" value={sd.left_right || 'N/A'} />
                      <InfoRow label="T/B" value={sd.top_bottom || 'N/A'} />
                    </View>
                    {sd.quality_tier && <Text style={[s.centeringTier, { marginTop: 4 }]}>Quality: {sd.quality_tier}</Text>}
                    {sd.analysis && <Text style={[s.analysisText, { marginTop: 4 }]}>{sd.analysis}</Text>}
                  </View>
                )
              })}
            </View>
          )}

          {/* Corner Analysis from grading JSON */}
          {gradingJson?.corners && (
            <View style={{ marginBottom: 12 }}>
              <Text style={s.reportSubhead}>Corner Analysis</Text>
              {['front', 'back'].map(side => {
                const sd = gradingJson.corners[side]
                if (!sd) return null
                return (
                  <View key={side} style={{ marginTop: 6, backgroundColor: Colors.gray[50], borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.gray[200] }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.gray[700] }}>{side === 'front' ? 'Front' : 'Back'}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.purple[600] }}>{sd.score}/10</Text>
                    </View>
                    {sd.summary && <Text style={s.analysisText}>{sd.summary}</Text>}
                    {['top_left', 'top_right', 'bottom_left', 'bottom_right'].map(corner => {
                      const cd = sd[corner]
                      if (!cd) return null
                      const label = corner.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                      const score = typeof cd === 'object' ? cd.score : null
                      const text = typeof cd === 'object' ? cd.condition : (typeof cd === 'string' ? cd : null)
                      return (
                        <View key={corner} style={{ marginTop: 4, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: Colors.purple[200] }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.gray[700] }}>{label}{score != null ? ` (${score}/10)` : ''}</Text>
                          {text && <Text style={[s.analysisText, { fontSize: 10 }]}>{text}</Text>}
                        </View>
                      )
                    })}
                  </View>
                )
              })}
            </View>
          )}

          {/* Edge Analysis from grading JSON */}
          {gradingJson?.edges && (
            <View style={{ marginBottom: 12 }}>
              <Text style={s.reportSubhead}>Edge Analysis</Text>
              {['front', 'back'].map(side => {
                const sd = gradingJson.edges[side]
                if (!sd) return null
                return (
                  <View key={side} style={{ marginTop: 6, backgroundColor: Colors.gray[50], borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.gray[200] }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.gray[700] }}>{side === 'front' ? 'Front' : 'Back'}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.purple[600] }}>{sd.score}/10</Text>
                    </View>
                    {sd.summary && <Text style={s.analysisText}>{sd.summary}</Text>}
                    {['top', 'bottom', 'left', 'right'].map(edge => {
                      const ed = sd[edge]
                      if (!ed) return null
                      const label = edge.charAt(0).toUpperCase() + edge.slice(1)
                      const score = typeof ed === 'object' ? ed.score : null
                      const text = typeof ed === 'object' ? ed.condition : (typeof ed === 'string' ? ed : null)
                      return (
                        <View key={edge} style={{ marginTop: 4, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: Colors.purple[200] }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.gray[700] }}>{label}{score != null ? ` (${score}/10)` : ''}</Text>
                          {text && <Text style={[s.analysisText, { fontSize: 10 }]}>{text}</Text>}
                        </View>
                      )
                    })}
                  </View>
                )
              })}
            </View>
          )}

          {/* Surface Analysis from grading JSON */}
          {gradingJson?.surface && (
            <View style={{ marginBottom: 12 }}>
              <Text style={s.reportSubhead}>Surface Analysis</Text>
              {['front', 'back'].map(side => {
                const sd = gradingJson.surface[side]
                if (!sd) return null
                return (
                  <View key={side} style={{ marginTop: 6, backgroundColor: Colors.gray[50], borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.gray[200] }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.gray[700] }}>{side === 'front' ? 'Front' : 'Back'}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.purple[600] }}>{sd.score}/10</Text>
                    </View>
                    {sd.finish_type && <Text style={s.priceNote}>Finish: {sd.finish_type}</Text>}
                    {sd.condition && <Text style={[s.analysisText, { marginTop: 4 }]}>{sd.condition}</Text>}
                    {sd.summary && <Text style={[s.analysisText, { marginTop: 4, fontStyle: 'italic' }]}>DCM Optic™ Analysis: {sd.summary}</Text>}
                  </View>
                )
              })}
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

          {/* Evaluation Details */}
          {(() => {
            const meta = gradingJson?.metadata || {}
            const modelVersion = meta.model_version || card.conversational_prompt_version || null

            return (
              <View style={{ marginTop: 12, backgroundColor: Colors.gray[50], borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.gray[200] }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.gray[800], marginBottom: 8 }}>Evaluation Details</Text>
                {modelVersion && <InfoRow label="DCM Optic™ Version" value={modelVersion} />}
                <InfoRow label="Graded Date" value={card.created_at ? new Date(card.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'} />
                <InfoRow label="Category" value={card.category} />
              </View>
            )
          })()}
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
