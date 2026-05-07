import { useEffect, useState } from 'react'
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image, TouchableOpacity } from 'react-native'
import { Link, useLocalSearchParams } from 'expo-router'
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

export default function LoginScreen() {
  const { signIn } = useAuth()
  // When a user tries to sign up with an email that already exists, the
  // register screen redirects here with ?existingEmail=… — pre-fill the
  // form and show an inline notice so the user can just enter their
  // password instead of re-typing the email.
  const params = useLocalSearchParams<{ existingEmail?: string }>()
  const [email, setEmail] = useState(params.existingEmail || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [appleAvailable, setAppleAvailable] = useState(false)
  const [showExistingAccountNotice, setShowExistingAccountNotice] = useState(!!params.existingEmail)

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false))
    }
  }, [])

  const handleApple = async () => {
    setError(null)
    setOauthLoading('apple')
    try {
      // Apple requires a hashed nonce in the request and Supabase verifies the
      // raw nonce against the JWT's hashed `nonce` claim — see
      // https://supabase.com/docs/guides/auth/social-login/auth-apple#using-the-react-native-package
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
      // ERR_REQUEST_CANCELED is the user dismissing the sheet — not an error
      if (err?.code !== 'ERR_REQUEST_CANCELED') {
        setError(err?.message || 'Apple sign in failed')
      }
    } finally {
      setOauthLoading(null)
    }
  }

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
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams,
        },
      })
      console.log('[OAuth]', provider, 'signInWithOAuth →', { error: error?.message, hasUrl: !!data?.url, url: data?.url?.slice(0, 120) })

      if (error) {
        setError(error.message)
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
      setError(err.message || 'OAuth sign in failed')
    } finally {
      setOauthLoading(null)
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
          <Text style={styles.title}>Dynamic Collectibles Management</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        <View style={styles.form}>
          {showExistingAccountNotice && (
            <View style={styles.noticeBox}>
              <Ionicons name="information-circle" size={20} color={Colors.amber[600]} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>Account already exists</Text>
                <Text style={styles.noticeText}>
                  An account with this email already exists. Enter your password to sign in, or use one of the social buttons below.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowExistingAccountNotice(false)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Ionicons name="close" size={18} color={Colors.amber[700]} />
              </TouchableOpacity>
            </View>
          )}
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
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
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
              {oauthLoading === 'google' ? 'Signing in...' : 'Continue with Google'}
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
              {oauthLoading === 'facebook' ? 'Signing in...' : 'Continue with Facebook'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email/Password */}
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
              placeholder="Your password"
              placeholderTextColor={Colors.gray[400]}
              secureTextEntry={!showPassword}
              autoComplete="password"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.gray[400]} />
            </TouchableOpacity>
          </View>

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
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.amber[50],
    borderWidth: 1,
    borderColor: Colors.amber[100],
    borderRadius: 10,
    padding: 12,
  },
  noticeTitle: { fontSize: 13, fontWeight: '700', color: Colors.amber[600], marginBottom: 2 },
  noticeText: { fontSize: 12, color: Colors.amber[700], lineHeight: 16 },
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
