import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

interface CollapsibleSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  icon?: keyof typeof Ionicons.glyphMap
  /** Optional controlled mode — when `open` is provided, the parent owns
   *  the state. Required for the onboarding tour, which programmatically
   *  expands sections to highlight their content. */
  open?: boolean
  onOpenChange?: (next: boolean) => void
}

export default function CollapsibleSection({ title, children, defaultOpen = false, icon, open, onOpenChange }: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = typeof open === 'boolean'
  const isOpen = isControlled ? open : internalOpen

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    const next = !isOpen
    if (isControlled) {
      onOpenChange?.(next)
    } else {
      setInternalOpen(next)
      onOpenChange?.(next)
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={toggle} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          {icon && <Ionicons name={icon} size={18} color={Colors.purple[600]} style={{ marginRight: 8 }} />}
          <Text style={styles.title}>{title}</Text>
        </View>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={Colors.gray[400]}
        />
      </TouchableOpacity>
      {isOpen && <View style={styles.content}>{children}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
})
