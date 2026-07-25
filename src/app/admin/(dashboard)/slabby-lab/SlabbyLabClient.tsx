'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Player } from '@remotion/player'
import { ComposerScene, sceneDurationInFrames } from '@/lib/slabby/ComposerScene'
import {
  BG_ANIMATIONS,
  DEFAULT_BEAT,
  EXPRESSIONS,
  MOTIONS,
  SlabbyBeat,
  SlabbyScene,
} from '@/lib/slabby/types'

const FPS = 30
const STORAGE_KEY = 'slabby_lab_scene_v1'

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

  // autosave
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(scene)) } catch { /* ignore */ }
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

            {/* export */}
            <div className="mt-4 border-t border-gray-100 pt-4 space-y-2">
              <div className="flex gap-2">
                <button onClick={downloadScene} className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold">
                  ⬇ Download scene JSON
                </button>
                <label className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-semibold text-center cursor-pointer">
                  ⬆ Load scene
                  <input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && loadSceneFile(e.target.files[0])} />
                </label>
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

                <label className={labelCls}>Background image URL (card photo, screenshot…)</label>
                <input value={beat.backgroundImage || ''} onChange={(e) => updateBeat(selectedBeat, { backgroundImage: e.target.value || undefined })} className={inputCls} placeholder="https://… (Slabby moves aside like a commentator)" />

                {beat.backgroundImage && (
                  <div>
                    <label className={labelCls}>Image entrance</label>
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
