import { useState } from 'react'
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native'
import { Link } from 'expo-router'
import { useAuth } from '@/contexts/AuthContext'
import { Colors } from '@/lib/constants'
import Button from '@/components/ui/Button'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password')
      return
    }
    setError(null)
    setLoading(true)
    const { error: authError } = await signIn(email.trim(), password)
    setLoading(false)
    if (authError) {
      setError(authError.message || 'Login failed')
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Image source={require('@/assets/images/icon.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>DCM Grading</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>Email</Text>
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

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={Colors.gray[400]}
            secureTextEntry
            autoComplete="password"
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={{ marginTop: 8 }}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/register" style={styles.footerLink}>
              Sign Up
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 64, height: 64, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.gray[900] },
  subtitle: { fontSize: 15, color: Colors.gray[500], marginTop: 4 },
  form: { gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.gray[700] },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[300],
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
  },
  errorText: { color: Colors.red[600], fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: Colors.gray[500], fontSize: 14 },
  footerLink: { color: Colors.purple[600], fontWeight: '600', fontSize: 14 },
})
