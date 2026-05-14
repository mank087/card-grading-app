/**
 * Native credits purchase screen — replaces the previous WebView wrapper
 * that pointed at /credits on the web. Required by Apple guideline 3.1.1
 * (digital content must use StoreKit IAP, not external web checkout).
 * Android uses the equivalent Google Play Billing path through the same
 * react-native-iap wrapper.
 *
 * UI: list of credit packs. Tap one → native store sheet appears → user
 * confirms → backend verifies → CreditsContext refreshes.
 *
 * The web /credits page continues to handle desktop / browser users on
 * dcmgrading.com — Stripe checkout unchanged.
 */

import { useEffect, useState, useCallback } from 'react'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/contexts/AuthContext'
import { useCredits } from '@/contexts/CreditsContext'
import { Colors } from '@/lib/constants'
import AppHeaderBar from '@/components/AppHeaderBar'
import MobileTabBar from '@/components/MobileTabBar'
import {
  CREDIT_PACKS,
  IAPProductId,
  connect,
  fetchProducts,
  attachPurchaseListeners,
  purchaseCreditPack,
  restorePurchases,
  formatProductPrice,
  getProductDisplayName,
  getProductNumericPrice,
} from '@/lib/iap'
import type { Product } from 'react-native-iap'

export default function CreditsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { balance, refresh: refreshCredits } = useCredits()

  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [purchasing, setPurchasing] = useState<IAPProductId | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Connect to store + load products on mount. Cleanup listeners on unmount.
  useEffect(() => {
    let cleanup: (() => void) | null = null

    ;(async () => {
      try {
        await connect()
        const fetched = await fetchProducts()
        setProducts(fetched)
      } catch (err: any) {
        console.error('[Credits] Failed to load products:', err)
        setErrorMessage(
          'Could not load credit packs. Please make sure you are signed in to the App Store and try again.',
        )
      } finally {
        setLoadingProducts(false)
      }

      // Wire purchase listeners — these fire when StoreKit/Play Billing
      // hands back a completed transaction (the user finished the native dialog).
      cleanup = attachPurchaseListeners({
        onSuccess: async (creditsGranted) => {
          setPurchasing(null)
          await refreshCredits()
          Alert.alert(
            'Purchase complete',
            creditsGranted > 0
              ? `${creditsGranted} ${creditsGranted === 1 ? 'credit' : 'credits'} added to your account.`
              : 'Your purchase was processed.',
          )
        },
        onError: (msg) => {
          setPurchasing(null)
          setErrorMessage(msg)
        },
      })
    })()

    return () => {
      cleanup?.()
      // Don't disconnect on unmount — other screens may also use IAP.
      // The connection is cheap to keep alive for the app lifecycle.
      // disconnect() is reserved for app-level teardown if we ever need it.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePurchase = useCallback(
    async (productId: IAPProductId) => {
      if (!user) {
        Alert.alert('Sign in required', 'Please sign in to purchase credits.')
        return
      }
      setErrorMessage(null)
      setPurchasing(productId)
      try {
        await purchaseCreditPack(productId, user.id)
      } catch (err: any) {
        // Purchase initiation failed (user_cancelled handled by listener)
        setPurchasing(null)
        if (err?.code !== 'E_USER_CANCELLED') {
          setErrorMessage(err?.message || 'Could not start the purchase.')
        }
      }
    },
    [user],
  )

  const handleRestore = useCallback(async () => {
    setRestoring(true)
    setErrorMessage(null)
    try {
      const { processed } = await restorePurchases()
      Alert.alert(
        'Restore complete',
        processed > 0
          ? `${processed} ${processed === 1 ? 'transaction' : 'transactions'} processed.`
          : 'No unfinished purchases to restore. Your balance is up to date.',
      )
      await refreshCredits()
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not restore purchases.')
    } finally {
      setRestoring(false)
    }
  }, [refreshCredits])

  // Map store-returned products by id for quick lookup. Falls back to
  // CREDIT_PACKS metadata for credits + label if the store hasn't returned
  // the product yet (still loading or unavailable in this storefront).
  const productById = new Map(products.map((p) => [p.id, p]))

  return (
    <View style={st.container}>
      <AppHeaderBar showBack title="Buy Credits" />

      <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}>
        <View style={st.balanceCard}>
          <Text style={st.balanceLabel}>Your Balance</Text>
          <Text style={st.balanceValue}>
            {balance} {balance === 1 ? 'credit' : 'credits'}
          </Text>
        </View>

        <Text style={st.sectionTitle}>Credit Packs</Text>
        <Text style={st.sectionSub}>
          Each credit grades one trading card. Credits never expire.
        </Text>

        {loadingProducts && (
          <View style={st.loadingBox}>
            <ActivityIndicator size="small" color={Colors.purple[600]} />
            <Text style={st.loadingText}>Loading credit packs…</Text>
          </View>
        )}

        {!loadingProducts && products.length === 0 && (
          <View style={st.emptyBox}>
            <Ionicons name="alert-circle-outline" size={24} color={Colors.gray[500]} />
            <Text style={st.emptyText}>
              Credit packs are not available right now. Please check your App Store / Play Store
              account and try again.
            </Text>
          </View>
        )}

        {!loadingProducts &&
          CREDIT_PACKS.map((pack) => {
            const storeProduct = productById.get(pack.productId)
            // Only show packs the store actually returned (i.e. approved + live).
            // During first-time setup before Apple/Google approve the IAPs,
            // this gracefully hides un-approved products.
            if (!storeProduct) return null
            const isPurchasing = purchasing === pack.productId
            const isAnyPurchasing = purchasing !== null
            const numericPrice = getProductNumericPrice(storeProduct)
            const perCredit =
              pack.credits > 0 && numericPrice > 0
                ? `$${(numericPrice / pack.credits).toFixed(2)}/credit`
                : ''
            return (
              <TouchableOpacity
                key={pack.productId}
                style={[
                  st.packCard,
                  pack.highlighted && st.packCardHighlighted,
                  isAnyPurchasing && !isPurchasing && st.packCardDimmed,
                ]}
                onPress={() => handlePurchase(pack.productId)}
                disabled={isAnyPurchasing}
                accessibilityRole="button"
                accessibilityLabel={`Buy ${pack.credits} credits for ${formatProductPrice(storeProduct)}`}
              >
                <View style={st.packLeft}>
                  <Text style={st.packCredits}>
                    {pack.credits} {pack.credits === 1 ? 'Credit' : 'Credits'}
                  </Text>
                  <Text style={st.packLabel}>
                    {getProductDisplayName(storeProduct, pack.label)}
                  </Text>
                  {perCredit !== '' && pack.credits > 1 && (
                    <Text style={st.packPerCredit}>{perCredit}</Text>
                  )}
                  {pack.highlighted && (
                    <View style={st.bestValueBadge}>
                      <Text style={st.bestValueText}>BEST VALUE</Text>
                    </View>
                  )}
                </View>
                <View style={st.packRight}>
                  {isPurchasing ? (
                    <ActivityIndicator size="small" color={Colors.purple[600]} />
                  ) : (
                    <>
                      <Text style={st.packPrice}>{formatProductPrice(storeProduct)}</Text>
                      <Ionicons name="chevron-forward" size={18} color={Colors.gray[400]} />
                    </>
                  )}
                </View>
              </TouchableOpacity>
            )
          })}

        {errorMessage && (
          <View style={st.errorBox}>
            <Ionicons name="alert-circle" size={18} color={Colors.red[600]} />
            <Text style={st.errorText}>{errorMessage}</Text>
          </View>
        )}

        <View style={st.fineprint}>
          <Text style={st.fineprintText}>
            Payment will be charged to your{' '}
            {/* Platform-aware label */}
            App Store / Play Store account. Purchases are processed by Apple or Google;
            DCM Grading receives the order and grants credits to your account immediately.
            Credits never expire and are shared across web and mobile.
          </Text>
        </View>

        <TouchableOpacity
          style={st.restoreBtn}
          onPress={handleRestore}
          disabled={restoring}
          accessibilityRole="button"
          accessibilityLabel="Restore previous purchases"
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

        <View style={{ height: 12 + insets.bottom }} />
      </ScrollView>

      <MobileTabBar />
    </View>
  )
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 80 },

  balanceCard: {
    backgroundColor: Colors.purple[600],
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  balanceValue: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 4,
  },
  sectionSub: { fontSize: 13, color: Colors.gray[500], marginBottom: 14 },

  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gray[200],
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
  },
  emptyText: { flex: 1, fontSize: 13, color: Colors.gray[700], lineHeight: 18 },

  packCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  packCardHighlighted: {
    borderColor: Colors.purple[600],
    borderWidth: 2,
    backgroundColor: Colors.purple[50],
  },
  packCardDimmed: { opacity: 0.5 },
  packLeft: { flex: 1 },
  packCredits: { fontSize: 17, fontWeight: '700', color: Colors.gray[900] },
  packLabel: { fontSize: 13, color: Colors.gray[500], marginTop: 2 },
  packPerCredit: { fontSize: 11, color: Colors.gray[400], marginTop: 4 },
  bestValueBadge: {
    backgroundColor: Colors.purple[600],
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  bestValueText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  packRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  packPrice: { fontSize: 16, fontWeight: '700', color: Colors.purple[700] },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.red[50],
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.red[100],
  },
  errorText: { flex: 1, fontSize: 12, color: Colors.red[600], lineHeight: 16 },

  fineprint: { marginTop: 16, paddingHorizontal: 4 },
  fineprintText: { fontSize: 11, color: Colors.gray[500], lineHeight: 16, textAlign: 'center' },

  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.purple[200],
  },
  restoreText: { fontSize: 13, fontWeight: '600', color: Colors.purple[700] },
})
