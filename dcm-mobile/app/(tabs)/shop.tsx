import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { Colors } from '@/lib/constants'
import { PRODUCTS, productUrl } from '@/lib/shopProducts'


export default function ShopScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>Enhance your card grading experience</Text>

      {PRODUCTS.map((product) => (
        <TouchableOpacity
          key={product.name}
          style={styles.productCard}
          onPress={() => WebBrowser.openBrowserAsync(productUrl(product))}
          activeOpacity={0.7}
          accessibilityLabel={`${product.name} on Amazon`}
          accessibilityHint={product.description}
          accessibilityRole="link"
        >
          <View style={styles.imageContainer}>
            {product.image
              ? <Image source={product.image} style={styles.productImage} resizeMode="contain" />
              : <View style={styles.imagePlaceholder}><Text style={styles.imagePlaceholderText}>{product.name}</Text></View>}
            {product.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{product.badge}</Text>
              </View>
            )}
          </View>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productDesc}>{product.description}</Text>
            <Text style={styles.shopLink}>Shop on Amazon {'>'}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { padding: 16 },
  subtitle: { fontSize: 14, color: Colors.gray[500], marginBottom: 16 },
  productCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    marginBottom: 12,
    overflow: 'hidden',
  },
  imageContainer: {
    backgroundColor: Colors.gray[50],
    padding: 20,
    alignItems: 'center',
  },
  productImage: { width: 160, height: 160 },
  imagePlaceholder: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  imagePlaceholderText: { fontSize: 13, fontWeight: '600', color: Colors.gray[500], textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: Colors.purple[600],
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  productInfo: { padding: 16 },
  productName: { fontSize: 17, fontWeight: '700', color: Colors.gray[900], marginBottom: 4 },
  productDesc: { fontSize: 13, color: Colors.gray[600], lineHeight: 18, marginBottom: 8 },
  shopLink: { color: Colors.purple[600], fontWeight: '600', fontSize: 14 },
})
