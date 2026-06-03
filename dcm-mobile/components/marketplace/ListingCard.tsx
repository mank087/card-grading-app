import { View, Text, Image, TouchableOpacity, StyleSheet, Linking, Share, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'
import type { MarketplaceListing } from '@/lib/marketplaceApi'

type Mode = 'active' | 'sold' | 'ended'

interface Props {
  listing: MarketplaceListing
  mode: Mode
  /** For 'ended' mode: tapped Relist. */
  onRelist?: (cardId: string) => void
}

/**
 * Shared row component for Active/Sold/Ended tabs. Tap the row to open
 * the listing on eBay. Native share sheet via long-press for the listing
 * URL. Mode-specific accents (price color, action button) keep parity
 * with the web tabs without duplicating logic.
 */
export default function ListingCard({ listing, mode, onRelist }: Props) {
  const openOnEbay = () => {
    if (listing.listingUrl) Linking.openURL(listing.listingUrl).catch(() => {})
  }

  const handleShare = async () => {
    if (!listing.listingUrl) return
    try {
      await Share.share({
        message: Platform.OS === 'ios' ? listing.title : `${listing.title}\n${listing.listingUrl}`,
        url: listing.listingUrl,        // iOS only
        title: listing.title,
      })
    } catch { /* user dismissed */ }
  }

  const price = safePrice(listing.price)
  const qty = listing.quantitySold || 1
  const dateLabel = mode === 'sold' ? formatDate(listing.soldAt)
    : mode === 'ended' ? formatDate(listing.endedAt)
    : formatDate(listing.publishedAt)
  const priceColor = mode === 'sold' ? Colors.green[600] : Colors.gray[900]

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={openOnEbay}
      onLongPress={handleShare}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${listing.cardName}, ${price}, ${mode === 'sold' ? 'sold' : mode === 'ended' ? 'ended' : 'active'}`}
      accessibilityHint="Tap to open on eBay. Long press to share."
    >
      <View style={styles.thumb}>
        {listing.thumbnailUrl ? (
          <Image source={{ uri: listing.thumbnailUrl }} style={styles.thumbImg} resizeMode="cover" />
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{listing.cardName}</Text>
        <Text style={styles.meta}>
          {listing.cardCategory}{listing.cardGrade != null ? ` · Grade ${listing.cardGrade}` : ''}
        </Text>
        <Text style={styles.title} numberOfLines={2}>{listing.title}</Text>

        <View style={styles.bottomRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.price, { color: priceColor }]}>
              ${price}{mode === 'sold' && qty > 1 ? ` × ${qty}` : ''}
            </Text>
            <Text style={styles.date}>{dateLabel}</Text>
          </View>

          {mode === 'ended' && onRelist && (
            <TouchableOpacity
              style={styles.relistBtn}
              onPress={() => onRelist(listing.cardId)}
              accessibilityRole="button"
              accessibilityLabel={`Relist ${listing.cardName}`}
            >
              <Ionicons name="refresh" size={13} color={Colors.purple[600]} />
              <Text style={styles.relistText}>Relist</Text>
            </TouchableOpacity>
          )}

          {mode === 'active' && listing.listingUrl && (
            <View style={styles.openIndicator}>
              <Text style={styles.openText}>eBay</Text>
              <Ionicons name="open-outline" size={12} color={Colors.purple[600]} />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

function safePrice(n: number): string {
  return (Number.isFinite(n) ? n : 0).toFixed(2)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', gap: 12,
    backgroundColor: Colors.white,
    borderColor: Colors.gray[200], borderWidth: 1,
    borderRadius: 12, padding: 12,
  },
  thumb: {
    width: 56, height: 80, borderRadius: 6,
    backgroundColor: Colors.gray[100], overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '700', color: Colors.gray[900] },
  meta: { fontSize: 11, color: Colors.gray[500], marginTop: 2 },
  title: { fontSize: 12, color: Colors.gray[700], marginTop: 4, lineHeight: 16 },
  bottomRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 },
  price: { fontSize: 15, fontWeight: '700' },
  date: { fontSize: 11, color: Colors.gray[500], marginTop: 1 },
  relistBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: Colors.purple[50],
    borderColor: Colors.purple[200], borderWidth: 1,
    borderRadius: 8,
  },
  relistText: { fontSize: 12, fontWeight: '700', color: Colors.purple[700] },
  openIndicator: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  openText: { fontSize: 11, fontWeight: '600', color: Colors.purple[600] },
})
