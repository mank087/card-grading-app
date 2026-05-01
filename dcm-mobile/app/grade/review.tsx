import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, TextInput, Alert, Switch } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Crypto from 'expo-crypto'
import { Colors, CardCategories } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'
import { useCredits } from '@/contexts/CreditsContext'
import { useGradingQueue } from '@/contexts/GradingQueueContext'
import { supabase } from '@/lib/supabase'
import { uriToArrayBuffer } from '@/lib/imageUtils'
import { ConditionReportData, EMPTY_REPORT, SURFACE_LABELS, CORNER_LABELS, EDGE_LABELS, STRUCTURAL_LABELS, FACTORY_LABELS, countDefects } from '@/lib/conditionReport'
import Button from '@/components/ui/Button'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'

const OTHER_SUB_CATEGORIES = {
  'TCG': ['Digimon', 'Dragon Ball', 'Flesh and Blood', 'Cardfight!! Vanguard', 'Weiss Schwarz', 'MetaZoo', 'Union Arena'],
  'Entertainment': ['Star Wars', 'Marvel', 'DC Comics', 'Disney', 'Garbage Pail Kids', 'WWE / Wrestling', 'Movie / TV', 'Anime'],
  'Vintage': ['Non-Sport Vintage', 'Art Cards', 'Promotional', 'Racing', 'Historical'],
  'Other': ['Other'],
}

const API_ENDPOINTS: Record<string, string> = {
  Sports: '/api/sports', Pokemon: '/api/pokemon', MTG: '/api/mtg',
  Lorcana: '/api/lorcana', 'One Piece': '/api/onepiece', 'Yu-Gi-Oh': '/api/yugioh', Other: '/api/other',
}

function generateUUID(): string {
  const bytes = Crypto.getRandomBytes(16)
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  // Set version 4 and variant bits
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-${(parseInt(hex[16], 16) & 0x3 | 0x8).toString(16)}${hex.slice(17,20)}-${hex.slice(20,32)}`
}

export default function ReviewScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ category: string; subCategory: string; frontUri: string; backUri: string }>()
  const { user, session } = useAuth()
  const { balance, refresh: refreshCredits } = useCredits()
  const { addToQueue } = useGradingQueue()

  const [step, setStep] = useState(1)
  const [category, setCategory] = useState(params.category || 'Sports')
  const [subCategory, setSubCategory] = useState(params.subCategory || '')
  const [noDefects, setNoDefects] = useState(false)
  const [conditionReport, setConditionReport] = useState<ConditionReportData>(EMPTY_REPORT)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const defectCount = countDefects(conditionReport)
  const isConditionValid = noDefects || defectCount > 0
  const canSubmit = params.frontUri && params.backUri && isConditionValid && balance >= 1

  const handleSubmit = async () => {
    if (!user || !session || !params.frontUri || !params.backUri) return
    if (balance < 1) {
      Alert.alert('Insufficient Credits', 'You need at least 1 credit to grade a card.')
      return
    }

    setIsSubmitting(true)
    try {
      const cardId = generateUUID()
      const frontPath = `${user.id}/${cardId}/front.jpg`
      const backPath = `${user.id}/${cardId}/back.jpg`

      console.log('[Upload] Starting upload for card:', cardId)
      console.log('[Upload] Front URI:', params.frontUri.substring(0, 60))
      console.log('[Upload] Back URI:', params.backUri.substring(0, 60))

      // Convert images to ArrayBuffer for Supabase upload
      const frontBuffer = await uriToArrayBuffer(params.frontUri)
      const backBuffer = await uriToArrayBuffer(params.backUri)

      console.log('[Upload] Front buffer size:', frontBuffer.byteLength)
      console.log('[Upload] Back buffer size:', backBuffer.byteLength)

      // Upload to Supabase Storage
      const [frontUpload, backUpload] = await Promise.all([
        supabase.storage.from('cards').upload(frontPath, frontBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        }),
        supabase.storage.from('cards').upload(backPath, backBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        }),
      ])

      if (frontUpload.error) {
        console.error('[Upload] Front upload error:', frontUpload.error)
        throw new Error(`Front upload failed: ${frontUpload.error.message}`)
      }
      if (backUpload.error) {
        console.error('[Upload] Back upload error:', backUpload.error)
        throw new Error(`Back upload failed: ${backUpload.error.message}`)
      }

      console.log('[Upload] Images uploaded successfully')

      // Get serial number
      let serial = String(Date.now()).slice(-6) + String(Math.floor(Math.random() * 10000)).padStart(4, '0')
      try {
        const res = await fetch(`${API_BASE}/api/serial`)
        if (res.ok) {
          const data = await res.json()
          serial = data.serial || serial
        }
      } catch { /* use fallback serial */ }

      console.log('[Upload] Serial:', serial)

      // Build condition report payload
      const conditionPayload = noDefects
        ? (notes ? { noDefectsConfirmed: true, cardDescription: notes } : null)
        : { ...conditionReport, notes }

      // Insert card record
      const { error: dbError } = await supabase.from('cards').insert({
        id: cardId,
        user_id: user.id,
        serial,
        front_path: frontPath,
        back_path: backPath,
        category,
        ...(category === 'Other' && subCategory ? { sub_category: subCategory } : {}),
        visibility: 'public',
        ...(conditionPayload ? {
          user_condition_report: conditionPayload,
          user_condition_processed: conditionPayload,
          has_user_condition_report: true,
        } : {}),
      })

      if (dbError) {
        console.error('[Upload] DB insert error:', dbError)
        throw new Error(`Database error: ${dbError.message}`)
      }

      console.log('[Upload] Card record created')

      // Deduct credit via API (same as web — handles tracking)
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'
        await fetch(`${API_BASE}/api/stripe/deduct`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentSession?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cardId }),
        })
        console.log('[Upload] Credit deducted via API')
      } catch (creditErr) {
        console.warn('[Upload] API credit deduction failed, falling back to direct:', creditErr)
        // Fallback: direct Supabase update
        const { data: currentCredits } = await supabase
          .from('user_credits')
          .select('balance, total_used')
          .eq('user_id', user.id)
          .single()
        if (currentCredits) {
          await supabase.from('user_credits').update({
            balance: Math.max(0, currentCredits.balance - 1),
            total_used: (currentCredits.total_used || 0) + 1,
          }).eq('user_id', user.id)
        }
      }
      refreshCredits()

      // Add to the global grading queue and bounce the user back to the
      // collection. The persistent status bar at the top of the app handles
      // progress; the user can keep grading more cards or browse the app
      // while this one finishes.
      addToQueue({
        cardId,
        category,
        frontImageUrl: params.frontUri,
        status: 'processing',
        cardName: undefined,
      })
      router.replace('/(tabs)/collection' as any)
    } catch (err: any) {
      console.error('[Upload] Submit error:', err)
      Alert.alert('Submission Failed', err.message || 'Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleDefect = (side: 'front' | 'back', area: 'surface' | 'corners' | 'edges', key: string) => {
    setConditionReport(prev => ({
      ...prev,
      [side]: {
        ...prev[side],
        [area]: { ...prev[side][area], [key]: !(prev[side][area] as any)[key] },
      },
    }))
  }

  const toggleStructural = (key: string) => {
    setConditionReport(prev => ({
      ...prev,
      structural: { ...prev.structural, [key]: !(prev.structural as any)[key] },
    }))
  }

  const toggleFactory = (key: string) => {
    setConditionReport(prev => ({
      ...prev,
      factory: { ...prev.factory, [key]: !(prev.factory as any)[key] },
    }))
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Progress Steps */}
      <View style={styles.progressBar}>
        {[1, 2, 3].map(s => (
          <TouchableOpacity key={s} style={styles.progressStep} onPress={() => s <= step && setStep(s)}>
            <View style={[styles.stepDot, step >= s && styles.stepDotActive]}>
              <Text style={[styles.stepNum, step >= s && styles.stepNumActive]}>{s}</Text>
            </View>
            <Text style={[styles.stepLabel, step >= s && styles.stepLabelActive]}>
              {s === 1 ? 'Category' : s === 2 ? 'Photos' : 'Condition'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* STEP 1: Category */}
      {step === 1 && (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Confirm Card Category</Text>
          <View style={styles.categoryList}>
            {CardCategories.map(cat => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.categoryOption, category === cat.key && styles.categoryOptionActive]}
                onPress={() => setCategory(cat.key)}
              >
                <Text style={[styles.categoryOptionText, category === cat.key && styles.categoryOptionTextActive]}>
                  {cat.label}
                </Text>
                {category === cat.key && <Ionicons name="checkmark-circle" size={20} color={Colors.purple[600]} />}
              </TouchableOpacity>
            ))}
          </View>

          {category === 'Other' && (
            <View style={styles.subCategorySection}>
              <Text style={styles.subCategoryLabel}>Sub-Category *</Text>
              {Object.entries(OTHER_SUB_CATEGORIES).map(([group, items]) => (
                <View key={group}>
                  <Text style={styles.subCategoryGroup}>{group}</Text>
                  {items.map(item => (
                    <TouchableOpacity
                      key={item}
                      style={[styles.subCategoryOption, subCategory === item && styles.subCategoryOptionActive]}
                      onPress={() => setSubCategory(item)}
                    >
                      <Text style={styles.subCategoryOptionText}>{item}</Text>
                      {subCategory === item && <Ionicons name="checkmark" size={16} color={Colors.purple[600]} />}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          )}

          <Button
            title="Continue to Photos"
            onPress={() => setStep(2)}
            disabled={category === 'Other' && !subCategory}
            style={{ marginTop: 16 }}
          />
        </View>
      )}

      {/* STEP 2: Photos */}
      {step === 2 && (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Review Your Photos</Text>
          <View style={styles.photoGrid}>
            <View style={styles.photoCard}>
              <Text style={styles.photoLabel}>Front</Text>
              {params.frontUri ? (
                <Image source={{ uri: params.frontUri }} style={styles.photoImage} resizeMode="contain" />
              ) : (
                <View style={[styles.photoImage, styles.photoPlaceholder]}><Text style={styles.placeholderText}>No front</Text></View>
              )}
              <TouchableOpacity style={styles.retakeLink} onPress={() => router.back()}>
                <Ionicons name="refresh" size={14} color={Colors.purple[600]} />
                <Text style={styles.retakeLinkText}>Retake</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.photoCard}>
              <Text style={styles.photoLabel}>Back</Text>
              {params.backUri ? (
                <Image source={{ uri: params.backUri }} style={styles.photoImage} resizeMode="contain" />
              ) : (
                <View style={[styles.photoImage, styles.photoPlaceholder]}><Text style={styles.placeholderText}>No back</Text></View>
              )}
              <TouchableOpacity style={styles.retakeLink} onPress={() => router.back()}>
                <Ionicons name="refresh" size={14} color={Colors.purple[600]} />
                <Text style={styles.retakeLinkText}>Retake</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Button title="Continue to Condition Report" onPress={() => setStep(3)} style={{ marginTop: 16 }} />
        </View>
      )}

      {/* STEP 3: Condition Report */}
      {step === 3 && (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Report Card Condition</Text>
          <Text style={styles.stepSubtitle}>Optional — helps the AI grade more accurately</Text>

          <View style={styles.noDefectsRow}>
            <Switch value={noDefects} onValueChange={(v) => { setNoDefects(v); if (v) setConditionReport(EMPTY_REPORT) }}
              trackColor={{ false: Colors.gray[300], true: Colors.green[500] }} />
            <Text style={styles.noDefectsLabel}>No visible defects to report</Text>
          </View>

          {/* Optional description — always shown (even with no defects) */}
          {noDefects && (
            <View style={styles.defectSide}>
              <Text style={styles.defectGroupTitle}>Card Details for AI Guidance (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="E.g., 'This card has a textured holofoil surface', 'Vintage card from 1997'..."
                placeholderTextColor={Colors.gray[400]}
                value={notes}
                onChangeText={setNotes}
                multiline
                maxLength={500}
              />
              <Text style={styles.charCount}>{notes.length}/500</Text>
            </View>
          )}

          {!noDefects && (
            <>
              {(['front', 'back'] as const).map(side => (
                <View key={side} style={styles.defectSide}>
                  <Text style={styles.defectSideTitle}>{side === 'front' ? 'Front' : 'Back'}</Text>

                  <Text style={styles.defectGroupTitle}>Surface</Text>
                  {Object.entries(SURFACE_LABELS).map(([key, label]) => (
                    <DefectCheckbox key={`${side}-s-${key}`} label={label}
                      checked={(conditionReport[side].surface as any)[key]}
                      onToggle={() => toggleDefect(side, 'surface', key)} />
                  ))}

                  <Text style={styles.defectGroupTitle}>Corners</Text>
                  {Object.entries(CORNER_LABELS).map(([key, label]) => (
                    <DefectCheckbox key={`${side}-c-${key}`} label={label}
                      checked={(conditionReport[side].corners as any)[key]}
                      onToggle={() => toggleDefect(side, 'corners', key)} />
                  ))}

                  <Text style={styles.defectGroupTitle}>Edges</Text>
                  {Object.entries(EDGE_LABELS).map(([key, label]) => (
                    <DefectCheckbox key={`${side}-e-${key}`} label={label}
                      checked={(conditionReport[side].edges as any)[key]}
                      onToggle={() => toggleDefect(side, 'edges', key)} />
                  ))}
                </View>
              ))}

              <Text style={styles.defectGroupTitle}>Structural Issues</Text>
              {Object.entries(STRUCTURAL_LABELS).map(([key, label]) => (
                <DefectCheckbox key={`str-${key}`} label={label}
                  checked={(conditionReport.structural as any)[key]}
                  onToggle={() => toggleStructural(key)} />
              ))}

              <Text style={styles.defectGroupTitle}>Factory / Manufacturing</Text>
              {Object.entries(FACTORY_LABELS).map(([key, label]) => (
                <DefectCheckbox key={`fac-${key}`} label={label}
                  checked={(conditionReport.factory as any)[key]}
                  onToggle={() => toggleFactory(key)} />
              ))}

              <Text style={styles.defectGroupTitle}>Additional Notes</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="E.g., 'Light scratch near center of front'..."
                placeholderTextColor={Colors.gray[400]}
                value={notes}
                onChangeText={setNotes}
                multiline
                maxLength={500}
              />
              <Text style={styles.charCount}>{notes.length}/500</Text>
            </>
          )}

          {!isConditionValid && (
            <View style={styles.validationWarning}>
              <Ionicons name="warning" size={16} color={Colors.amber[600]} />
              <Text style={styles.validationText}>Check 'No visible defects' or report at least one defect</Text>
            </View>
          )}

          {isConditionValid && (
            <View style={styles.validationSuccess}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.green[600]} />
              <Text style={styles.validationSuccessText}>
                {noDefects ? 'No defects reported — ready to submit' : `${defectCount} defect(s) reported — ready to submit`}
              </Text>
            </View>
          )}

          <View style={styles.creditInfo}>
            <Text style={styles.creditInfoText}>This will use 1 credit. Balance: {balance}</Text>
          </View>

          <Button
            title={isSubmitting ? 'Submitting...' : 'Submit for Grading'}
            onPress={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            loading={isSubmitting}
            style={{ marginTop: 12 }}
          />
        </View>
      )}
    </ScrollView>
  )
}

function DefectCheckbox({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={styles.defectCheckbox} onPress={onToggle} activeOpacity={0.7}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? Colors.purple[600] : Colors.gray[400]} />
      <Text style={[styles.defectLabel, checked && styles.defectLabelChecked]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { padding: 16, paddingBottom: 40 },
  progressBar: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 20 },
  progressStep: { alignItems: 'center', gap: 4 },
  stepDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.gray[200], alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: Colors.purple[600] },
  stepNum: { fontSize: 14, fontWeight: '700', color: Colors.gray[500] },
  stepNumActive: { color: Colors.white },
  stepLabel: { fontSize: 11, color: Colors.gray[400] },
  stepLabelActive: { color: Colors.purple[600], fontWeight: '600' },
  stepContent: {},
  stepTitle: { fontSize: 20, fontWeight: '700', color: Colors.gray[900], marginBottom: 4 },
  stepSubtitle: { fontSize: 13, color: Colors.gray[500], marginBottom: 16 },
  categoryList: { gap: 6 },
  categoryOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.gray[200], backgroundColor: Colors.white },
  categoryOptionActive: { borderColor: Colors.purple[500], backgroundColor: Colors.purple[50] },
  categoryOptionText: { fontSize: 15, fontWeight: '500', color: Colors.gray[700] },
  categoryOptionTextActive: { color: Colors.purple[700], fontWeight: '600' },
  subCategorySection: { marginTop: 16, backgroundColor: Colors.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.gray[200] },
  subCategoryLabel: { fontSize: 14, fontWeight: '600', color: Colors.gray[700], marginBottom: 8 },
  subCategoryGroup: { fontSize: 11, fontWeight: '700', color: Colors.gray[400], textTransform: 'uppercase', marginTop: 12, marginBottom: 4 },
  subCategoryOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  subCategoryOptionActive: { backgroundColor: Colors.purple[50] },
  subCategoryOptionText: { fontSize: 14, color: Colors.gray[700] },
  photoGrid: { flexDirection: 'row', gap: 12 },
  photoCard: { flex: 1, backgroundColor: Colors.white, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: Colors.gray[200], alignItems: 'center' },
  photoLabel: { fontSize: 12, fontWeight: '600', color: Colors.gray[500], marginBottom: 6 },
  photoImage: { width: '100%', aspectRatio: 0.714, borderRadius: 6 },
  photoPlaceholder: { backgroundColor: Colors.gray[200], alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: Colors.gray[400], fontSize: 12 },
  retakeLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  retakeLinkText: { fontSize: 13, color: Colors.purple[600], fontWeight: '600' },
  noDefectsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.gray[200], marginBottom: 16 },
  noDefectsLabel: { fontSize: 15, fontWeight: '500', color: Colors.gray[800], flex: 1 },
  defectSide: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.gray[200], marginBottom: 12 },
  defectSideTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray[900], marginBottom: 8 },
  defectGroupTitle: { fontSize: 13, fontWeight: '700', color: Colors.gray[600], marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  defectCheckbox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  defectLabel: { fontSize: 14, color: Colors.gray[600] },
  defectLabelChecked: { color: Colors.purple[700], fontWeight: '500' },
  notesInput: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray[300], borderRadius: 10, padding: 12, fontSize: 14, color: Colors.gray[900], minHeight: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: Colors.gray[400], textAlign: 'right', marginTop: 4 },
  validationWarning: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.amber[50], padding: 12, borderRadius: 10, marginTop: 12 },
  validationText: { fontSize: 13, color: Colors.amber[600], flex: 1 },
  validationSuccess: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.green[50], padding: 12, borderRadius: 10, marginTop: 12 },
  validationSuccessText: { fontSize: 13, color: Colors.green[600], flex: 1 },
  creditInfo: { backgroundColor: Colors.purple[50], padding: 12, borderRadius: 10, marginTop: 12, alignItems: 'center' },
  creditInfoText: { fontSize: 13, color: Colors.purple[700], fontWeight: '500' },
})
