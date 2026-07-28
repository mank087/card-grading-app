'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Player } from '@remotion/player'
import { ComposerScene, sceneDurationInFrames } from '@/lib/slabby/ComposerScene'
import {
  BG_ANIMATIONS,
  DEFAULT_BEAT,
  EXPRESSIONS,
  MOTIONS,
  SlabbyBeat,
  SlabbyScene,
  sanitizeDataUrl,
  sanitizeScene,
} from '@/lib/slabby/types'
import { BUILTIN_TEMPLATES } from '@/lib/slabby/templates'

const VOICES = ['ash', 'nova', 'onyx', 'alloy', 'shimmer', 'fable'] as const
const RENDER_SERVER = 'http://127.0.0.1:7799'
const TEMPLATE_STORE_KEY = 'slabby_lab_templates_v1'

const FPS = 30
const STORAGE_KEY = 'slabby_lab_scene_v1'
// localStorage quota is ~5MB — past this we keep working but stop autosaving.
const AUTOSAVE_LIMIT_BYTES = 4_500_000

/**
 * Read an image file/blob, downscale to ≤1600px long edge, and return a JPEG
 * data URL. Embedding as a data URL keeps the scene JSON fully self-contained:
 * the same file previews in the Player AND renders in the slabby/ workspace
 * with no image hosting step.
 */
const imageToDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1600
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no canvas context')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('could not read image')) }
    img.src = url
  })

const ASPECTS = [
  { key: 'shorts', label: 'Shorts / Reels (9:16)', width: 1080, height: 1920 },
  { key: 'square', label: 'Square (1:1)', width: 1080, height: 1080 },
  { key: 'wide', label: 'YouTube (16:9)', width: 1920, height: 1080 },
] as const

const STARTER_SCENE: SlabbyScene = {
  name: 'my-scene',
  beats: [
    { ...DEFAULT_BEAT, duration: 2.5, motion: 'enter', expression: 'happy', caption: "Hi, I'm Slabby!" },
    { ...DEFAULT_BEAT, duration: 3, motion: 'wave', expression: 'wink', caption: 'Welcome to DCM Grading' },
  ],
}

export default function SlabbyLabClient() {
  const [scene, setScene] = useState<SlabbyScene>(STARTER_SCENE)
  const [aspectKey, setAspectKey] = useState<(typeof ASPECTS)[number]['key']>('shorts')
  const [selectedBeat, setSelectedBeat] = useState(0)
  const [copied, setCopied] = useState(false)

  // hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.beats?.length) setScene(parsed)
      }
    } catch { /* keep starter */ }
  }, [])

  // autosave (skipped when embedded images push the scene past the quota —
  // the UI shows a hint so work isn't silently at risk)
  const [autosaveSkipped, setAutosaveSkipped] = useState(false)
  useEffect(() => {
    try {
      const json = JSON.stringify(scene)
      if (json.length > AUTOSAVE_LIMIT_BYTES) {
        setAutosaveSkipped(true)
        return
      }
      localStorage.setItem(STORAGE_KEY, json)
      setAutosaveSkipped(false)
    } catch { setAutosaveSkipped(true) }
  }, [scene])

  const aspect = ASPECTS.find((a) => a.key === aspectKey)!
  const durationInFrames = useMemo(() => sceneDurationInFrames(scene, FPS), [scene])
  const totalSeconds = (durationInFrames / FPS).toFixed(1)

  const updateBeat = useCallback((index: number, patch: Partial<SlabbyBeat>) => {
    setScene((prev) => ({
      ...prev,
      beats: prev.beats.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }))
  }, [])

  const addBeat = () => {
    setScene((prev) => ({ ...prev, beats: [...prev.beats, { ...DEFAULT_BEAT }] }))
    setSelectedBeat(scene.beats.length)
  }

  const removeBeat = (index: number) => {
    if (scene.beats.length <= 1) return
    setScene((prev) => ({ ...prev, beats: prev.beats.filter((_, i) => i !== index) }))
    setSelectedBeat((s) => Math.max(0, Math.min(s, scene.beats.length - 2)))
  }

  const moveBeat = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= scene.beats.length) return
    setScene((prev) => {
      const beats = [...prev.beats]
      ;[beats[index], beats[target]] = [beats[target], beats[index]]
      return { ...prev, beats }
    })
    setSelectedBeat(target)
  }

  const downloadScene = () => {
    const blob = new Blob([JSON.stringify({ scene }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${scene.name || 'slabby-scene'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadSceneFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        const loaded = parsed.scene || parsed
        if (loaded?.beats?.length) {
          setScene(loaded)
          setSelectedBeat(0)
        }
      } catch { alert('Could not parse that scene file.') }
    }
    reader.readAsText(file)
  }

  const renderCommand = `npx remotion render src/index.ts composer-${aspectKey} out/${scene.name || 'scene'}.mp4 --props=scenes/${scene.name || 'scene'}.json`

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(renderCommand)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  const beat = scene.beats[Math.min(selectedBeat, scene.beats.length - 1)]

  const setBeatImage = useCallback(async (file: Blob) => {
    try {
      const dataUrl = await imageToDataUrl(file)
      updateBeat(selectedBeat, { backgroundImage: dataUrl, bgAnimation: beat?.bgAnimation || 'pop' })
    } catch {
      alert('Could not read that image — try a PNG/JPG file.')
    }
  }, [selectedBeat, updateBeat, beat?.bgAnimation])

  // ---- graded-card mockup loader ----
  const [cardQuery, setCardQuery] = useState('')
  const [cardLoading, setCardLoading] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)

  // ---- card picker (browse own DB) ----
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerResults, setPickerResults] = useState<any[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)

  const searchCards = useCallback(async (q: string) => {
    setPickerLoading(true)
    try {
      const res = await fetch(`/api/admin/slabby/card-search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      setPickerResults(json.results || [])
    } catch { setPickerResults([]) } finally { setPickerLoading(false) }
  }, [])

  // ---- voiceover ----
  const [voice, setVoice] = useState<(typeof VOICES)[number]>('ash')
  const [voGenerating, setVoGenerating] = useState(false)
  const [voError, setVoError] = useState<string | null>(null)

  const generateVoiceover = useCallback(async () => {
    const text = scene.beats[selectedBeat]?.voiceover?.trim()
    if (!text) return
    setVoGenerating(true)
    setVoError(null)
    try {
      const res = await fetch('/api/admin/slabby/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'TTS failed')
      // measure duration in the browser, then store both
      const audioEl = new window.Audio(json.audio)
      await new Promise<void>((resolve, reject) => {
        audioEl.onloadedmetadata = () => resolve()
        audioEl.onerror = () => reject(new Error('Could not decode audio'))
      })
      updateBeat(selectedBeat, {
        voiceoverAudio: json.audio,
        voiceoverDuration: Math.round(audioEl.duration * 10) / 10,
      })
    } catch (e: any) {
      setVoError(e.message)
    } finally {
      setVoGenerating(false)
    }
  }, [scene.beats, selectedBeat, voice, updateBeat])

  // ---- record your own voiceover ----
  // Writes to the same voiceoverAudio/voiceoverDuration slots as TTS, so
  // preview and render need no special handling. Beat duration auto-fits the
  // take: a human reads slower than TTS, and clipping a line is worse than a
  // slightly long beat.
  const [recording, setRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const [transcribing, setTranscribing] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recTimerRef = useRef<NodeJS.Timeout | null>(null)

  const stopTracks = (rec: MediaRecorder | null) => {
    rec?.stream.getTracks().forEach((t) => t.stop())
  }

  const startRecording = useCallback(async () => {
    setVoError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      // webm/opus everywhere except Safari, which gives mp4 — both decode in
      // the Remotion (Chrome) renderer.
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((m) => MediaRecorder.isTypeSupported(m)) || ''
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stopTracks(rec)
        if (recTimerRef.current) clearInterval(recTimerRef.current)
        // Drop codec parameters from the MIME type. MediaRecorder yields
        // 'audio/webm;codecs=opus', and FileReader bakes that straight into
        // the data URL — but Remotion's parser expects exactly
        // `data:[mime];base64,…` and reads ';codecs=opus' as the encoding,
        // failing the render with "did not have the correct format".
        // The bytes are unchanged; only the label is simplified.
        const rawType = rec.mimeType || 'audio/webm'
        const cleanType = rawType.split(';')[0].trim() || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: cleanType })
        if (!blob.size) { setVoError('Nothing was recorded'); return }
        const dataUrl: string = await new Promise((resolve, reject) => {
          const fr = new FileReader()
          fr.onload = () => resolve(sanitizeDataUrl(String(fr.result)))
          fr.onerror = () => reject(new Error('Could not read the recording'))
          fr.readAsDataURL(blob)
        })
        // MediaRecorder blobs often report Infinity for duration until seeked;
        // nudge past the end to force the real value out of the element.
        const el = new window.Audio(dataUrl)
        const dur = await new Promise<number>((resolve) => {
          const done = (d: number) => resolve(Number.isFinite(d) && d > 0 ? d : 0)
          el.onloadedmetadata = () => {
            if (Number.isFinite(el.duration) && el.duration > 0) return done(el.duration)
            el.currentTime = 1e101
            el.ontimeupdate = () => { el.ontimeupdate = null; el.currentTime = 0; done(el.duration) }
          }
          el.onerror = () => done(0)
          setTimeout(() => done(el.duration), 4000)
        })
        const seconds = dur > 0 ? Math.round(dur * 10) / 10 : recSeconds
        updateBeat(selectedBeat, {
          voiceoverAudio: dataUrl,
          voiceoverDuration: seconds,
          // fit the beat to the take (+0.4s so the last word isn't clipped)
          duration: Math.max(0.5, Math.round((seconds + 0.4) * 100) / 100),
          // any previous word timings belong to the old audio
          voiceoverWords: undefined,
        })
      }
      rec.start()
      recorderRef.current = rec
      setRecording(true)
      setRecSeconds(0)
      recTimerRef.current = setInterval(() => setRecSeconds((s) => Math.round((s + 0.1) * 10) / 10), 100)
    } catch (e: any) {
      setVoError(
        e?.name === 'NotAllowedError'
          ? 'Microphone blocked — allow access in the browser address bar and try again.'
          : e?.message || 'Could not start recording'
      )
    }
  }, [selectedBeat, updateBeat, recSeconds])

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
    if (recTimerRef.current) clearInterval(recTimerRef.current)
  }, [])

  // Never leave the mic light on if the Lab unmounts mid-take
  useEffect(() => () => {
    if (recorderRef.current) { try { recorderRef.current.stop() } catch {} stopTracks(recorderRef.current) }
    if (recTimerRef.current) clearInterval(recTimerRef.current)
  }, [])

  /** Transcribe the beat's audio → real per-word timings for karaoke. */
  const syncKaraoke = useCallback(async () => {
    const audio = scene.beats[selectedBeat]?.voiceoverAudio
    if (!audio) return
    setTranscribing(true)
    setVoError(null)
    try {
      const res = await fetch('/api/admin/slabby/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Transcription failed')
      if (!json.words?.length) throw new Error('No speech detected in this take')
      const current = scene.beats[selectedBeat]?.voiceover?.trim()
      updateBeat(selectedBeat, {
        voiceoverWords: json.words,
        karaoke: true,
        // adopt the transcript when the beat has no script yet (ad-libbed take)
        ...(current ? {} : { voiceover: json.text }),
      })
    } catch (e: any) {
      setVoError(e.message)
    } finally {
      setTranscribing(false)
    }
  }, [scene.beats, selectedBeat, updateBeat])

  // ---- templates ----
  const [savedTemplates, setSavedTemplates] = useState<{ name: string; scene: SlabbyScene }[]>([])
  useEffect(() => {
    try { setSavedTemplates(JSON.parse(localStorage.getItem(TEMPLATE_STORE_KEY) || '[]')) } catch { /* none */ }
  }, [])
  const applyTemplate = (tplScene: SlabbyScene) => {
    setScene(JSON.parse(JSON.stringify(tplScene)))
    setSelectedBeat(0)
  }
  const saveAsTemplate = () => {
    const name = prompt('Template name?', scene.name)
    if (!name) return
    const next = [...savedTemplates.filter((t) => t.name !== name), { name, scene: JSON.parse(JSON.stringify({ ...scene, name })) }]
    setSavedTemplates(next)
    try { localStorage.setItem(TEMPLATE_STORE_KEY, JSON.stringify(next)) } catch { alert('Template too large to store in the browser — download the scene JSON instead.') }
  }

  // ---- cloud drafts (Supabase storage via admin API) ----
  const [drafts, setDrafts] = useState<{ name: string; updated_at: string; size_bytes: number | null }[]>([])
  const [draftBusy, setDraftBusy] = useState<string | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)

  const refreshDrafts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/slabby/drafts')
      const json = await res.json()
      if (res.ok) setDrafts(json.drafts || [])
    } catch { /* leave list as-is */ }
  }, [])

  useEffect(() => { void refreshDrafts() }, [refreshDrafts])

  const saveDraft = useCallback(async () => {
    setDraftBusy('save')
    setDraftError(null)
    try {
      const res = await fetch('/api/admin/slabby/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: scene.name }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not save draft')
      const put = await fetch(json.url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-upsert': 'true' },
        body: JSON.stringify({ scene }),
      })
      if (!put.ok) throw new Error(`Upload failed (${put.status})`)
      await refreshDrafts()
    } catch (e: any) {
      setDraftError(e.message)
    } finally {
      setDraftBusy(null)
    }
  }, [scene, refreshDrafts])

  const loadDraft = useCallback(async (name: string) => {
    setDraftBusy(`load-${name}`)
    setDraftError(null)
    try {
      const res = await fetch(`/api/admin/slabby/drafts?name=${encodeURIComponent(name)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not load draft')
      const file = await fetch(json.url).then((r) => r.json())
      const loaded = file.scene || file
      if (!loaded?.beats?.length) throw new Error('Draft file is not a valid scene')
      // Repair any data URLs carrying MIME parameters (older recordings saved
      // as `audio/webm;codecs=opus`, which fails the render).
      setScene(sanitizeScene(loaded))
      setSelectedBeat(0)
    } catch (e: any) {
      setDraftError(e.message)
    } finally {
      setDraftBusy(null)
    }
  }, [])

  const deleteDraft = useCallback(async (name: string) => {
    if (!confirm(`Delete draft "${name}"?`)) return
    setDraftBusy(`del-${name}`)
    try {
      await fetch(`/api/admin/slabby/drafts?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
      await refreshDrafts()
    } finally {
      setDraftBusy(null)
    }
  }, [refreshDrafts])

  // ---- one-click render (local render server) ----
  const [renderState, setRenderState] = useState<'idle' | 'rendering' | 'done' | 'offline' | 'error'>('idle')
  const [renderInfo, setRenderInfo] = useState('')

  const renderNow = useCallback(async () => {
    setRenderState('rendering')
    setRenderInfo('')
    try {
      const health = await fetch(`${RENDER_SERVER}/health`).then((r) => r.json()).catch(() => null)
      if (!health?.ok) {
        setRenderState('offline')
        return
      }
      const res = await fetch(`${RENDER_SERVER}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene, preset: aspectKey }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Render failed')
      setRenderState('done')
      setRenderInfo(json.output)
    } catch (e: any) {
      setRenderState('error')
      setRenderInfo(e.message)
    }
  }, [scene, aspectKey])

  const loadGradedCard = useCallback(async (target: 'slab' | 'page') => {
    if (!cardQuery.trim()) return
    setCardLoading(true)
    setCardError(null)
    try {
      const res = await fetch(`/api/admin/slabby/card-lookup?q=${encodeURIComponent(cardQuery.trim())}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Lookup failed')
      updateBeat(selectedBeat, {
        slabCard: target === 'slab' ? json.card : undefined,
        detailsPage: target === 'page' ? json.card : undefined,
        backgroundImage: undefined,
        bgAnimation: target === 'page' ? 'fade' : (beat?.bgAnimation || 'pop'),
      })
      setCardQuery('')
    } catch (e: any) {
      setCardError(e.message)
    } finally {
      setCardLoading(false)
    }
  }, [cardQuery, selectedBeat, updateBeat, beat?.bgAnimation])

  const onPasteImage = useCallback((e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
    const file = item?.getAsFile()
    if (file) {
      e.preventDefault()
      void setBeatImage(file)
    }
  }, [setBeatImage])

  const inputCls = 'w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white'
  const labelCls = 'block text-xs font-semibold text-gray-600 mt-3 mb-1'

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🎬 Slabby Lab</h1>
        <p className="text-sm text-gray-600 mt-1">
          Compose Slabby scenes beat by beat, preview live, then export for video rendering.
          Add voiceover and music afterward in your editor.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ---- Preview ---- */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow p-4 sticky top-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-800">Preview</span>
              <select
                value={aspectKey}
                onChange={(e) => setAspectKey(e.target.value as typeof aspectKey)}
                className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
              >
                {ASPECTS.map((a) => (
                  <option key={a.key} value={a.key}>{a.label}</option>
                ))}
              </select>
            </div>
            <div className="rounded-lg overflow-hidden bg-black" style={{ aspectRatio: `${aspect.width} / ${aspect.height}`, maxHeight: 560, margin: '0 auto' }}>
              <Player
                component={ComposerScene}
                inputProps={{ scene }}
                durationInFrames={durationInFrames}
                fps={FPS}
                compositionWidth={aspect.width}
                compositionHeight={aspect.height}
                controls
                loop
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-2 text-center">
              {scene.beats.length} beat{scene.beats.length === 1 ? '' : 's'} · {totalSeconds}s total
            </div>
            {autosaveSkipped && (
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mt-2 text-center">
                ⚠️ Scene too large for browser autosave (embedded images) — use <b>Download scene JSON</b> to keep your work.
              </div>
            )}

            {/* export */}
            <div className="mt-4 border-t border-gray-100 pt-4 space-y-2">
              <button
                onClick={renderNow}
                disabled={renderState === 'rendering'}
                className="w-full px-3 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg text-sm font-bold"
              >
                {renderState === 'rendering' ? '⏳ Rendering… (1-5 min, keep this tab open)' : `🎬 Render MP4 (${aspectKey})`}
              </button>
              {renderState === 'offline' && (
                <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                  Render server not running. In a terminal: <code className="font-mono">cd slabby && npm run serve</code> — then click Render again.
                </div>
              )}
              {renderState === 'done' && (
                <div className="text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1.5 break-all">
                  ✅ Rendered → {renderInfo}
                </div>
              )}
              {renderState === 'error' && (
                <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 break-all">
                  ❌ {renderInfo}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={downloadScene} className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold">
                  ⬇ Download scene JSON
                </button>
                <label className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-semibold text-center cursor-pointer">
                  ⬆ Load scene
                  <input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && loadSceneFile(e.target.files[0])} />
                </label>
              </div>
              {/* cloud drafts */}
              <div className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-700">💾 Drafts (saved to cloud)</span>
                  <button
                    onClick={saveDraft}
                    disabled={draftBusy === 'save'}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-lg text-xs font-semibold"
                  >
                    {draftBusy === 'save' ? 'Saving…' : `Save "${scene.name}"`}
                  </button>
                </div>
                {draftError && <div className="text-[11px] text-red-600 mb-1">{draftError}</div>}
                {drafts.length === 0 ? (
                  <div className="text-[11px] text-gray-400">No drafts yet — Save stores the whole scene (voices and images included) under its name.</div>
                ) : (
                  <div className="space-y-1 max-h-44 overflow-y-auto">
                    {drafts.map((d) => (
                      <div key={d.name} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-gray-800 truncate block">{d.name}</span>
                          <span className="text-[10px] text-gray-400">
                            {d.updated_at ? new Date(d.updated_at).toLocaleString() : ''}
                            {d.size_bytes ? ` · ${(d.size_bytes / 1024 / 1024).toFixed(1)}MB` : ''}
                          </span>
                        </div>
                        <button
                          onClick={() => loadDraft(d.name)}
                          disabled={draftBusy === `load-${d.name}`}
                          className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 font-semibold shrink-0"
                        >
                          {draftBusy === `load-${d.name}` ? '…' : 'Load'}
                        </button>
                        <button
                          onClick={() => deleteDraft(d.name)}
                          disabled={draftBusy === `del-${d.name}`}
                          className="px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-[10px] text-gray-400 mb-1">
                  To render: save the JSON into <code className="text-purple-300">slabby/scenes/</code>, then run in <code className="text-purple-300">slabby/</code>:
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-[11px] text-green-300 break-all flex-1">{renderCommand}</code>
                  <button onClick={copyCommand} className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded shrink-0">
                    {copied ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---- Beat editor ---- */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-800">Scene</span>
              <input
                value={scene.name}
                onChange={(e) => setScene((p) => ({ ...p, name: e.target.value.replace(/[^a-z0-9-_]/gi, '-').toLowerCase() }))}
                className="px-2 py-1 border border-gray-300 rounded-lg text-sm w-48"
                placeholder="scene-name"
              />
            </div>

            {/* templates */}
            <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-600">Templates:</span>
              {BUILTIN_TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => applyTemplate(t.scene)}
                  title={t.description}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                >
                  {t.name}
                </button>
              ))}
              {savedTemplates.map((t) => (
                <button
                  key={`saved-${t.name}`}
                  onClick={() => applyTemplate(t.scene)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
                >
                  ⭐ {t.name}
                </button>
              ))}
              <button onClick={saveAsTemplate} className="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-500 border border-dashed border-gray-300 hover:bg-gray-50">
                + Save current
              </button>
            </div>

            {/* beat timeline */}
            <div className="flex flex-wrap gap-2 mb-4">
              {scene.beats.map((b, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedBeat(i)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border ${i === selectedBeat ? 'bg-purple-600 text-white border-purple-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                >
                  {i + 1}. {b.expression} · {b.motion} · {b.duration}s
                </button>
              ))}
              <button onClick={addBeat} className="px-3 py-2 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-700 text-white">
                + Add beat
              </button>
            </div>

            {/* selected beat */}
            {beat && (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-gray-800">Beat {selectedBeat + 1}</span>
                  <div className="flex gap-1">
                    <button onClick={() => moveBeat(selectedBeat, -1)} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">←</button>
                    <button onClick={() => moveBeat(selectedBeat, 1)} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">→</button>
                    <button onClick={() => removeBeat(selectedBeat)} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100">Delete</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4">
                  <div>
                    <label className={labelCls}>Expression</label>
                    <select value={beat.expression} onChange={(e) => updateBeat(selectedBeat, { expression: e.target.value as SlabbyBeat['expression'] })} className={inputCls}>
                      {EXPRESSIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Motion</label>
                    <select value={beat.motion} onChange={(e) => updateBeat(selectedBeat, { motion: e.target.value as SlabbyBeat['motion'] })} className={inputCls}>
                      {MOTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Duration (s)</label>
                    <input type="number" min={0.5} max={30} step={0.5} value={beat.duration} onChange={(e) => updateBeat(selectedBeat, { duration: Math.max(0.5, Number(e.target.value) || 1) })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Grade badge</label>
                    <input value={beat.gradeText || ''} onChange={(e) => updateBeat(selectedBeat, { gradeText: e.target.value })} className={inputCls} placeholder="10, ?, 6…" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Grade label</label>
                    <input value={beat.gradeLabel || ''} onChange={(e) => updateBeat(selectedBeat, { gradeLabel: e.target.value })} className={inputCls} placeholder="GEM MINT, GRADING…, EX-MINT" />
                  </div>
                </div>

                <label className={labelCls}>Headline (top text)</label>
                <input value={beat.headline || ''} onChange={(e) => updateBeat(selectedBeat, { headline: e.target.value })} className={inputCls} placeholder="e.g. TODAY'S TOP GRADE" />

                <label className={labelCls}>Caption (bottom text)</label>
                <input value={beat.caption || ''} onChange={(e) => updateBeat(selectedBeat, { caption: e.target.value })} className={inputCls} placeholder="e.g. This Charizard is INSANE" />

                <label className={labelCls}>💬 Speech bubble (spoken by Slabby, on screen)</label>
                <input value={beat.speechBubble || ''} onChange={(e) => updateBeat(selectedBeat, { speechBubble: e.target.value || undefined })} className={inputCls} placeholder="e.g. No way that's a 10…" />

                {/* voiceover */}
                <label className={labelCls}>🎙️ Voiceover script</label>
                <textarea
                  value={beat.voiceover || ''}
                  onChange={(e) => updateBeat(selectedBeat, { voiceover: e.target.value })}
                  className={`${inputCls} resize-none`}
                  rows={2}
                  placeholder="What Slabby says during this beat…"
                />
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <select value={voice} onChange={(e) => setVoice(e.target.value as typeof voice)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white">
                    {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <button
                    onClick={generateVoiceover}
                    disabled={voGenerating || !beat.voiceover?.trim()}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                  >
                    {voGenerating ? 'Generating…' : beat.voiceoverAudio ? '🔁 Re-generate voice' : '🎙️ Generate voice'}
                  </button>
                  {/* record your own voice — beat auto-fits the take */}
                  {recording ? (
                    <button
                      onClick={stopRecording}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold animate-pulse"
                    >
                      ⏹ Stop · {recSeconds.toFixed(1)}s
                    </button>
                  ) : (
                    <button
                      onClick={startRecording}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
                      title="Record this line in your own voice"
                    >
                      {beat.voiceoverAudio ? '🔴 Re-record' : '🔴 Record my voice'}
                    </button>
                  )}
                  {beat.voiceoverAudio && (
                    <>
                      <span className="text-[11px] text-green-700 font-semibold">✓ {beat.voiceoverDuration}s audio</span>
                      <button
                        onClick={() => new window.Audio(beat.voiceoverAudio!).play()}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 font-semibold"
                      >
                        ▶ Play
                      </button>
                      <button
                        onClick={() => updateBeat(selectedBeat, { duration: Math.max(0.5, Math.round(((beat.voiceoverDuration || 1) + 0.4) * 100) / 100) })}
                        className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 font-semibold"
                      >
                        ⏱ Fit beat to audio
                      </button>
                      <button
                        onClick={syncKaraoke}
                        disabled={transcribing}
                        className="px-2 py-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 font-semibold"
                        title="Transcribe this take so karaoke captions land on the word actually being spoken"
                      >
                        {transcribing ? 'Syncing…' : beat.voiceoverWords?.length ? `🎯 Re-sync (${beat.voiceoverWords.length}w)` : '🎯 Sync karaoke to audio'}
                      </button>
                      <button
                        onClick={() => updateBeat(selectedBeat, { voiceoverAudio: undefined, voiceoverDuration: undefined, voiceoverWords: undefined })}
                        className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                      >
                        Clear audio
                      </button>
                    </>
                  )}
                  <label className="flex items-center gap-1 text-xs text-gray-600 ml-auto">
                    <input type="checkbox" checked={beat.karaoke || false} onChange={(e) => updateBeat(selectedBeat, { karaoke: e.target.checked })} />
                    Karaoke captions
                  </label>
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input type="checkbox" checked={beat.sfx !== false} onChange={(e) => updateBeat(selectedBeat, { sfx: e.target.checked ? undefined : false })} />
                    SFX
                  </label>
                </div>
                {voError && <div className="text-[11px] text-red-600 mt-1">{voError}</div>}

                <label className={labelCls}>🎴 Graded card (real label data + image, like Label Studio)</label>
                {beat.slabCard || beat.detailsPage ? (
                  (() => {
                    const loaded = (beat.slabCard || beat.detailsPage)!
                    const mode = beat.slabCard ? 'Slab mockup' : 'Scrolling details page'
                    return (
                      <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={loaded.image} alt="card" className="h-14 w-11 object-cover rounded border border-purple-200" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-gray-800 truncate">{loaded.name} <span className="font-normal text-purple-500">· {mode}</span></div>
                          <div className="text-[10px] text-gray-500 truncate">{loaded.contextLine}</div>
                          <div className="text-[10px] font-semibold text-purple-700">
                            {loaded.gradeFormatted} {loaded.condition} · #{loaded.serial}
                          </div>
                        </div>
                        <button
                          onClick={() => updateBeat(selectedBeat, { slabCard: undefined, detailsPage: undefined })}
                          className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    )
                  })()
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        value={cardQuery}
                        onChange={(e) => setCardQuery(e.target.value)}
                        className={inputCls}
                        placeholder="Paste a card details URL, image URL, card id, or serial…"
                      />
                      <button
                        onClick={() => { setPickerOpen(!pickerOpen); if (!pickerOpen && pickerResults.length === 0) void searchCards('') }}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-semibold shrink-0"
                      >
                        🔍 Browse
                      </button>
                    </div>
                    {pickerOpen && (
                      <div className="mt-2 border border-gray-200 rounded-lg p-2 bg-gray-50">
                        <input
                          value={pickerQuery}
                          onChange={(e) => { setPickerQuery(e.target.value); void searchCards(e.target.value) }}
                          className={inputCls}
                          placeholder="Search by card name or serial (empty = most recent)…"
                        />
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 mt-2 max-h-56 overflow-y-auto">
                          {pickerLoading && <div className="text-xs text-gray-500 col-span-3 p-2">Searching…</div>}
                          {!pickerLoading && pickerResults.length === 0 && <div className="text-xs text-gray-500 col-span-3 p-2">No graded cards found.</div>}
                          {pickerResults.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => { setCardQuery(r.id); setPickerOpen(false) }}
                              className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-gray-200 hover:border-purple-400 text-left"
                            >
                              {r.thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={r.thumb} alt="" className="h-10 w-8 object-cover rounded shrink-0" />
                              ) : <div className="h-10 w-8 bg-gray-100 rounded shrink-0" />}
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold text-gray-800 truncate">{r.name}</div>
                                <div className="text-[10px] text-purple-700 font-bold">{r.grade} {r.condition || ''}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">Click a card to fill the box above, then choose slab or scrolling page.</div>
                      </div>
                    )}
                    <div className="flex gap-2 mt-1.5">
                      <button
                        onClick={() => loadGradedCard('slab')}
                        disabled={cardLoading || !cardQuery.trim()}
                        className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                      >
                        {cardLoading ? 'Loading…' : '🎴 Load as slab mockup'}
                      </button>
                      <button
                        onClick={() => loadGradedCard('page')}
                        disabled={cardLoading || !cardQuery.trim()}
                        className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                      >
                        {cardLoading ? 'Loading…' : '📱 Load as scrolling page'}
                      </button>
                    </div>
                    {cardError && <div className="text-[11px] text-red-600 mt-1">{cardError}</div>}
                  </div>
                )}

                {beat.detailsPage && (
                  <div className="grid grid-cols-3 gap-x-4">
                    <div>
                      <label className={labelCls}>Scroll speed</label>
                      <select
                        value={beat.scrollSpeed ?? 1}
                        onChange={(e) => updateBeat(selectedBeat, { scrollSpeed: Number(e.target.value) as 1 | 2 | 4 })}
                        className={inputCls}
                      >
                        <option value={1}>Standard</option>
                        <option value={2}>Double (2×)</option>
                        <option value={4}>4×</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Scroll from (%)</label>
                      <input
                        type="number" min={0} max={100} step={5}
                        value={Math.round((beat.scrollFrom ?? 0) * 100)}
                        onChange={(e) => updateBeat(selectedBeat, { scrollFrom: Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100 })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Scroll to (%)</label>
                      <input
                        type="number" min={0} max={100} step={5}
                        value={Math.round((beat.scrollTo ?? 1) * 100)}
                        onChange={(e) => updateBeat(selectedBeat, { scrollTo: Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100 })}
                        className={inputCls}
                      />
                    </div>
                    <div className="col-span-3 text-[10px] text-gray-500 mt-1">
                      Chain a continuous scroll across beats: beat 1 scrolls 0→50%, beat 2 scrolls 50→100% (use the same loaded card).
                      Speed 2×/4× finishes the scroll early in the beat, then holds.
                    </div>
                  </div>
                )}

                <label className={labelCls}>Background image (Slabby moves aside like a commentator)</label>
                <div className="flex gap-2 items-stretch">
                  {beat.backgroundImage && (
                    <div className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={beat.backgroundImage} alt="background" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                      <button
                        onClick={() => updateBeat(selectedBeat, { backgroundImage: undefined })}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-[10px] leading-none"
                        title="Remove image"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <label className="px-3 flex items-center bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-semibold cursor-pointer shrink-0">
                    📁 Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void setBeatImage(f); e.target.value = '' }}
                    />
                  </label>
                  <div
                    tabIndex={0}
                    onPaste={onPasteImage}
                    className="flex-1 flex items-center px-3 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 focus:border-purple-400 focus:text-purple-600 outline-none cursor-text min-h-[40px]"
                    title="Click here, then paste a screenshot (Ctrl+V)"
                  >
                    📋 Click + Ctrl+V to paste a screenshot
                  </div>
                </div>
                <label className={labelCls}>…or image URL</label>
                <input
                  value={beat.backgroundImage?.startsWith('data:') ? '(uploaded image)' : beat.backgroundImage || ''}
                  onChange={(e) => updateBeat(selectedBeat, { backgroundImage: e.target.value || undefined })}
                  className={inputCls}
                  placeholder="https://…"
                  disabled={beat.backgroundImage?.startsWith('data:')}
                />

                {(beat.backgroundImage || beat.slabCard) && (
                  <div>
                    <label className={labelCls}>Image entrance (&apos;static&apos; = hold in place across beats)</label>
                    <select value={beat.bgAnimation || 'fade'} onChange={(e) => updateBeat(selectedBeat, { bgAnimation: e.target.value as SlabbyBeat['bgAnimation'] })} className={inputCls}>
                      {BG_ANIMATIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 text-xs text-gray-500 leading-relaxed">
              💡 <b>Tips:</b> Use a card&apos;s public image URL from its detail page for backgrounds. Start scenes
              with an <code>enter</code> beat. Keep beats 2–4s for social pacing. The grade badge on Slabby&apos;s
              label is per-beat — flip it from &quot;?&quot; to &quot;10&quot; across beats for reveal arcs. Record voiceover
              over the rendered MP4 in CapCut.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
