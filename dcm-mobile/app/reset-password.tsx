import { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { recoveryCredentials, consumeRecoveryLink, subscribeRecoveryLinks } from '@/lib/recoveryLink'
import AppHeaderBar from '@/components/AppHeaderBar'
import Button from '@/components/ui/Button'
import { Colors } from '@/lib/constants'

export default function ResetPassword() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const inFlight = useRef(false)
  useEffect(() => {
    let cancelled = false
    let handled = ''
    const accept = async (raw: string | null) => {
      if (!raw || raw === handled) return
      const credentials = recoveryCredentials(raw, process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com')
      if (!credentials) { if (!cancelled) setError('Open the password reset link from your email, or request a new one.'); return }
      handled = raw
      setBusy(true)
      try {
        const result = 'code' in credentials ? await supabase.auth.exchangeCodeForSession(credentials.code) : await supabase.auth.setSession(credentials)
        if (result.error || !result.data.session) throw Error('This reset link is invalid or expired. Request a new one.')
        if (!cancelled) { setReady(true); setError('') }
      } catch { if (!cancelled) setError('This reset link could not be verified. Check your connection or request a new one.') }
      finally { if (!cancelled) setBusy(false) }
    }
    const queued = consumeRecoveryLink()
    if (queued) void accept(queued)
    else void Linking.getInitialURL().then(accept).catch(() => setError('Please open the reset link from your email.'))
    const unsubscribe = subscribeRecoveryLinks(raw => { consumeRecoveryLink(); void accept(raw) })
    const sub = Linking.addEventListener('url', ({ url }) => { void accept(url) })
    return () => { cancelled = true; sub.remove(); unsubscribe() }
  }, [])
  const save = async () => {
    if (!ready || inFlight.current) return
    if (password.length < 8 || password !== confirm) { setError('Use at least 8 characters and enter the same password twice.'); return }
    inFlight.current = true; setBusy(true); setError('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setPassword(''); setConfirm(''); router.replace('/(tabs)/collection')
    } catch { setError('Unable to update your password. Please try again or request a new link.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <View style={{ flex: 1, backgroundColor: '#fff' }}>
    <AppHeaderBar title="Reset Password" showBack />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '700' }}>Choose a new password</Text>
        <TextInput accessibilityLabel="New password" placeholder="New password (at least 8 characters)" secureTextEntry textContentType="newPassword" autoCapitalize="none" editable={ready && !busy} value={password} onChangeText={setPassword} style={{ padding: 14, borderWidth: 1, borderColor: Colors.gray[300], borderRadius: 8, fontSize: 16 }} />
        <TextInput accessibilityLabel="Confirm new password" placeholder="Confirm password" secureTextEntry textContentType="newPassword" autoCapitalize="none" editable={ready && !busy} value={confirm} onChangeText={setConfirm} style={{ padding: 14, borderWidth: 1, borderColor: Colors.gray[300], borderRadius: 8, fontSize: 16 }} />
        {!!error && <Text accessibilityRole="alert" style={{ color: Colors.red[600], fontSize: 16 }}>{error}</Text>}
        <Button title={busy ? 'Please wait…' : 'Update Password'} disabled={!ready || busy} onPress={() => void save()} />
        <Button title="Request a New Reset Link" variant="secondary" disabled={busy} onPress={() => router.push('/(auth)/forgot-password')} />
      </ScrollView>
    </KeyboardAvoidingView>
  </View>
}
