import { View, ActivityIndicator, Text, StyleSheet } from 'react-native'
import { Colors } from '@/lib/constants'

interface LoadingScreenProps {
  message?: string
}

export default function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.purple[600]} />
      <Text style={styles.text}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray[50],
  },
  text: {
    marginTop: 12,
    fontSize: 15,
    color: Colors.gray[500],
  },
})
