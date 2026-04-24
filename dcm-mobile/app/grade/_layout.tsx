import { Stack } from 'expo-router'
import { Colors } from '@/lib/constants'

export default function GradeLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.purple[600],
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="capture" options={{ title: 'Capture Card', headerShown: false }} />
      <Stack.Screen name="review" options={{ title: 'Review & Submit' }} />
      <Stack.Screen name="processing" options={{ title: 'Grading', headerBackVisible: false }} />
    </Stack>
  )
}
