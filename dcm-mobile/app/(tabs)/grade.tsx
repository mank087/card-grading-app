import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { Colors, CardCategories } from '@/lib/constants'
import { useCredits } from '@/contexts/CreditsContext'
import { purchaseCredits, CREDIT_TIERS } from '@/lib/stripe'
import { compressImage, cropToCardAspect } from '@/lib/imageUtils'
import Button from '@/components/ui/Button'

const OTHER_SUB_CATEGORIES = [
  'Digimon', 'Dragon Ball', 'Flesh and Blood', 'Weiss Schwarz', 'Union Arena',
  'Star Wars', 'Marvel', 'DC Comics', 'Disney', 'Garbage Pail Kids',
  'WWE / Wrestling', 'Movie / TV', 'Anime', 'Non-Sport Vintage', 'Other',
]

export default function GradeScreen() {
  const router = useRouter()
  const { balance, refresh } = useCredits()
  const [selectedCategory, setSelectedCategory] = useState('Sports')
  const [subCategory, setSubCategory] = useState('')
  const [showSubCategories, setShowSubCategories] = useState(false)

  const canGrade = balance >= 1 && (selectedCategory !== 'Other' || subCategory !== '')

  const handleCamera = () => {
    if (!canGrade) {
      if (balance < 1) Alert.alert('Insufficient Credits', 'You need at least 1 credit to grade a card.')
      return
    }
    router.push({
      pathname: '/grade/capture',
      params: { category: selectedCategory, subCategory },
    })
  }

  const [galleryStep, setGalleryStep] = useState<'idle' | 'front' | 'back' | 'processing'>('idle')
  const [galleryFrontUri, setGalleryFrontUri] = useState<string | null>(null)

  const handleGallery = async () => {
    if (!canGrade) {
      if (balance < 1) Alert.alert('Insufficient Credits', 'You need at least 1 credit to grade a card.')
      return
    }

    try {
      setGalleryStep('front')

      // Pick front image
      const frontResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.92,
        allowsEditing: false,
      })
      if (frontResult.canceled || !frontResult.assets?.[0]) {
        setGalleryStep('idle')
        return
      }

      setGalleryFrontUri(frontResult.assets[0].uri)
      setGalleryStep('back')

      // Pick back image
      const backResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.92,
        allowsEditing: false,
      })
      if (backResult.canceled || !backResult.assets?.[0]) {
        setGalleryStep('idle')
        setGalleryFrontUri(null)
        return
      }

      setGalleryStep('processing')

      // Crop and compress both
      const croppedFront = await cropToCardAspect(frontResult.assets[0].uri)
      const croppedBack = await cropToCardAspect(backResult.assets[0].uri)
      const compressedFront = await compressImage(croppedFront)
      const compressedBack = await compressImage(croppedBack)

      setGalleryStep('idle')
      setGalleryFrontUri(null)

      // Go to review
      router.push({
        pathname: '/grade/review',
        params: {
          category: selectedCategory,
          subCategory,
          frontUri: compressedFront.uri,
          backUri: compressedBack.uri,
          frontWidth: String(compressedFront.width),
          frontHeight: String(compressedFront.height),
          backWidth: String(compressedBack.width),
          backHeight: String(compressedBack.height),
        },
      })
    } catch (err) {
      console.error('Gallery error:', err)
      setGalleryStep('idle')
      setGalleryFrontUri(null)
    }
  }

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

        {/* Sub-category for Other */}
        {selectedCategory === 'Other' && (
          <View style={styles.subCategoryContainer}>
            <Text style={styles.subCategoryLabel}>Sub-Category *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subCategoryScroll}>
              <View style={styles.subCategoryRow}>
                {OTHER_SUB_CATEGORIES.map(sub => (
                  <TouchableOpacity
                    key={sub}
                    style={[styles.subPill, subCategory === sub && styles.subPillActive]}
                    onPress={() => setSubCategory(sub)}
                  >
                    <Text style={[styles.subPillText, subCategory === sub && styles.subPillTextActive]}>{sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </View>

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
  subCategoryScroll: { marginHorizontal: -16 },
  subCategoryRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16 },
  subPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.gray[100], borderWidth: 1, borderColor: Colors.gray[200] },
  subPillActive: { backgroundColor: Colors.purple[100], borderColor: Colors.purple[400] },
  subPillText: { fontSize: 12, color: Colors.gray[600] },
  subPillTextActive: { color: Colors.purple[700], fontWeight: '600' },

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
