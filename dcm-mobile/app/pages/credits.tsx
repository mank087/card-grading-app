/**
 * Native credits purchase screen — mirrors the web /credits page card
 * layout (Basic / Pro / Elite / VIP) but uses StoreKit IAP instead of
 * Stripe Checkout. Required by Apple guideline 3.1.1.
 *
 * Connection + listener lifecycle is managed by the v15 `useIAP` hook
 * (the supported pattern in the Nitro architecture — survives screen
 * remounts and reliably fires onPurchaseSuccess / onPurchaseError).
 *
 * The web /credits page continues to handle desktop / browser users on
 * dcmgrading.com — Stripe checkout unchanged.
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useIAP, ErrorCode } from 'react-native-iap'
import type { Purchase, PurchaseError } from 'react-native-iap'
import { useAuth } from '@/contexts/AuthContext'
import { useCredits } from '@/contexts/CreditsContext'
import { Colors } from '@/lib/constants'
import AppHeaderBar from '@/components/AppHeaderBar'
import MobileTabBar from '@/components/MobileTabBar'
import {
  CREDIT_PACKS,
  CreditPack,
  IAP_PRODUCT_IDS,
  IAPProductId,
  BASE_PRICE_PER_CREDIT,
  getPackByProductId,
  formatProductPrice,
  getProductNumericPrice,
  verifyAndFinishPurchase,
} from '@/lib/iap'

const TIER_ACCENT: Record<
  CreditPack['colorKey'],
  { text: string; bg: string; border: string; shadow: string }
> = {
  blue:   { text: '#2563eb', bg: '#eff6ff', border: '#3b82f6', shadow: '#3b82f6' },
  purple: { text: '#7c3aed', bg: '#faf5ff', border: '#a855f7', shadow: '#7c3aed' },
  amber:  { text: '#d97706', bg: '#fffbeb', border: '#f59e0b', shadow: '#f59e0b' },
  silver: { text: '#4b5563', bg: '#f3f4f6', border: '#9ca3af', shadow: '#374151' },
}

export default function CreditsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { balance, refresh: refreshCredits } = useCredits()

  const [purchasing, setPurchasing] = useState<IAPProductId | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [restoring, setRestoring] = useState(false)

  const handlePurchaseSuccess = useCallback(
    async (purchase: Purchase) => {
      setVerifying(true)
      try {
        const creditsGranted = await verifyAndFinishPurchase(purchase)
        await refreshCredits()
        Alert.alert(
          'Purchase complete',
          creditsGranted > 0
            ? `${creditsGranted} ${creditsGranted === 1 ? 'credit' : 'credits'} added to your account.`
            : 'Your purchase was processed.',
        )
      } catch (err: any) {
        console.error('[Credits] Verify failed:', err)
        setErrorMessage(err?.message || 'Could not verify purchase. Please contact support.')
      } finally {
        setPurchasing(null)
        setVerifying(false)
      }
    },
    [refreshCredits],
  )

  const handlePurchaseError = useCallback((err: PurchaseError) => {
    console.warn('[Credits] Purchase error:', err.code, err.message)
    setPurchasing(null)
    if (err.code === ErrorCode.UserCancelled) {
      // User dismissed the native sheet — no error UI.
      return
    }
    setErrorMessage(err.message || 'Purchase failed. Please try again.')
  }, [])

  const {
    connected,
    products,
    fetchProducts,
    requestPurchase,
    restorePurchases,
  } = useIAP({
    onPurchaseSuccess: handlePurchaseSuccess,
    onPurchaseError: handlePurchaseError,
  })

  // Once connected, fetch the four credit-pack products from the store.
  useEffect(() => {
    if (!connected) return
    fetchProducts({ skus: [...IAP_PRODUCT_IDS], type: 'in-app' }).catch((err) => {
      console.error('[Credits] fetchProducts failed:', err)
      setErrorMessage(
        'Could not load credit packs. Please make sure you are signed in to the App Store and try again.',
      )
    })
  }, [connected, fetchProducts])

  const productById = useMemo(() => {
    const map = new Map<string, (typeof products)[number]>()
    for (const p of products) map.set(p.id, p)
    return map
  }, [products])

  const handleBuy = useCallback(
    async (pack: CreditPack) => {
      if (!user) {
        Alert.alert('Sign in required', 'Please sign in to purchase credits.')
        return
      }
      if (!connected) {
        setErrorMessage('Store is still connecting. Please try again in a moment.')
        return
      }
      setErrorMessage(null)
      setPurchasing(pack.productId)
      try {
        await requestPurchase({
          request: {
            apple: {
              sku: pack.productId,
              appAccountToken: user.id,
              andDangerouslyFinishTransactionAutomatically: false,
            },
            google: {
              skus: [pack.productId],
              obfuscatedAccountId: user.id,
            },
          },
          type: 'in-app',
        })
        // Result arrives via onPurchaseSuccess / onPurchaseError.
      } catch (err: any) {
        console.error('[Credits] requestPurchase threw:', err)
        setPurchasing(null)
        if (err?.code !== ErrorCode.UserCancelled) {
          setErrorMessage(err?.message || 'Could not start the purchase.')
        }
      }
    },
    [user, connected, requestPurchase],
  )

  const handleRestore = useCallback(async () => {
    setRestoring(true)
    setErrorMessage(null)
    try {
      await restorePurchases()
      await refreshCredits()
      Alert.alert('Restore complete', 'Your purchase history has been checked. Your balance is up to date.')
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not restore purchases.')
    } finally {
      setRestoring(false)
    }
  }, [restorePurchases, refreshCredits])

  const openTerms = () => router.push('/pages/terms' as any)
  const openPrivacy = () => router.push('/pages/privacy' as any)

  const loadingProducts = connected && products.length === 0
  const anyPurchaseInFlight = purchasing !== null || verifying

  return (
    <View style={st.container}>
      <AppHeaderBar showBack title="Buy Credits" />

      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={st.title}>Purchase Grading Credits</Text>
        <Text style={st.subtitle}>Get professional DCM Optic™ card grading in seconds</Text>

        {/* Current balance pill */}
        <View style={st.balancePill}>
          <Text style={st.balancePillLabel}>Your Balance:</Text>
          <Text style={st.balancePillValue}>{balance}</Text>
          <Text style={st.balancePillLabel}>{balance === 1 ? 'credit' : 'credits'}</Text>
        </View>

        {/* Error banner */}
        {errorMessage && (
          <View style={st.errorBox}>
            <Ionicons name="alert-circle" size={18} color={Colors.red[600]} />
            <Text style={st.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Loading */}
        {loadingProducts && (
          <View style={st.loadingBox}>
            <ActivityIndicator size="small" color={Colors.purple[600]} />
            <Text style={st.loadingText}>Loading credit packs…</Text>
          </View>
        )}

        {/* Empty state */}
        {!loadingProducts && connected && products.length === 0 && (
          <View style={st.emptyBox}>
            <Ionicons name="alert-circle-outline" size={22} color={Colors.gray[500]} />
            <Text style={st.emptyText}>
              Credit packs are not available right now. Please make sure you are signed in to the
              App Store and try again.
            </Text>
          </View>
        )}

        {/* Tier cards */}
        {CREDIT_PACKS.map((pack) => {
          const storeProduct = productById.get(pack.productId)
          if (!storeProduct) return null
          const accent = TIER_ACCENT[pack.colorKey]
          const isPurchasing = purchasing === pack.productId
          const numericPrice = getProductNumericPrice(storeProduct)
          const savingsDollars =
            pack.savingsPercent && numericPrice > 0
              ? (BASE_PRICE_PER_CREDIT * pack.credits - numericPrice).toFixed(2)
              : null

          return (
            <View
              key={pack.productId}
              style={[
                st.card,
                { borderColor: accent.border, shadowColor: accent.shadow },
                pack.popular && st.cardPopular,
                pack.bestValue && st.cardBestValue,
              ]}
            >
              {/* Gradient header */}
              <LinearGradient
                colors={pack.headerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={st.cardHeader}
              >
                <View style={st.cardHeaderRow}>
                  <View style={st.cardHeaderTitle}>
                    <Text style={st.cardHeaderIcon}>{pack.icon}</Text>
                    <Text style={st.cardHeaderName}>{pack.name}</Text>
                  </View>
                  {pack.savingsPercent ? (
                    <View style={st.savingsBadge}>
                      <Text style={st.savingsBadgeText}>Save {pack.savingsPercent}%</Text>
                    </View>
                  ) : null}
                </View>
                {/* Second row: MOST POPULAR / BEST VALUE pill, inset to the
                    left so it reads as a label under the tier name. */}
                {pack.popular && (
                  <View style={st.headerPillPopular}>
                    <Text style={st.headerPillPopularText}>⭐ MOST POPULAR</Text>
                  </View>
                )}
                {pack.bestValue && (
                  <View style={st.headerPillBest}>
                    <Text style={st.headerPillBestText}>★ BEST VALUE</Text>
                  </View>
                )}
              </LinearGradient>

              {/* Body */}
              <View style={st.cardBody}>
                {/* Price */}
                <View style={st.priceBlock}>
                  <Text style={st.priceText}>{formatProductPrice(storeProduct)}</Text>
                  <Text style={st.priceDescription}>{pack.description}</Text>
                </View>

                {/* Credits hero block — most prominent spec on the card */}
                <View style={[st.creditsHero, { backgroundColor: accent.bg, borderColor: accent.border }]}>
                  <Text style={[st.creditsHeroValue, { color: accent.text }]}>
                    {pack.credits}
                  </Text>
                  <Text style={[st.creditsHeroLabel, { color: accent.text }]}>
                    {pack.credits === 1 ? 'CREDIT' : 'CREDITS'}
                  </Text>
                </View>

                {/* Per-grade cost */}
                <View style={st.perGradeBox}>
                  <View style={st.perGradeRow}>
                    <Text style={st.perGradeLabel}>Cost per grade</Text>
                    <Text style={[st.perGradeValue, { color: accent.text }]}>
                      ${pack.perGradeCost.toFixed(2)}
                    </Text>
                  </View>
                  {savingsDollars ? (
                    <Text style={st.perGradeSavings}>You save ${savingsDollars} vs Basic</Text>
                  ) : (
                    <Text style={st.perGradeStandard}>Standard rate</Text>
                  )}
                </View>

                {/* CTA */}
                <TouchableOpacity
                  onPress={() => handleBuy(pack)}
                  disabled={anyPurchaseInFlight || !connected}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Buy ${pack.credits} credits for ${formatProductPrice(storeProduct)}`}
                  style={[
                    st.buyButton,
                    (anyPurchaseInFlight || !connected) && st.buyButtonDisabled,
                  ]}
                >
                  <LinearGradient
                    colors={pack.headerGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={st.buyButtonGradient}
                  >
                    {isPurchasing || (verifying && purchasing === pack.productId) ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={st.buyButtonText}>
                          {pack.id === 'vip'
                            ? 'Get VIP Package'
                            : `Buy ${pack.credits} ${pack.credits === 1 ? 'Credit' : 'Credits'}`}
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )
        })}

        {/* Fine print */}
        <View style={st.fineprint}>
          <Text style={st.fineprintText}>
            Payment will be charged to your Apple ID at confirmation of purchase. Credits are
            added to your account immediately and never expire. Credits are shared between the
            DCM Grading app and dcmgrading.com.
          </Text>
        </View>

        {/* Legal links */}
        <View style={st.legalLinks}>
          <TouchableOpacity onPress={openTerms} accessibilityRole="link">
            <Text style={st.legalLink}>Terms of Service</Text>
          </TouchableOpacity>
          <Text style={st.legalSep}>·</Text>
          <TouchableOpacity onPress={openPrivacy} accessibilityRole="link">
            <Text style={st.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        {/* Restore */}
        <TouchableOpacity
          style={st.restoreBtn}
          onPress={handleRestore}
          disabled={restoring}
          accessibilityRole="button"
        >
          {restoring ? (
            <ActivityIndicator size="small" color={Colors.purple[600]} />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={16} color={Colors.purple[600]} />
              <Text style={st.restoreText}>Restore Purchases</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 16 + insets.bottom }} />
      </ScrollView>

      <MobileTabBar />
    </View>
  )
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 80 },

  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.gray[900],
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.gray[600],
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },

  balancePill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.purple[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 16,
  },
  balancePillLabel: { fontSize: 13, color: Colors.gray[600] },
  balancePillValue: { fontSize: 20, fontWeight: '800', color: Colors.purple[600] },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.red[50],
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.red[100],
  },
  errorText: { flex: 1, fontSize: 12, color: Colors.red[600], lineHeight: 16 },

  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    marginBottom: 12,
  },
  loadingText: { fontSize: 13, color: Colors.gray[600] },

  emptyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.gray[100],
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    marginBottom: 12,
  },
  emptyText: { flex: 1, fontSize: 13, color: Colors.gray[700], lineHeight: 18 },

  // Tier card — every card gets a 2px tier-accent border + tier-tinted
  // shadow. Pro and VIP bump the border to 3px and intensify the shadow
  // so the highlighted tiers still read as elevated.
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 18,
    overflow: 'hidden',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,
  },
  cardPopular: {
    borderWidth: 3,
    shadowOpacity: 0.32,
    shadowRadius: 22,
  },
  cardBestValue: {
    borderWidth: 3,
    shadowOpacity: 0.28,
    shadowRadius: 22,
  },

  // In-header pill below the title row. Matches the web /credits design.
  // Sits inset on the left so it reads as a sub-label under the tier name.
  headerPillPopular: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  headerPillPopularText: {
    color: Colors.purple[700],
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  headerPillBest: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerPillBestText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },

  cardHeader: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeaderIcon: { fontSize: 28 },
  cardHeaderName: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  savingsBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  savingsBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  cardBody: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18 },

  priceBlock: { alignItems: 'center', marginBottom: 14 },
  priceText: { fontSize: 40, fontWeight: '800', color: Colors.gray[900], letterSpacing: -0.5 },
  priceDescription: { fontSize: 13, color: Colors.gray[500], marginTop: 4, textAlign: 'center' },

  // Big credits hero — the headline spec on each card
  creditsHero: {
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 12,
  },
  creditsHeroValue: { fontSize: 44, fontWeight: '900', letterSpacing: -1, lineHeight: 48 },
  creditsHeroLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 2,
    opacity: 0.85,
  },

  perGradeBox: {
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: Colors.gray[50],
    borderWidth: 1,
    borderColor: Colors.gray[100],
    marginBottom: 16,
  },
  perGradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  perGradeLabel: { fontSize: 13, fontWeight: '600', color: Colors.gray[600] },
  perGradeValue: { fontSize: 20, fontWeight: '800' },
  perGradeSavings: { fontSize: 11, fontWeight: '700', color: Colors.green[600], marginTop: 3 },
  perGradeStandard: { fontSize: 11, color: Colors.gray[400], marginTop: 3 },

  buyButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  buyButtonDisabled: { opacity: 0.5 },
  buyButtonGradient: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buyButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  fineprint: { marginTop: 8, paddingHorizontal: 4 },
  fineprintText: {
    fontSize: 11,
    color: Colors.gray[500],
    lineHeight: 16,
    textAlign: 'center',
  },

  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  legalLink: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.purple[600],
    textDecorationLine: 'underline',
  },
  legalSep: { fontSize: 12, color: Colors.gray[400] },

  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.purple[200],
  },
  restoreText: { fontSize: 13, fontWeight: '600', color: Colors.purple[700] },
})
