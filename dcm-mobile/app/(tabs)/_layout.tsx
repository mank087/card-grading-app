import React from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/lib/constants'
import AppHeaderBar from '@/components/AppHeaderBar'
import EbayWordmark from '@/components/marketplace/EbayWordmark'

export default function TabLayout() {
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
        header: () => <AppHeaderBar showGrade />,
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
        name="labels"
        options={{
          title: 'Labels',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pricetags" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="market-pricing"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cash" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="instalist-marketplace"
        options={{
          // Shorter label to keep the 6-tab bar from getting cramped on
          // 360pt-wide Android devices. The eBay wordmark icon is the
          // primary visual cue; this label clarifies what eBay is for.
          title: 'InstaList',
          tabBarIcon: ({ color, size, focused }) => (
            <EbayWordmark color={color} size={size} focused={focused} />
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

      {/* Shop is reachable via the Menu → Tools → Shop link, not the bottom nav */}
      <Tabs.Screen name="shop" options={{ href: null }} />

      {/* Hide template screens */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  )
}
