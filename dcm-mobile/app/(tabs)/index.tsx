/**
 * (tabs)/ landing — redirect to the user's appropriate first screen.
 *
 * expo-router resolves any `/` or `/(tabs)/` URL to this file (it's the
 * group's index). If the user is signed in we route to Collection when
 * they have at least one graded card, otherwise to Grade so they're
 * prompted to start. Mirrors the AuthGate routing for users coming from
 * the /(auth) group.
 *
 * This file is `href: null` in (tabs)/_layout.tsx so it never shows in
 * the tab bar — it's purely a redirect target for the default route.
 */

import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Redirect } from 'expo-router'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/lib/constants'

export default function TabsIndex() {
  const { user, isLoading } = useAuth()
  const [target, setTarget] = useState<'/(tabs)/collection' | '/(tabs)/grade' | null>(null)

  useEffect(() => {
    if (isLoading || !user?.id) return
    let cancelled = false
    supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('conversational_whole_grade', 'is', null)
      .then(({ count, error }) => {
        if (cancelled) return
        const hasGraded = !error && (count ?? 0) > 0
        setTarget(hasGraded ? '/(tabs)/collection' : '/(tabs)/grade')
      })
    return () => { cancelled = true }
  }, [user?.id, isLoading])

  // While auth is loading or the cards query is in flight, show a
  // neutral spinner — never the boilerplate "Tab One" screen.
  if (!target) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gray[50] }}>
        <ActivityIndicator size="large" color={Colors.purple[600]} />
      </View>
    )
  }

  return <Redirect href={target} />
}
