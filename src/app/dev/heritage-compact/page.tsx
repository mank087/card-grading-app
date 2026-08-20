/**
 * DEV-ONLY proof sheet for Heritage Compact.
 *
 * Renders every panel and both composed fold sheets through the exact canvas
 * functions the print PDFs use, at a size you can actually read. Not linked
 * from anywhere and 404s outside development.
 */
'use client'

import React, { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import {
  renderOneTouchFront, renderOneTouchBack,
  renderToploaderFront, renderToploaderBack,
  renderFoldFront, renderFoldBack,
  renderOneTouchFoldSheet, renderFoldOverSheet,
  type HeritageCompactInputs,
} from '@/lib/labels/heritageCompact'

const DPI = 300

const SAMPLE: Omit<HeritageCompactInputs, 'qrDataUrl'> = {
  primaryName: 'Mickey Mouse - Steamboat Pilot',
  contextLine: 'FABLED • FOIL • #231 • 2025',
  contextShort: 'FABLED • FOIL',
  serial: '773571',
  grade: '9',
  condition: 'MINT',
  subgrades: { centering: 10, corners: 9, edges: 9, surface: 10 },
  bandColors: ['#C8A165', '#3F5E4A', '#8CC5C8', '#E8E2D4'],
  pattern: 'diamond',
  showFounderEmblem: false,
  showVipEmblem: true,
  showCardLoversEmblem: false,
}

type Panel = { label: string; url: string; widthIn: number }

export default function HeritageCompactProof() {
  if (process.env.NODE_ENV === 'production') notFound()
  const [panels, setPanels] = useState<Panel[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const qrDataUrl = await QRCode.toDataURL('https://dcmgrading.com/card/773571', {
          errorCorrectionLevel: 'H', margin: 0, width: 600,
        })
        const i: HeritageCompactInputs = { ...SAMPLE, qrDataUrl }
        const jobs: Array<[string, Promise<HTMLCanvasElement>, number]> = [
          ['One-Touch — front (2.375 × 0.625)', renderOneTouchFront(i, DPI), 2.375],
          ['One-Touch — back', renderOneTouchBack(i, DPI), 2.375],
          ['One-Touch — composed 6871 cell, back rotated 180 on top half', renderOneTouchFoldSheet(i, DPI), 2.375],
          ['Toploader — front (1.75 × 0.5)', renderToploaderFront(i, DPI), 1.75],
          ['Toploader — back', renderToploaderBack(i, DPI), 1.75],
          ['Fold-over — front half (0.5 × 0.875)', renderFoldFront(i, DPI), 0.5],
          ['Fold-over — back half', renderFoldBack(i, DPI), 0.5],
          ['Fold-over — composed 8167 cell, front 90CW left / back 90CCW right', renderFoldOverSheet(i, DPI), 1.75],
        ]
        const out: Panel[] = []
        for (const [label, p, widthIn] of jobs) {
          const c = await p
          out.push({ label, url: c.toDataURL('image/png'), widthIn })
        }
        if (!cancelled) setPanels(out)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e))
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <main style={{ padding: 32, background: '#6b7280', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Heritage Compact proof</h1>
      <p style={{ color: '#e5e7eb', fontSize: 13, marginBottom: 24 }}>
        Rendered at {DPI} dpi through the print path, shown at 4× physical size.
      </p>
      {error && <pre style={{ color: '#fecaca', background: '#7f1d1d', padding: 12 }}>{error}</pre>}
      {!panels.length && !error && <p style={{ color: '#fff' }}>Rendering…</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {panels.map((p) => (
          <div key={p.label}>
            <div style={{ color: '#f3f4f6', fontSize: 12, marginBottom: 6, letterSpacing: '.04em' }}>{p.label}</div>
            <img
              src={p.url}
              alt={p.label}
              style={{ width: p.widthIn * 4 * 96, display: 'block', boxShadow: '0 2px 10px rgba(0,0,0,.4)' }}
            />
          </div>
        ))}
      </div>
    </main>
  )
}
