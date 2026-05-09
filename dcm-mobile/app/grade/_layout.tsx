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
      {/* Processing screen renders its own benefits carousel at the top
          in lieu of the Stack header — keeps the user engaged during the
          ~60-180s GPT-5.1 vision call instead of staring at a static
          "Grading" title. */}
      <Stack.Screen name="processing" options={{ headerShown: false }} />
    </Stack>
  )
}
