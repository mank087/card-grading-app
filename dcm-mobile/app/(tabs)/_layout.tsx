import React from 'react'
import { Tabs, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/lib/constants'
import { useCredits } from '@/contexts/CreditsContext'

/**
 * Custom header matching web nav — DCM logo left, quick links + credit badge right
 */
function AppHeader() {
  const router = useRouter()
  const { balance } = useCredits()
  const insets = useSafeAreaInsets()

  // Credit badge color: green if 3+, amber if 1-2, red if 0
  const creditColor = balance >= 3 ? Colors.green[600] : balance >= 1 ? Colors.amber[600] : Colors.red[600]
  const creditBg = balance >= 3 ? Colors.green[50] : balance >= 1 ? Colors.amber[50] : Colors.red[50]

  return (
    <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
      {/* Left: DCM Logo */}
      <TouchableOpacity style={styles.logoContainer} onPress={() => router.push('/(tabs)/grade')} activeOpacity={0.8}>
        <Image source={require('@/assets/images/dcm-logo.png')} style={styles.logo} resizeMode="contain" />
      </TouchableOpacity>

      {/* Right: Quick links + Credits */}
      <View style={styles.headerRight}>
        <TouchableOpacity style={styles.headerLink} onPress={() => router.push('/pages/label-studio' as any)} activeOpacity={0.7}>
          <Ionicons name="pricetags-outline" size={18} color={Colors.gray[600]} />
          <Text style={styles.headerLinkText}>Labels</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.creditBadge, { backgroundColor: creditBg }]}
          onPress={() => router.push('/pages/credits' as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="diamond" size={13} color={creditColor} />
          <Text style={[styles.creditBadgeText, { color: creditColor }]}>{balance}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function TabLayout() {
  const { balance } = useCredits()
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.purple[600],
        tabBarInactiveTintColor: Colors.gray[400],
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.gray[200],
          paddingBottom: Math.max(insets.bottom, 8),
          height: 56 + Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        header: () => <AppHeader />,
      }}
    >
      <Tabs.Screen
        name="grade"
        options={{
          title: 'Grade',
          headerShown: false, // Grade tab has its own header with logo
          tabBarIcon: ({ color, size }) => (
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{
                width: size * 0.65, height: size * 0.9,
                borderRadius: 3, borderWidth: 2, borderColor: color,
                alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2,
              }}>
                <View style={{
                  width: size * 0.45, height: size * 0.55,
                  borderRadius: 2, borderWidth: 1.5, borderColor: color, opacity: 0.6,
                }} />
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bag" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="menu" size={size} color={color} />
          ),
        }}
      />

      {/* Hide template screens */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 36,
    height: 36,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.gray[50],
  },
  headerLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray[600],
  },
  creditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  creditBadgeText: {
    fontSize: 14,
    fontWeight: '800',
  },
})
