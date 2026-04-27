import { useLocalSearchParams } from 'expo-router'
import InAppPage from '@/components/ui/InAppPage'

export default function EbayListPage() {
  const { cardPath } = useLocalSearchParams<{ cardPath: string }>()
  return <InAppPage path={cardPath || '/'} />
}
