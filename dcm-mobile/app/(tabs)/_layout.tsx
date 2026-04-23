import React from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '@/lib/constants'
import { useCredits } from '@/contexts/CreditsContext'

export default function TabLayout() {
  const { balance } = useCredits()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.purple[600],
        tabBarInactiveTintColor: Colors.gray[400],
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.gray[200],
          paddingBottom: 4,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: Colors.white,
        },
        headerTintColor: Colors.gray[900],
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="grade"
        options={{
          title: 'Grade',
          headerTitle: 'Grade a Card',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          headerTitle: 'My Collection',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          headerTitle: 'Recommended Products',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bag" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          headerTitle: 'My Account',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="person" size={size} color={color} />
              {balance > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{balance}</Text>
                </View>
              )}
            </View>
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
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: Colors.purple[600],
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
})
