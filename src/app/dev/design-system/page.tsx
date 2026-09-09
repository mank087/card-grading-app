import { completeMetadata } from '@/lib/seo/completeMetadata'
import { notFound } from 'next/navigation'
import DesignPreview from '@/components/design/DesignPreview'

export const dynamic = 'force-dynamic'
export const metadata = completeMetadata({ title: 'Local Design Preview', robots: { index: false, follow: false } })

export default function DesignSystemPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <DesignPreview />
}
