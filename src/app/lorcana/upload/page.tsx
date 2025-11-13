'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LorcanaUploadRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/upload?category=Lorcana')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-600">Redirecting to Lorcana card upload...</p>
    </div>
  )
}
