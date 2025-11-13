'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SportsUploadRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/upload?category=Sports')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-600">Redirecting to Sports card upload...</p>
    </div>
  )
}
