import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { Colors } from '@/lib/constants'

const products = [
  {
    name: 'Card Scanner Stand',
    description: 'Hands-free phone stand for consistent overhead card photography.',
    image: require('@/assets/images/shop-scanner-stand.jpg'),
    link: 'https://www.amazon.com/dp/B0G4D5J8GG?th=1&linkCode=ll2&tag=dcmgrading-20',
    badge: 'Best for Photos',
  },
  {
    name: 'Magnetic Graded Slabs',
    description: 'Premium magnetic closure cases for displaying DCM-graded cards.',
    image: require('@/assets/images/shop-magnetic-slabs.jpg'),
    link: 'https://www.amazon.com/dp/B0GK6PSGKQ?th=1&linkCode=ll2&tag=dcmgrading-20',
    badge: 'Premium Display',
  },
  {
    name: 'Traditional Graded Slabs',
    description: 'Classic snap-fit graded card slabs. 100 per pack — great value.',
    image: require('@/assets/images/shop-traditional-slabs.jpg'),
    link: 'https://amzn.to/42gedyc',
    badge: 'Best Value',
  },
]

export default function ShopScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>Enhance your card grading experience</Text>

      {products.map((product) => (
        <TouchableOpacity
          key={product.name}
          style={styles.productCard}
          onPress={() => WebBrowser.openBrowserAsync(product.link)}
          activeOpacity={0.7}
        >
          <View style={styles.imageContainer}>
            <Image source={product.image} style={styles.productImage} resizeMode="contain" />
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
