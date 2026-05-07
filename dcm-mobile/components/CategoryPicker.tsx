/**
 * CategoryPicker — required dropdown for selecting a card type.
 *
 * Used on the Grade tab (no default — user must pick before they can
 * proceed) and on the Review screen step 1 (pre-filled with what the
 * user picked on the previous screen, but still editable).
 *
 * For the "Other" category, a second sub-category dropdown appears
 * below — that's also required to proceed.
 */

import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, Pressable, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, CardCategories } from '@/lib/constants'

const OTHER_SUB_CATEGORIES_GROUPED: Record<string, string[]> = {
  'TCG': ['Digimon', 'Dragon Ball', 'Flesh and Blood', 'Cardfight!! Vanguard', 'Weiss Schwarz', 'MetaZoo', 'Force of Will', 'Final Fantasy TCG', 'Universus', 'Battle Spirits', 'Shadowverse Evolve', 'Union Arena'],
  'Entertainment': ['Star Wars', 'Marvel', 'DC Comics', 'Disney', 'Garbage Pail Kids', 'Wacky Packages', 'WWE / Wrestling', 'Movie / TV', 'Music', 'Anime'],
  'Vintage': ['Non-Sport Vintage', 'Art Cards', 'Promotional', 'Racing', 'Historical'],
  'Other': ['Other'],
}

interface CategoryPickerProps {
  category: string
  subCategory: string
  onCategoryChange: (next: string) => void
  onSubCategoryChange: (next: string) => void
  /** Hide the field's own header label — useful when the parent screen
   *  already shows a section title above it. */
  hideLabel?: boolean
}

export default function CategoryPicker({
  category,
  subCategory,
  onCategoryChange,
  onSubCategoryChange,
  hideLabel,
}: CategoryPickerProps) {
  const [mainOpen, setMainOpen] = useState(false)
  const [subOpen, setSubOpen] = useState(false)

  const selectedLabel = CardCategories.find(c => c.key === category)?.label

  return (
    <View>
      {!hideLabel && (
        <Text style={s.fieldLabel}>
          Card Type <Text style={s.required}>*</Text>
        </Text>
      )}
      <TouchableOpacity
        style={[s.dropdown, !category && s.dropdownPlaceholder]}
        onPress={() => setMainOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={[s.dropdownText, !category && s.dropdownTextPlaceholder]}>
          {selectedLabel || 'Select Card Type…'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={Colors.gray[500]} />
      </TouchableOpacity>

      {/* Sub-category dropdown — only when the user picked "Other" */}
      {category === 'Other' && (
        <View style={s.subBlock}>
          <Text style={s.fieldLabel}>
            Sub-Category <Text style={s.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[s.dropdown, !subCategory && s.dropdownPlaceholder]}
            onPress={() => setSubOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={[s.dropdownText, !subCategory && s.dropdownTextPlaceholder]}>
              {subCategory || 'Select sub-category…'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={Colors.gray[500]} />
          </TouchableOpacity>
        </View>
      )}

      {/* Main category modal */}
      <Modal visible={mainOpen} transparent animationType="slide" onRequestClose={() => setMainOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setMainOpen(false)}>
          <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Select Card Type</Text>
            <ScrollView style={{ maxHeight: 480 }}>
              {CardCategories.map(cat => {
                const sel = category === cat.key
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[s.item, sel && s.itemSelected]}
                    onPress={() => {
                      onCategoryChange(cat.key)
                      // Reset sub-category if switching away from Other
                      if (cat.key !== 'Other' && subCategory) onSubCategoryChange('')
                      setMainOpen(false)
                    }}
                  >
                    <Text style={[s.itemText, sel && s.itemTextSelected]}>{cat.label}</Text>
                    {sel && <Ionicons name="checkmark" size={18} color={Colors.purple[600]} />}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Sub-category modal — grouped by section */}
      <Modal visible={subOpen} transparent animationType="slide" onRequestClose={() => setSubOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setSubOpen(false)}>
          <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Select Sub-Category</Text>
            <ScrollView style={{ maxHeight: 480 }}>
              {Object.entries(OTHER_SUB_CATEGORIES_GROUPED).map(([group, items]) => (
                <View key={group} style={{ marginBottom: 12 }}>
                  <Text style={s.groupLabel}>{group}</Text>
                  {items.map(sub => {
                    const sel = subCategory === sub
                    return (
                      <TouchableOpacity
                        key={sub}
                        style={[s.item, sel && s.itemSelected]}
                        onPress={() => { onSubCategoryChange(sub); setSubOpen(false) }}
                      >
                        <Text style={[s.itemText, sel && s.itemTextSelected]}>{sub}</Text>
                        {sel && <Ionicons name="checkmark" size={18} color={Colors.purple[600]} />}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Colors.gray[700], marginBottom: 6 },
  required: { color: Colors.red[500] },
  subBlock: { marginTop: 12 },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.gray[300],
    backgroundColor: Colors.white,
  },
  dropdownPlaceholder: {
    borderColor: Colors.purple[300],
    backgroundColor: Colors.purple[50],
  },
  dropdownText: { fontSize: 15, fontWeight: '600', color: Colors.gray[900] },
  dropdownTextPlaceholder: { fontWeight: '500', color: Colors.purple[700] },

  // Modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.gray[200], alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: Colors.gray[900], marginBottom: 8 },
  groupLabel: { fontSize: 11, fontWeight: '700', color: Colors.gray[400], textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6, marginBottom: 4, paddingHorizontal: 4 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, borderRadius: 10 },
  itemSelected: { backgroundColor: Colors.purple[50] },
  itemText: { fontSize: 15, color: Colors.gray[800] },
  itemTextSelected: { fontWeight: '700', color: Colors.purple[700] },
})
