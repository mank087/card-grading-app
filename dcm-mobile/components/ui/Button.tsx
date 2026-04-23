import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native'
import { Colors } from '@/lib/constants'

interface ButtonProps {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  style?: ViewStyle
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const buttonStyle = [
    styles.base,
    styles[`${variant}Bg` as keyof typeof styles],
    styles[`${size}Size` as keyof typeof styles],
    (disabled || loading) && styles.disabled,
    style,
  ]

  const textStyle = [
    styles.text,
    styles[`${variant}Text` as keyof typeof styles],
    styles[`${size}Text` as keyof typeof styles],
  ]

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : Colors.purple[600]} size="small" />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  disabled: {
    opacity: 0.5,
  },

  // Variants — backgrounds
  primaryBg: { backgroundColor: Colors.purple[600] },
  secondaryBg: { backgroundColor: Colors.gray[200] },
  dangerBg: { backgroundColor: Colors.red[500] },
  ghostBg: { backgroundColor: 'transparent' },

  // Variants — text
  primaryText: { color: Colors.white, fontWeight: '600' as TextStyle['fontWeight'] },
  secondaryText: { color: Colors.gray[800], fontWeight: '600' as TextStyle['fontWeight'] },
  dangerText: { color: Colors.white, fontWeight: '600' as TextStyle['fontWeight'] },
  ghostText: { color: Colors.purple[600], fontWeight: '600' as TextStyle['fontWeight'] },

  // Sizes
  smSize: { paddingVertical: 8, paddingHorizontal: 16 },
  mdSize: { paddingVertical: 12, paddingHorizontal: 24 },
  lgSize: { paddingVertical: 16, paddingHorizontal: 32 },

  smText: { fontSize: 13 },
  mdText: { fontSize: 15 },
  lgText: { fontSize: 17 },

  text: {
    fontSize: 15,
  },
})
