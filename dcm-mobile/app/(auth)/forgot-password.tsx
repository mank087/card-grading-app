/**
 * Forgot Password — mirrors src/app/forgot-password/page.tsx (web).
 *
 * User enters their email → we call supabase.auth.resetPasswordForEmail
 * which sends them a one-time link. We tell Supabase to redirect that
 * link to the web's /reset-password page (https://www.dcmgrading.com/reset-password)
 * because email-client deep linking back into a custom URL scheme is
 * unreliable on Android Gmail / iOS Mail. The user completes the reset
 * on web, then comes back to the mobile app and signs in with their
 * new password.
 *
 * This matches what most production apps do for password reset on
 * mobile, and keeps the reset experience visually identical to web.
 */

import { useState } from 'react'
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image, TouchableOpacity } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/lib/constants'
import Button from '@/components/ui/Button'
import ResponsiveContainer from '@/components/ui/ResponsiveContainer'

const WEB_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }
    setError(null)
    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${WEB_URL}/reset-password`,
    })
    setLoading(false)
    if (resetError) {
      setError(resetError.message || 'Failed to send reset email.')
    } else {
      setSuccess(true)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ResponsiveContainer maxWidth={480}>
        <View style={styles.header}>
          <Image source={require('@/assets/images/dcm-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>DCM Grading</Text>
        </View>

        <View style={styles.card}>
          {success ? (
            <View style={{ alignItems: 'center' }}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={32} color={Colors.green[600]} />
              </View>
              <Text style={styles.heading}>Check your email</Text>
              <Text style={styles.body}>
                We've sent a password reset link to <Text style={{ fontWeight: '700' }}>{email}</Text>. Tap the link in the email to reset your password.
              </Text>
              <Text style={styles.hint}>
                Didn't receive the email? Check your spam folder or try again.
              </Text>
              <Button
                title="Try a different email"
                variant="secondary"
                onPress={() => { setSuccess(false); setEmail('') }}
                style={{ marginTop: 12, width: '100%' }}
              />
              <Button
                title="Back to login"
                onPress={() => router.replace('/(auth)/login')}
                style={{ marginTop: 8, width: '100%' }}
              />
            </View>
          ) : (
            <>
              <Text style={styles.heading}>Forgot your password?</Text>
              <Text style={styles.body}>
                Enter your email address and we'll send you a link to reset your password.
              </Text>

              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={Colors.gray[400]}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Button
                title={loading ? 'Sending…' : 'Send reset link'}
                onPress={handleSubmit}
                loading={loading}
                disabled={loading}
                style={{ marginTop: 16 }}
              />

              <View style={styles.footer}>
                <Link href="/(auth)/login" style={styles.footerLink}>
                  Back to login
                </Link>
              </View>
            </>
          )}
        </View>

        <Text style={styles.help}>
          Need help? <Text style={styles.helpLink} onPress={() => {/* could open mailto */}}>Contact support</Text>
        </Text>
        </ResponsiveContainer>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 56, height: 56, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.gray[900] },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  successIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.green[50],
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  heading: { fontSize: 22, fontWeight: '800', color: Colors.gray[900], marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 14, color: Colors.gray[600], lineHeight: 20, marginBottom: 16, textAlign: 'center' },
  hint: { fontSize: 12, color: Colors.gray[500], marginBottom: 12, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: Colors.gray[700], marginTop: 8, marginBottom: 6 },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.gray[200],
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: Colors.gray[900],
  },
  errorBox: {
    backgroundColor: Colors.red[50],
    borderWidth: 1,
    borderColor: Colors.red[100],
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  errorText: { color: Colors.red[600], fontSize: 13 },
  footer: { alignItems: 'center', marginTop: 16 },
  footerLink: { color: Colors.purple[600], fontSize: 14, fontWeight: '600' },
  help: { fontSize: 13, color: Colors.gray[500], textAlign: 'center', marginTop: 16 },
  helpLink: { color: Colors.purple[600], fontWeight: '600' },
})
