import { useLocalSearchParams } from 'expo-router'
import InAppPage from '@/components/ui/InAppPage'

/** Existing web intake owns pairing, preflight, credit reservation, retries and submission progress. */
export default function BulkGrade() {
  const params = useLocalSearchParams<{ category?: string; sub_category?: string }>()
  const query = new URLSearchParams()
  if (typeof params.category === 'string') query.set('category', params.category)
  if (typeof params.sub_category === 'string') query.set('sub_category', params.sub_category)
  return <InAppPage path={`/submissions/new?${query.toString()}`} title="Grade Multiple Cards" />
}
