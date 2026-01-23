'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OnePieceUploadRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/upload?category=One Piece')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-600">Redirecting to One Piece card upload...</p>
    </div>
  )
}
