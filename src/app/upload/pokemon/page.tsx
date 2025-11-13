'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PokemonUploadRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/upload?category=Pokemon')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-600">Redirecting to Pokemon card upload...</p>
    </div>
  )
}
