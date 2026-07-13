'use client'

/** COMIC LAB — comic details page (admin-only). Mirrors the card details layout
 *  in miniature, plus the anchor workflow: record your expected grade so lab
 *  results can be compared against ground truth like the card calibration set. */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

const CATEGORY_ORDER = ['spine', 'corners', 'edges', 'surface', 'wrap'] as const

function gradeColor(g: number): string {
  if (g >= 9.4) return 'text-emerald-600'
  if (g >= 8.0) return 'text-green-600'
  if (g >= 6.0) return 'text-yellow-600'
  if (g >= 4.0) return 'text-orange-600'
  return 'text-red-600'
}

export default function ComicLabDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [comic, setComic] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [expected, setExpected] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/comic-lab/comics/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setComic(d.comic)
        setExpected(d.comic.expected_grade != null ? String(d.comic.expected_grade) : '')
        setNotes(d.comic.operator_notes ?? '')
      })
      .catch(e => setError(e.message))
  }, [id])

  const saveAnchor = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/comic-lab/comics/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expected_grade: expected === '' ? null : Number(expected), operator_notes: notes }),
      })
      const d = await res.json()
      if (d.error) throw new Error(d.error)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const del = async () => {
    if (!confirm('Delete this lab comic and its images?')) return
    const res = await fetch(`/api/admin/comic-lab/comics/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/admin/comic-lab')
  }

  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>
  if (!comic) return <div className="p-6 text-sm text-gray-400">Loading…</div>

  const g = comic.grading_json ?? {}
  const delta = comic.expected_grade != null ? Number(comic.final_grade) - Number(comic.expected_grade) : null

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <a href="/admin/comic-lab" className="text-sm text-blue-600 underline">← Comic Lab</a>
        <button onClick={del} className="text-sm text-red-500 hover:text-red-700">Delete</button>
      </div>

      {/* Grade hero */}
      <div className="flex items-end gap-4 flex-wrap">
        <div className={`text-6xl font-black ${gradeColor(Number(comic.final_grade))}`}>{Number(comic.final_grade).toFixed(1)}</div>
        <div>
          <div className="text-xl font-semibold text-gray-800">{comic.grade_label}</div>
          <div className="text-sm text-gray-500">
            {comic.title ?? 'Unknown title'}{comic.issue_number ? ` #${comic.issue_number}` : ''}{comic.publisher ? ` · ${comic.publisher}` : ''} · {comic.era} · pages: {comic.page_quality ?? 'unknown'} · {comic.engine_version}
          </div>
          {delta != null && (
            <div className={`text-sm font-medium ${Math.abs(delta) <= 0.45 ? 'text-emerald-600' : 'text-amber-600'}`}>
              vs your expected {Number(comic.expected_grade).toFixed(1)}: {delta > 0 ? '+' : ''}{delta.toFixed(1)}
            </div>
          )}
        </div>
      </div>

      <p className="text-gray-700">{comic.summary}</p>

      {/* Images */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[['Front', comic.front_url], ['Back', comic.back_url], ['Spine', comic.spine_url], ['Page edge', comic.page_edge_url]]
          .filter(([, url]) => url)
          .map(([label, url]) => (
            <a key={label as string} href={url as string} target="_blank" rel="noreferrer" className="block border rounded-lg overflow-hidden bg-white shadow-sm">
              <div className="text-xs text-gray-500 px-2 py-1 border-b">{label}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url as string} alt={label as string} className="w-full h-56 object-contain bg-gray-50" />
            </a>
          ))}
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {CATEGORY_ORDER.map(cat => {
          const c = g.categories?.[cat]
          if (!c) return null
          return (
            <div key={cat} className="border rounded-lg p-3 bg-white">
              <div className="text-xs uppercase tracking-wide text-gray-400">{cat}</div>
              <div className={`text-2xl font-bold ${gradeColor(Number(c.score))}`}>{Number(c.score).toFixed(1)}</div>
              <div className="text-xs text-gray-600 mt-1">{c.condition}</div>
              {(c.defects ?? []).slice(0, 4).map((d: any, i: number) => (
                <div key={i} className="text-xs text-red-600 mt-1">• {d.severity} {d.type}{d.location ? ` — ${d.location}` : ''}</div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Engine notes + zoom findings */}
      <div className="text-xs text-gray-500 space-y-1 bg-white border rounded-lg p-4">
        <div className="font-medium text-gray-600">Engine notes:</div>
        {(g.consensusNotes ?? []).map((n: string, i: number) => <div key={i}>· {n}</div>)}
        {g.zoom?.findings?.length > 0 && <>
          <div className="font-medium text-gray-600 mt-2">Magnified findings:</div>
          {g.zoom.findings.map((f: any, i: number) => (
            <div key={i}>· [{f.region}] {f.type}{f.colorBreaking ? ' (color-breaking)' : ''} ({f.votes} votes) — {f.description}</div>
          ))}
        </>}
      </div>

      {/* Anchor workflow */}
      <div className="border rounded-lg p-4 bg-white space-y-3">
        <div className="text-sm font-semibold text-gray-700">Anchor workflow — your ground truth for calibration</div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm text-gray-600">Your expected grade:</label>
          <input value={expected} onChange={e => setExpected(e.target.value)} placeholder="e.g. 9.4"
            className="border rounded px-3 py-1.5 text-sm w-24" />
          <button onClick={saveAnchor} disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm px-4 py-1.5 rounded">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes: what the engine got right/wrong (invented defects, missed ticks, wrong locations)…"
          className="border rounded w-full px-3 py-2 text-sm h-20" />
      </div>

      <button onClick={() => setShowRaw(v => !v)} className="text-xs text-blue-600 underline">
        {showRaw ? 'Hide' : 'Show'} raw grading JSON
      </button>
      {showRaw && <pre className="text-xs bg-gray-50 border rounded p-3 overflow-x-auto max-h-96">{JSON.stringify(g, null, 2)}</pre>}
    </div>
  )
}
