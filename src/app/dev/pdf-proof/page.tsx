'use client'

/**
 * Dev-only PDF rasterizer: renders /_proofs/<name>.pdf pages to canvases via
 * pdf.js (CDN) so label print proofs can be eyeballed / screenshotted in the
 * browser. 404 in production like the other /dev pages.
 */
import { useEffect, useRef, useState } from 'react'
import { notFound, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function Proof() {
  const sp = useSearchParams()
  const name = sp.get('name') || 'stock'
  const host = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState('loading pdf.js…')
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      if (!w.pdfjsLib) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js'
          s.onload = () => resolve()
          s.onerror = () => reject(new Error('pdf.js failed to load'))
          document.head.appendChild(s)
        })
        w.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
      }
      const doc = await w.pdfjsLib.getDocument(`/_proofs/${name}.pdf`).promise
      if (cancelled) return
      host.current!.innerHTML = ''
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p)
        const viewport = page.getViewport({ scale: 3 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = `${viewport.width * 1.2}px`
        canvas.style.display = 'block'
        canvas.style.marginBottom = '12px'
        host.current!.appendChild(canvas)
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      }
      setStatus(`rendered ${doc.numPages} page(s) of ${name}.pdf`)
    }
    run().catch(e => setStatus(String(e)))
    return () => { cancelled = true }
  }, [name])
  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <p className="text-xs text-gray-500 mb-3" data-testid="status">{status}</p>
      <div ref={host} />
    </main>
  )
}

export default function PdfProofDevPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <Suspense><Proof /></Suspense>
}
