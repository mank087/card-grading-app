/**
 * Native credits purchase screen — replaces the previous WebView wrapper
 * that pointed at /credits on the web. Required by Apple guideline 3.1.1
 * (digital content must use StoreKit IAP, not external web checkout).
 *
 * UI: a list of credit packs, each rendered as a branded banner image
 * (Basic / Pro / Elite / VIP) with the live store price below. Tap a
 * pack → native store sheet appears → user confirms → backend verifies
 * → CreditsContext refreshes.
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
  Image,
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
  getProductNumericPrice,
} from '@/lib/iap'
import type { Product } from 'react-native-iap'

const PACK_IMAGES: Record<IAPProductId, any> = {
  'dcm.credits.basic': require('@/assets/images/credits/basic.png'),
  'dcm.credits.pro': require('@/assets/images/credits/pro.png'),
  'dcm.credits.elite': require('@/assets/images/credits/elite.png'),
  'dcm.credits.vip': require('@/assets/images/credits/vip.png'),
}

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

      // Wire purchase listeners — these fire when StoreKit hands back a
      // completed transaction (the user finished the native dialog).
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
        onCancel: () => {
          setPurchasing(null)
        },
      })
    })()

    return () => {
      cleanup?.()
      // Don't disconnect on unmount — other screens may also use IAP.
      // The connection is cheap to keep alive for the app lifecycle.
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

  const openTerms = () => router.push('/pages/terms' as any)
  const openPrivacy = () => router.push('/pages/privacy' as any)

  // Map store-returned products by id for quick lookup.
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
              Credit packs are not available right now. Please make sure you are signed in to
              the App Store and try again.
            </Text>
          </View>
        )}

        {!loadingProducts &&
          CREDIT_PACKS.map((pack) => {
            const storeProduct = productById.get(pack.productId)
            // Only show packs the store actually returned (i.e. approved + live).
            // During first-time setup before Apple approves the IAPs, this
            // gracefully hides un-approved products.
            if (!storeProduct) return null
            const isPurchasing = purchasing === pack.productId
            const isAnyPurchasing = purchasing !== null
            const numericPrice = getProductNumericPrice(storeProduct)
            const perCredit =
              pack.credits > 1 && numericPrice > 0
                ? `$${(numericPrice / pack.credits).toFixed(2)} per credit`
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
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Buy ${pack.credits} credits for ${formatProductPrice(storeProduct)}`}
              >
                <Image
                  source={PACK_IMAGES[pack.productId]}
                  style={st.packImage}
                  resizeMode="cover"
                />
                <View style={st.packFooter}>
                  <View style={st.packFooterLeft}>
                    <Text style={st.packPrice}>{formatProductPrice(storeProduct)}</Text>
                    {perCredit !== '' && <Text style={st.packPerCredit}>{perCredit}</Text>}
                  </View>
                  <View style={st.packFooterRight}>
                    {isPurchasing ? (
                      <ActivityIndicator size="small" color={Colors.purple[600]} />
                    ) : (
                      <View style={st.buyChip}>
                        <Text style={st.buyChipText}>Buy</Text>
                        <Ionicons name="chevron-forward" size={14} color="#fff" />
                      </View>
                    )}
                  </View>
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
            Payment will be charged to your Apple ID at confirmation of purchase. Credits are
            added to your account immediately and never expire. Credits and purchases are shared
            between the DCM Grading app and dcmgrading.com.
          </Text>
        </View>

        <View style={st.legalLinks}>
          <TouchableOpacity onPress={openTerms} accessibilityRole="link">
            <Text style={st.legalLink}>Terms of Service</Text>
          </TouchableOpacity>
          <Text style={st.legalSep}>·</Text>
          <TouchableOpacity onPress={openPrivacy} accessibilityRole="link">
            <Text style={st.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
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
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    overflow: 'hidden',
  },
  packCardHighlighted: {
    borderColor: Colors.purple[400],
    borderWidth: 2,
  },
  packCardDimmed: { opacity: 0.5 },
  packImage: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: Colors.gray[100],
  },
  packFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  packFooterLeft: { flex: 1 },
  packFooterRight: { marginLeft: 12 },
  packPrice: { fontSize: 20, fontWeight: '800', color: Colors.gray[900] },
  packPerCredit: { fontSize: 12, color: Colors.gray[500], marginTop: 2 },
  buyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.purple[600],
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 999,
  },
  buyChipText: { color: '#fff', fontSize: 14, fontWeight: '700' },

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
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.purple[200],
  },
  restoreText: { fontSize: 13, fontWeight: '600', color: Colors.purple[700] },
})
