'use client'

/**
 * COMIC LAB — admin-only sandbox for the comic grading engine (v0).
 * Upload cover photos, pick an era, grade, inspect the full result.
 * Nothing here touches user-facing production; history lives in localStorage.
 */

import { useEffect, useState } from 'react'

type Slot = 'front' | 'back' | 'spine' | 'pageEdge'
const SLOTS: Array<{ key: Slot; label: string; required: boolean; hint: string }> = [
  { key: 'front', label: 'Front cover', required: true, hint: 'Whole cover, fills the frame' },
  { key: 'back', label: 'Back cover', required: true, hint: 'Whole cover, fills the frame' },
  { key: 'spine', label: 'Spine close-up', required: false, hint: 'Strongly recommended — spine ticks decide 9.8 vs 9.4' },
  { key: 'pageEdge', label: 'Page-edge stack', required: false, hint: 'Angled shot of the page stack — enables page-quality estimate' },
]
const ERAS = ['modern', 'copper', 'bronze', 'silver', 'golden'] as const

interface HistoryEntry { at: string; era: string; grade: number; label: string; summary: string }

const CATEGORY_ORDER = ['spine', 'corners', 'edges', 'surface', 'wrap'] as const

function gradeColor(g: number): string {
  if (g >= 9.4) return 'text-emerald-600'
  if (g >= 8.0) return 'text-green-600'
  if (g >= 6.0) return 'text-yellow-600'
  if (g >= 4.0) return 'text-orange-600'
  return 'text-red-600'
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('failed to read file'))
    r.readAsDataURL(file)
  })
}

export default function ComicLabPage() {
  const [images, setImages] = useState<Partial<Record<Slot, string>>>({})
  const [era, setEra] = useState<(typeof ERAS)[number]>('modern')
  const [grading, setGrading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem('comic-lab-history') || '[]')) } catch { }
  }, [])

  const setSlot = async (slot: Slot, file: File | null) => {
    if (!file) return
    if (file.size > 12 * 1024 * 1024) { setError(`${slot}: file over 12MB`); return }
    setError(null)
    const dataUrl = await fileToDataUrl(file)
    setImages(prev => ({ ...prev, [slot]: dataUrl }))
  }

  const grade = async () => {
    if (!images.front || !images.back) { setError('Front and back covers are required.'); return }
    setGrading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/admin/comic-lab/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ era, front: images.front, back: images.back, spine: images.spine, pageEdge: images.pageEdge }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
      setResult(data)
      const entry: HistoryEntry = { at: new Date().toISOString(), era, grade: data.finalGrade, label: data.gradeLabel, summary: data.summary }
      const next = [entry, ...history].slice(0, 25)
      setHistory(next)
      localStorage.setItem('comic-lab-history', JSON.stringify(next))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGrading(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comic Lab</h1>
        <p className="text-sm text-gray-500 mt-1">
          Admin testing sandbox for the comic grading engine (v0 — Cover Grade). Results are not stored server-side and nothing here is visible to users.
        </p>
      </div>

      {/* Upload slots */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {SLOTS.map(s => (
          <label key={s.key} className={`border-2 border-dashed rounded-lg p-3 cursor-pointer hover:border-blue-400 transition-colors ${images[s.key] ? 'border-green-400 bg-green-50' : 'border-gray-300'}`}>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => setSlot(s.key, e.target.files?.[0] ?? null)} />
            <div className="text-sm font-medium text-gray-800">
              {s.label} {s.required ? <span className="text-red-500">*</span> : <span className="text-gray-400">(optional)</span>}
            </div>
            <div className="text-xs text-gray-500 mt-1">{s.hint}</div>
            {images[s.key] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[s.key]} alt={s.label} className="mt-2 h-32 w-full object-contain rounded" />
            ) : (
              <div className="mt-2 h-32 flex items-center justify-center text-gray-300 text-3xl">+</div>
            )}
          </label>
        ))}
      </div>

      {/* Era + grade button */}
      <div className="flex items-center gap-4 flex-wrap">
        <label className="text-sm font-medium text-gray-700">Era:</label>
        <select value={era} onChange={e => setEra(e.target.value as any)} className="border rounded px-3 py-2 text-sm">
          {ERAS.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
        </select>
        <button onClick={grade} disabled={grading || !images.front || !images.back}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium px-6 py-2 rounded-lg">
          {grading ? 'Grading… (60-120s)' : 'Grade this comic'}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {/* Result */}
      {result && result.ok && (
        <div className="border rounded-xl p-6 bg-white shadow-sm space-y-5">
          <div className="flex items-end gap-4 flex-wrap">
            <div className={`text-6xl font-black ${gradeColor(result.finalGrade)}`}>{result.finalGrade.toFixed(1)}</div>
            <div>
              <div className="text-xl font-semibold text-gray-800">{result.gradeLabel}</div>
              <div className="text-sm text-gray-500">
                {result.comicInfo?.title ?? 'Unknown title'}{result.comicInfo?.issue_number ? ` #${result.comicInfo.issue_number}` : ''} · page quality: <span className="font-medium">{result.pageQuality?.value ?? 'unknown'}</span> · {result.elapsedSec}s
              </div>
            </div>
          </div>

          <p className="text-gray-700">{result.summary}</p>

          {/* Category breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {CATEGORY_ORDER.map(cat => {
              const c = result.categories?.[cat]
              if (!c) return null
              return (
                <div key={cat} className="border rounded-lg p-3">
                  <div className="text-xs uppercase tracking-wide text-gray-400">{cat}</div>
                  <div className={`text-2xl font-bold ${gradeColor(c.score)}`}>{Number(c.score).toFixed(1)}</div>
                  <div className="text-xs text-gray-600 mt-1">{c.condition}</div>
                  {(c.defects ?? []).slice(0, 3).map((d: any, i: number) => (
                    <div key={i} className="text-xs text-red-600 mt-1">• {d.severity} {d.type}{d.location ? ` — ${d.location}` : ''}</div>
                  ))}
                </div>
              )
            })}
          </div>

          {/* Zoom + notes */}
          <div className="text-xs text-gray-500 space-y-1">
            <div className="font-medium text-gray-600">Engine notes ({result.engineVersion}):</div>
            {(result.consensusNotes ?? []).map((n: string, i: number) => <div key={i}>· {n}</div>)}
            {result.zoom?.findings?.length > 0 && (
              <div className="mt-2">
                <div className="font-medium text-gray-600">Magnified findings:</div>
                {result.zoom.findings.map((f: any, i: number) => (
                  <div key={i}>· [{f.region}] {f.type}{f.colorBreaking ? ' (color-breaking)' : ''} ({f.votes}/3 votes) — {f.description}</div>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setShowRaw(v => !v)} className="text-xs text-blue-600 underline">
            {showRaw ? 'Hide' : 'Show'} raw result JSON
          </button>
          {showRaw && (
            <pre className="text-xs bg-gray-50 border rounded p-3 overflow-x-auto max-h-96">{JSON.stringify(result, null, 2)}</pre>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="border rounded-xl p-4 bg-white shadow-sm">
          <div className="text-sm font-semibold text-gray-700 mb-2">Recent lab grades (local only)</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-400"><th className="py-1">When</th><th>Era</th><th>Grade</th><th>Summary</th></tr></thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1.5 text-gray-500 whitespace-nowrap">{new Date(h.at).toLocaleString()}</td>
                  <td className="text-gray-600">{h.era}</td>
                  <td className={`font-bold ${gradeColor(h.grade)}`}>{h.grade.toFixed(1)}</td>
                  <td className="text-gray-600 truncate max-w-md">{h.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
