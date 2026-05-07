import { useEffect, useState } from 'react'
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Image, TouchableOpacity } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/AuthContext'
import { Colors } from '@/lib/constants'
import Button from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { completeOAuthFromUrl } from '@/lib/oauthComplete'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'

WebBrowser.maybeCompleteAuthSession()

export default function RegisterScreen() {
  const { signUp } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [appleAvailable, setAppleAvailable] = useState(false)

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false))
    }
  }, [])

  const handleApple = async () => {
    setError(null)
    setOauthLoading('apple')
    try {
      const rawNonce = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      )
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      })
      if (!credential.identityToken) {
        throw new Error('Apple did not return an identity token')
      }
      const { error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      })
      if (authError) setError(authError.message)
    } catch (err: any) {
      if (err?.code !== 'ERR_REQUEST_CANCELED') {
        setError(err?.message || 'Apple sign in failed')
      }
    } finally {
      setOauthLoading(null)
    }
  }

  const handleOAuth = async (provider: 'google' | 'facebook') => {
    setError(null)
    setOauthLoading(provider)
    try {
      const redirectUrl = makeRedirectUri({ scheme: 'dcmgrading' })
      console.log('[OAuth]', provider, 'redirectUrl:', redirectUrl)
      // Provider-specific OAuth params:
      //   Google: prompt=select_account → forces account picker even when
      //           the system browser has an existing Google session.
      //   Facebook: display=touch → forces the mobile web OAuth dialog
      //           instead of trying to hand off to the installed Facebook
      //           app. Without this, FB's mobile flow tries to deep-link
      //           into the FB app, which silently fails when the FB app
      //           can't redirect back to our custom URL scheme.
      const queryParams: Record<string, string> = provider === 'google'
        ? { prompt: 'select_account' }
        : { display: 'touch' }
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams,
        },
      })
      console.log('[OAuth]', provider, 'signInWithOAuth →', { error: oauthError?.message, hasUrl: !!data?.url, url: data?.url?.slice(0, 120) })

      if (oauthError) {
        setError(oauthError.message)
        setOauthLoading(null)
        return
      }

      if (!data?.url) {
        setError(`${provider} sign-in failed: no auth URL returned. The provider may not be enabled in Supabase.`)
        setOauthLoading(null)
        return
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl, {
        preferEphemeralSession: true,
      })
      console.log('[OAuth]', provider, 'WebBrowser result type:', result.type, 'url:', (result as any).url?.slice(0, 200))

      if (result.type === 'success' && result.url) {
        const ok = await completeOAuthFromUrl(result.url, supabase)
        console.log('[OAuth]', provider, 'completeOAuth →', ok)
        if (!ok.ok) setError(ok.error || 'Sign in failed. Please try again.')
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        // No-op — user backed out of the sheet
      } else {
        setError(`${provider} sign-in didn't complete (${result.type}). Try again.`)
      }
    } catch (err: any) {
      setError(err.message || 'OAuth sign up failed')
    } finally {
      setOauthLoading(null)
    }
  }

  // Mirrors src/app/login/page.tsx isExistingAccountError. Supabase
  // surfaces a few different phrasings depending on which step in the
  // signup flow detected the dup; the strings are stable enough to
  // pattern-match.
  const isExistingAccountError = (errorMsg: string) => {
    const lower = errorMsg.toLowerCase()
    return lower.includes('already registered') ||
           lower.includes('already exists') ||
           lower.includes('user already') ||
           lower.includes('email already') ||
           lower.includes('duplicate')
  }

  const handleRegister = async () => {
    if (!email.trim() || !password) {
      setError('Please fill in all fields')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setError(null)
    setLoading(true)
    const trimmedEmail = email.trim()
    const { error: authError, existingAccount } = await signUp(trimmedEmail, password)
    setLoading(false)

    // Existing-account detection — two channels:
    //   1) Supabase returned an explicit error matching "already registered"
    //      etc. (rare; only happens when anti-enumeration is off in Supabase
    //      auth settings).
    //   2) Supabase silently succeeded but the returned user has no
    //      identities (anti-enumeration default). The AuthContext surfaces
    //      this as `existingAccount`.
    // In both cases route to login with the email pre-filled.
    if (existingAccount || (authError && isExistingAccountError(authError.message || ''))) {
      router.replace({
        pathname: '/(auth)/login',
        params: { existingEmail: trimmedEmail },
      } as any)
      return
    }

    if (authError) {
      setError(authError.message || 'Registration failed')
    } else {
      Alert.alert(
        'Check your email',
        'We sent a confirmation link to your email. Please verify your account to continue.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      )
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Image source={require('@/assets/images/dcm-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Start grading your cards with DCM</Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* OAuth Buttons. Apple is rendered first on iOS to satisfy
              App Store Review Guideline 4.8, which requires SIWA to be at
              least as prominent as other social login options. */}
          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={10}
              style={styles.appleButton}
              onPress={handleApple}
            />
          )}

          <TouchableOpacity
            style={[styles.oauthButton, styles.googleButton]}
            onPress={() => handleOAuth('google')}
            disabled={!!oauthLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={styles.oauthText}>
              {oauthLoading === 'google' ? 'Connecting...' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.oauthButton, styles.facebookButton]}
            onPress={() => handleOAuth('facebook')}
            disabled={!!oauthLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-facebook" size={20} color="#1877F2" />
            <Text style={styles.oauthText}>
              {oauthLoading === 'facebook' ? 'Connecting...' : 'Continue with Facebook'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

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
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={Colors.gray[400]}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.gray[400]} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm your password"
            placeholderTextColor={Colors.gray[400]}
            secureTextEntry={!showPassword}
          />

          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            style={{ marginTop: 8 }}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" style={styles.footerLink}>
              Sign In
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
  logo: { width: 80, height: 80, marginBottom: 12 },
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: 10,
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: Colors.gray[900],
  },
  eyeButton: {
    padding: 14,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    backgroundColor: Colors.red[50],
    borderWidth: 1,
    borderColor: Colors.red[100],
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: Colors.red[600], fontSize: 14 },

  // OAuth
  appleButton: {
    height: 50,
    width: '100%',
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  googleButton: {
    backgroundColor: Colors.white,
    borderColor: Colors.gray[300],
  },
  facebookButton: {
    backgroundColor: Colors.white,
    borderColor: Colors.gray[300],
  },
  oauthText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.gray[800],
  },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.gray[300] },
  dividerText: { paddingHorizontal: 12, fontSize: 13, color: Colors.gray[400] },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: Colors.gray[500], fontSize: 14 },
  footerLink: { color: Colors.purple[600], fontWeight: '600', fontSize: 14 },
})
