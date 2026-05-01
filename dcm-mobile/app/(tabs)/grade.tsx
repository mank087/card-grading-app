import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Modal, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors, CardCategories } from '@/lib/constants'
import { useCredits } from '@/contexts/CreditsContext'
import { purchaseCredits, CREDIT_TIERS } from '@/lib/stripe'
import Button from '@/components/ui/Button'
import PhotoTipsModal, { shouldShowPhotoTips } from '@/components/PhotoTipsModal'

const OTHER_SUB_CATEGORIES_GROUPED = {
  'TCG': ['Digimon', 'Dragon Ball', 'Flesh and Blood', 'Cardfight!! Vanguard', 'Weiss Schwarz', 'MetaZoo', 'Force of Will', 'Final Fantasy TCG', 'Universus', 'Battle Spirits', 'Shadowverse Evolve', 'Union Arena'],
  'Entertainment': ['Star Wars', 'Marvel', 'DC Comics', 'Disney', 'Garbage Pail Kids', 'Wacky Packages', 'WWE / Wrestling', 'Movie / TV', 'Music', 'Anime'],
  'Vintage': ['Non-Sport Vintage', 'Art Cards', 'Promotional', 'Racing', 'Historical'],
  'Other': ['Other'],
}
const OTHER_SUB_CATEGORIES = Object.values(OTHER_SUB_CATEGORIES_GROUPED).flat()

export default function GradeScreen() {
  const router = useRouter()
  const { balance, refresh } = useCredits()
  const [selectedCategory, setSelectedCategory] = useState('Sports')
  const [subCategory, setSubCategory] = useState('')
  const [showSubCategories, setShowSubCategories] = useState(false)
  const [subCategoryDropdownOpen, setSubCategoryDropdownOpen] = useState(false)

  const canGrade = balance >= 1 && (selectedCategory !== 'Other' || subCategory !== '')

  // Pro Tip modal — gates the Camera/Gallery tap so the tips show before the
  // capture screen. Once dismissed, navigate to /grade/capture in the chosen mode.
  const [tipsVisible, setTipsVisible] = useState(false)
  const [tipsLoaded, setTipsLoaded] = useState(false)
  const [shouldGateOnTips, setShouldGateOnTips] = useState(true)
  const [pendingMode, setPendingMode] = useState<'camera' | 'gallery' | null>(null)

  useEffect(() => {
    shouldShowPhotoTips().then(should => {
      setShouldGateOnTips(should)
      setTipsLoaded(true)
    })
  }, [])

  const navigateToCapture = (mode: 'camera' | 'gallery') => {
    router.push({
      pathname: '/grade/capture',
      params: { category: selectedCategory, subCategory, mode, tipsAcked: '1' },
    })
  }

  const handleStart = (mode: 'camera' | 'gallery') => {
    if (!canGrade) {
      if (balance < 1) Alert.alert('Insufficient Credits', 'You need at least 1 credit to grade a card.')
      return
    }
    if (shouldGateOnTips && tipsLoaded) {
      setPendingMode(mode)
      setTipsVisible(true)
    } else {
      navigateToCapture(mode)
    }
  }

  const handleCamera = () => handleStart('camera')
  const handleGallery = () => handleStart('gallery')

  // Legacy state — referenced by the gallery button label below; keep at idle.
  const galleryStep: 'idle' | 'front' | 'back' | 'processing' = 'idle'

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header with credit balance */}
      <View style={styles.header}>
        <Image source={require('@/assets/images/dcm-logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.headerTitle}>Grade Your Card</Text>
        <Text style={styles.headerSubtitle}>
          Upload photos of your card for professional AI grading
        </Text>
        <View style={styles.creditBadge}>
          <Ionicons name="diamond" size={14} color={Colors.purple[600]} />
          <Text style={styles.creditBadgeText}>{balance} credits available</Text>
        </View>
      </View>

      {/* Category Dropdown */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Card Type</Text>
        <View style={styles.categoryDropdown}>
          {CardCategories.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryPill,
                selectedCategory === cat.key && styles.categoryPillActive,
              ]}
              onPress={() => {
                setSelectedCategory(cat.key)
                setSubCategory('')
                setShowSubCategories(cat.key === 'Other')
              }}
            >
              <Text style={[
                styles.categoryPillText,
                selectedCategory === cat.key && styles.categoryPillTextActive,
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sub-category for Other — dropdown matches the web's grouped select */}
        {selectedCategory === 'Other' && (
          <View style={styles.subCategoryContainer}>
            <Text style={styles.subCategoryLabel}>Sub-Category <Text style={{ color: Colors.red[500] }}>*</Text></Text>
            <TouchableOpacity
              style={[styles.subDropdown, !subCategory && styles.subDropdownPlaceholder]}
              onPress={() => setSubCategoryDropdownOpen(true)}
            >
              <Text style={[styles.subDropdownText, !subCategory && styles.subDropdownTextPlaceholder]}>
                {subCategory || 'Select sub-category…'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={Colors.gray[500]} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Sub-category dropdown modal */}
      <Modal visible={subCategoryDropdownOpen} transparent animationType="slide" onRequestClose={() => setSubCategoryDropdownOpen(false)}>
        <Pressable style={styles.dropdownBackdrop} onPress={() => setSubCategoryDropdownOpen(false)}>
          <Pressable style={styles.dropdownSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.dropdownHandle} />
            <Text style={styles.dropdownTitle}>Select Sub-Category</Text>
            <ScrollView style={{ maxHeight: 480 }}>
              {(Object.entries(OTHER_SUB_CATEGORIES_GROUPED) as Array<[string, string[]]>).map(([group, items]) => (
                <View key={group} style={{ marginBottom: 12 }}>
                  <Text style={styles.dropdownGroupLabel}>{group}</Text>
                  {items.map(sub => {
                    const isSelected = subCategory === sub
                    return (
                      <TouchableOpacity
                        key={sub}
                        style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                        onPress={() => { setSubCategory(sub); setSubCategoryDropdownOpen(false) }}
                      >
                        <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>{sub}</Text>
                        {isSelected && <Ionicons name="checkmark" size={18} color={Colors.purple[600]} />}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Upload Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Upload Photos</Text>
        <Text style={styles.sectionHint}>Take photos or select from your gallery</Text>

        <View style={styles.uploadActions}>
          <TouchableOpacity
            style={[styles.uploadButton, styles.cameraButton, !canGrade && styles.uploadButtonDisabled]}
            onPress={handleCamera}
            disabled={!canGrade}
            activeOpacity={0.7}
          >
            <View style={styles.uploadIconContainer}>
              <Ionicons name="camera" size={32} color={canGrade ? Colors.purple[600] : Colors.gray[400]} />
            </View>
            <Text style={[styles.uploadButtonTitle, !canGrade && styles.uploadButtonTitleDisabled]}>Camera</Text>
            <Text style={styles.uploadButtonSubtitle}>Take photos now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadButton, styles.galleryButton, !canGrade && styles.uploadButtonDisabled]}
            onPress={handleGallery}
            disabled={!canGrade || galleryStep !== 'idle'}
            activeOpacity={0.7}
          >
            <View style={styles.uploadIconContainer}>
              <Ionicons
                name={galleryStep === 'processing' ? 'hourglass' : 'images'}
                size={32}
                color={canGrade ? Colors.blue[600] : Colors.gray[400]}
              />
            </View>
            <Text style={[styles.uploadButtonTitle, !canGrade && styles.uploadButtonTitleDisabled]}>
              {galleryStep === 'front' ? 'Select Front...' :
               galleryStep === 'back' ? 'Select Back...' :
               galleryStep === 'processing' ? 'Processing...' : 'Gallery'}
            </Text>
            <Text style={styles.uploadButtonSubtitle}>
              {galleryStep === 'idle' ? 'Choose from photos' : 'Selecting images'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Credit Packages — shown when low or always accessible */}
      {balance < 3 && (
        <View style={styles.creditsSection}>
          {balance < 1 && (
            <View style={styles.noCredits}>
              <Ionicons name="warning" size={24} color={Colors.amber[600]} />
              <Text style={styles.noCreditsTitle}>Insufficient Credits</Text>
              <Text style={styles.noCreditsText}>You need at least 1 credit to grade a card</Text>
            </View>
          )}
          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Purchase Credits</Text>
          <View style={styles.tierGrid}>
            {CREDIT_TIERS.map(tier => (
              <TouchableOpacity
                key={tier.id}
                style={[styles.tierCard, tier.popular && styles.tierCardPopular]}
                onPress={async () => {
                  const result = await purchaseCredits(tier.id)
                  if (result.success) {
                    Alert.alert('Payment Successful!', `${result.credits} credits added to your account.${result.discountLabel ? `\n${result.discountLabel} applied.` : ''}`)
                    refresh()
                  } else if (result.error) {
                    Alert.alert('Payment Failed', result.error)
                  }
                }}
                activeOpacity={0.7}
              >
                {tier.popular && <View style={styles.popularBadge}><Text style={styles.popularText}>Popular</Text></View>}
                <Text style={styles.tierCredits}>{tier.credits}</Text>
                <Text style={styles.tierCreditsLabel}>credit{tier.credits > 1 ? 's' : ''}</Text>
                <Text style={styles.tierPrice}>${tier.price.toFixed(2)}</Text>
                <Text style={styles.tierPerCredit}>{tier.perCredit}/grade</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Tips */}
      <View style={styles.tipsSection}>
        <Text style={styles.tipsTitle}>Photo Tips</Text>
        <View style={styles.tipRow}>
          <Ionicons name="sunny" size={16} color={Colors.amber[500]} />
          <Text style={styles.tipText}>Use good, even lighting — natural light works best</Text>
        </View>
        <View style={styles.tipRow}>
          <Ionicons name="phone-portrait" size={16} color={Colors.blue[500]} />
          <Text style={styles.tipText}>Hold your phone directly overhead for best centering</Text>
        </View>
        <View style={styles.tipRow}>
          <Ionicons name="scan" size={16} color={Colors.green[500]} />
          <Text style={styles.tipText}>Fill the frame with the card — minimize background</Text>
        </View>
        <View style={styles.tipRow}>
          <Ionicons name="flash-off" size={16} color={Colors.red[500]} />
          <Text style={styles.tipText}>Avoid flash — it causes glare on glossy cards</Text>
        </View>
      </View>

      {/* Pro Tip popup — gates Camera/Gallery so users see best-practice
          photography tips before either upload path begins. */}
      <PhotoTipsModal
        visible={tipsVisible}
        onCancel={() => { setTipsVisible(false); setPendingMode(null) }}
        onProceed={() => {
          setTipsVisible(false)
          setShouldGateOnTips(false) // don't re-gate this session
          const mode = pendingMode
          setPendingMode(null)
          if (mode) navigateToCapture(mode)
        }}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { paddingBottom: 40 },

  // Header
  header: { backgroundColor: Colors.white, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.gray[200] },
  logo: { width: 48, height: 48, marginBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.gray[900] },
  headerSubtitle: { fontSize: 14, color: Colors.gray[500], marginTop: 4, textAlign: 'center' },
  creditBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: Colors.purple[50], paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  creditBadgeText: { fontSize: 13, fontWeight: '600', color: Colors.purple[700] },

  // Sections
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: Colors.gray[900], marginBottom: 8 },
  sectionHint: { fontSize: 13, color: Colors.gray[500], marginBottom: 12 },

  // Category pills
  categoryDropdown: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray[200] },
  categoryPillActive: { backgroundColor: Colors.purple[600], borderColor: Colors.purple[600] },
  categoryPillText: { fontSize: 14, fontWeight: '500', color: Colors.gray[700] },
  categoryPillTextActive: { color: Colors.white, fontWeight: '600' },

  // Sub-category
  subCategoryContainer: { marginTop: 12 },
  subCategoryLabel: { fontSize: 13, fontWeight: '600', color: Colors.gray[600], marginBottom: 6 },
  subDropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.gray[300], backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  subDropdownPlaceholder: { borderColor: Colors.amber[400] },
  subDropdownText: { fontSize: 14, color: Colors.gray[900], fontWeight: '600' },
  subDropdownTextPlaceholder: { color: Colors.gray[400], fontWeight: '500' },
  dropdownBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  dropdownSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, maxHeight: '85%' as any },
  dropdownHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.gray[300], alignSelf: 'center', marginBottom: 8 },
  dropdownTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray[900], paddingHorizontal: 4, paddingBottom: 8 },
  dropdownGroupLabel: { fontSize: 11, fontWeight: '700', color: Colors.purple[700], textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: Colors.purple[50], borderRadius: 6, marginBottom: 4 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 12, borderRadius: 8 },
  dropdownItemSelected: { backgroundColor: Colors.purple[50] },
  dropdownItemText: { fontSize: 14, color: Colors.gray[800] },
  dropdownItemTextSelected: { color: Colors.purple[700], fontWeight: '700' },

  // Upload actions
  uploadActions: { flexDirection: 'row', gap: 12 },
  uploadButton: { flex: 1, backgroundColor: Colors.white, borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 2, borderColor: Colors.gray[200] },
  uploadButtonDisabled: { opacity: 0.5 },
  cameraButton: { borderColor: Colors.purple[200] },
  galleryButton: { borderColor: Colors.blue[200] },
  uploadIconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.gray[50], alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  uploadButtonTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  uploadButtonTitleDisabled: { color: Colors.gray[400] },
  uploadButtonSubtitle: { fontSize: 12, color: Colors.gray[500], marginTop: 2 },

  // No credits
  creditsSection: { marginHorizontal: 16, marginTop: 12 },
  noCredits: { backgroundColor: Colors.amber[50], borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.amber[200] },
  noCreditsTitle: { fontSize: 16, fontWeight: '700', color: Colors.amber[700], marginTop: 8 },
  noCreditsText: { fontSize: 13, color: Colors.amber[600], marginTop: 4 },
  tierGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tierCard: { width: '47%' as any, backgroundColor: Colors.white, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: Colors.gray[200] },
  tierCardPopular: { borderColor: Colors.purple[500], backgroundColor: Colors.purple[50] },
  popularBadge: { position: 'absolute', top: -10, backgroundColor: Colors.purple[600], paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  popularText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  tierCredits: { fontSize: 24, fontWeight: '800', color: Colors.purple[600], marginTop: 4 },
  tierCreditsLabel: { fontSize: 11, color: Colors.gray[500] },
  tierPrice: { fontSize: 16, fontWeight: '700', color: Colors.gray[900], marginTop: 6 },
  tierPerCredit: { fontSize: 11, color: Colors.gray[500], marginTop: 2 },

  // Tips
  tipsSection: { marginHorizontal: 16, marginTop: 24, backgroundColor: Colors.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.gray[200] },
  tipsTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray[900], marginBottom: 12 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  tipText: { fontSize: 13, color: Colors.gray[600], flex: 1 },
})
