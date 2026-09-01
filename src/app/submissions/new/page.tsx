'use client'

// /submissions/new — bulk-grading intake.
//
// No user-facing "Submissions" branding (owner direction, Aug 31): this page
// is reached only via the "Submit more than one card →" link on /upload.
// Spec: docs/SOW_submissions_bulk_grading_2026-08-31.md (WS2/WS3/WS4 credit
// gate). Server contracts: src/lib/submissions/{types,service}.ts and
// src/app/api/submissions/**, both read-only from here.

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getStoredSession, getAuthenticatedClient } from '@/lib/directAuth'
import { useCredits } from '@/contexts/CreditsContext'
import { useToast } from '@/hooks/useToast'
import {
  compressImage,
  ensureBrowserDecodableImage,
  getOptimalCompressionSettings,
} from '@/lib/imageCompression'
import { CARD_TYPES, OTHER_SUB_CATEGORIES, type CardType } from '@/lib/cardTypeConfig'
import {
  buildPairs,
  detectConvention,
  type PairSlot,
  type PickedFile,
  type SubmissionConvention,
} from '@/lib/submissions/pairing'
import { MAX_SUBMISSION_ITEMS } from '@/lib/submissions/types'
import {
  runPreflight,
  preflightBlocks,
  type PreflightResult,
} from '@/lib/submissions/preflight'

const DRAFT_KEY = 'dcm_submission_draft_v1'
const UPLOAD_CONCURRENCY = 4

interface BinderOption {
  id: string
  name: string
  smart_filter: unknown
}

interface DraftMeta {
  category: CardType
  subCategory: string
  binderId: string | null
  pairCount: number
}

type Stage = 'pick' | 'review' | 'uploading'

interface PairUploadState {
  frontDone: boolean
  backDone: boolean
  error: string | null
}

function genId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function sha256(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return ''
  }
}

function isImageFile(file: File): boolean {
  const t = (file.type || '').toLowerCase()
  if (t === 'image/jpeg' || t === 'image/png' || t === 'image/heic' || t === 'image/heif') return true
  const n = file.name.toLowerCase()
  return /\.(jpe?g|png|heic|heif)$/.test(n)
}

function isZipFile(file: File): boolean {
  const t = (file.type || '').toLowerCase()
  if (t === 'application/zip' || t === 'application/x-zip-compressed') return true
  return /\.zip$/i.test(file.name)
}

/**
 * Extract images from a single .zip client-side. jszip is dynamically
 * imported so it never lands in bundles that don't touch this page.
 * Skips directories, macOS resource-fork junk (__MACOSX/.\* entries) and
 * anything that isn't an image; synthesizes a File per entry using the
 * zip's stored name and modified date (when present) so the same
 * filename/lastModified pairing logic that drives the rest of intake works
 * unchanged on extracted files.
 */
async function extractZip(zipFile: File): Promise<File[]> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(zipFile)
  const out: File[] = []
  for (const entry of Object.values(zip.files) as any[]) {
    if (entry.dir) continue
    const fullName: string = entry.name
    const baseName = fullName.split('/').pop() || fullName
    if (baseName.startsWith('.') || fullName.includes('__MACOSX/')) continue
    if (!/\.(jpe?g|png|heic|heif)$/i.test(baseName)) continue
    const blob: Blob = await entry.async('blob')
    const lastModified = entry.date instanceof Date ? entry.date.getTime() : Date.now()
    const mime = /\.png$/i.test(baseName)
      ? 'image/png'
      : /\.(heic|heif)$/i.test(baseName)
        ? 'image/heic'
        : 'image/jpeg'
    out.push(new File([blob], baseName, { type: mime, lastModified }))
  }
  return out
}

/** Loads a File into an <img> for canvas work (rotation). */
function loadImageElement(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}

/**
 * Bake a 90°-step rotation into the actual image bytes so the graded image
 * is upright — thumbnails preview rotation via a cheap CSS transform, but
 * the file DCM Optic actually grades must be physically rotated. Exports
 * JPEG at ~0.92, matching the quality the rest of the compression pipeline
 * targets for the final upload.
 */
async function rotateImageFile(file: File, degrees: number): Promise<File> {
  const normalized = ((degrees % 360) + 360) % 360
  if (normalized === 0) return file

  const img = await loadImageElement(file)
  const swapDims = normalized === 90 || normalized === 270
  const canvas = document.createElement('canvas')
  canvas.width = swapDims ? img.height : img.width
  canvas.height = swapDims ? img.width : img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((normalized * Math.PI) / 180)
  ctx.drawImage(img, -img.width / 2, -img.height / 2)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Failed to rotate image')); return }
      const originalName = file.name.replace(/\.[^/.]+$/, '')
      resolve(new File([blob], `${originalName}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified }))
    }, 'image/jpeg', 0.92)
  })
}

/** Runs `worker` over `items` with a concurrency cap, in array order. */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0
  const lane = async () => {
    while (cursor < items.length) {
      const i = cursor++
      await worker(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane))
}

function SubmissionsNewInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const { balance, isLoading: creditsLoading, refreshCredits } = useCredits()

  const categoryParam = searchParams?.get('category') || ''
  const subCategoryParam = searchParams?.get('sub_category') || ''

  const [selectedType, setSelectedType] = useState<CardType>(
    (categoryParam in CARD_TYPES ? categoryParam : 'Sports') as CardType
  )
  const [subCategory, setSubCategory] = useState<string>(subCategoryParam)

  const [stage, setStage] = useState<Stage>('pick')
  const [files, setFiles] = useState<PickedFile[]>([])
  const [convention, setConvention] = useState<SubmissionConvention>('alternating')
  const [preferTimeOrder, setPreferTimeOrder] = useState(false)
  const [orderWarningDismissed, setOrderWarningDismissed] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const [binders, setBinders] = useState<BinderOption[]>([])
  const [bindersAvailable, setBindersAvailable] = useState(true)
  const [selectedBinderId, setSelectedBinderId] = useState<string>('')
  const [newBinderName, setNewBinderName] = useState('')
  const [creatingBinder, setCreatingBinder] = useState(false)

  const [restoredNotice, setRestoredNotice] = useState(false)
  const [trimmedTo, setTrimmedTo] = useState<number | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [gateBlock, setGateBlock] = useState<{ required: number; balance: number; affordable: number } | null>(null)
  // The balance the SERVER's commit gate judges against (personal + org pool).
  // The header's CreditsContext shows personal only — gating on it wrongly
  // blocks org members whose store pool has credits.
  const [authBalance, setAuthBalance] = useState<number | null>(null)
  useEffect(() => {
    const session = getStoredSession()
    if (!session?.access_token) return
    fetch('/api/submissions/balance', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.success && typeof d.balance === 'number') setAuthBalance(d.balance) })
      .catch(() => {})
  }, [])

  const [uploadState, setUploadState] = useState<Map<number, PairUploadState>>(new Map())
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'creating' | 'uploading' | 'committing' | 'done' | 'error'>('idle')
  const submissionIdRef = useRef<string | null>(null)
  const cardIdByPositionRef = useRef<Map<number, string>>(new Map())

  const config = CARD_TYPES[selectedType]

  // Restore whatever survives a round trip to /credits (file objects can't
  // persist — only the settings can. Documented limitation, per SOW.)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw) as DraftMeta
      if (draft.category && draft.category in CARD_TYPES) setSelectedType(draft.category)
      if (draft.subCategory) setSubCategory(draft.subCategory)
      if (draft.binderId) setSelectedBinderId(draft.binderId)
      setRestoredNotice(true)
      sessionStorage.removeItem(DRAFT_KEY)
    } catch {
      /* ignore malformed draft */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const session = getStoredSession()
    if (!session?.access_token) return
    fetch('/api/binders', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        setBindersAvailable(data.available !== false)
        setBinders((data.binders ?? []).filter((b: any) => !b.smart_filter))
      })
      .catch(() => setBindersAvailable(false))
  }, [])

  // ---------------------------------------------------------------------
  // File selection
  // ---------------------------------------------------------------------

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter(isImageFile)
    if (!arr.length) {
      toast.error('No JPEG/PNG images found in that selection.')
      return
    }
    setFiles((prev) => {
      const seen = new Set(prev.map((p) => `${p.name}:${p.lastModified}:${p.file.size}`))
      const next: PickedFile[] = [...prev]
      for (const file of arr) {
        const key = `${file.name}:${file.lastModified}:${file.size}`
        if (seen.has(key)) continue
        seen.add(key)
        next.push({
          id: genId(),
          file,
          name: file.name,
          lastModified: file.lastModified,
          relativePath: (file as any).webkitRelativePath || '',
        })
      }
      return next
    })
  }, [toast])

  const [extractingZip, setExtractingZip] = useState(false)

  // ZIP fallback: a single .zip in the picker/drop zone gets extracted
  // client-side and its images enter the same addFiles path as any other
  // selection. Non-zip files in the same selection pass through untouched.
  const handleIncomingFiles = useCallback(async (incoming: FileList | File[]) => {
    const arr = Array.from(incoming)
    const zips = arr.filter(isZipFile)
    const rest = arr.filter((f) => !isZipFile(f))
    if (!zips.length) {
      addFiles(rest)
      return
    }
    setExtractingZip(true)
    try {
      const extracted = await Promise.all(zips.map(extractZip))
      const images = extracted.flat()
      if (!images.length) {
        toast.error('That zip had no JPEG/PNG images in it.')
      }
      addFiles([...rest, ...images])
    } catch (e: any) {
      toast.error(e?.message || 'Could not read that zip file.')
      if (rest.length) addFiles(rest)
    } finally {
      setExtractingZip(false)
    }
  }, [addFiles, toast])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleIncomingFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files?.length) handleIncomingFiles(e.dataTransfer.files)
  }

  const clearFiles = () => {
    setFiles([])
    setStage('pick')
  }

  const proceedToReview = () => {
    if (files.length < 2) {
      toast.error('Select at least two images (one front, one back).')
      return
    }
    if (files.length > MAX_SUBMISSION_ITEMS * 2) {
      toast.error(`A submission holds at most ${MAX_SUBMISSION_ITEMS} cards (${MAX_SUBMISSION_ITEMS * 2} images).`)
      return
    }
    const detected = detectConvention(files)
    setConvention(detected)
    setPreferTimeOrder(false)
    setOrderWarningDismissed(false)
    setTrimmedTo(null)
    setStage('review')
  }

  // ---------------------------------------------------------------------
  // Pairing (derived from files + convention + order preference)
  // ---------------------------------------------------------------------

  const { pairs, orderMismatch, oddCount } = useMemo(() => {
    const result = buildPairs(files, convention, preferTimeOrder)
    const limited = trimmedTo != null ? result.pairs.slice(0, trimmedTo) : result.pairs
    return { pairs: limited, orderMismatch: result.orderMismatch, oddCount: result.oddCount }
  }, [files, convention, preferTimeOrder, trimmedTo])

  const [pairOverrides, setPairOverrides] = useState<Map<number, PairSlot>>(new Map())
  // Merge manual overrides (swap/remove) onto the derived pairs, keyed by position.
  const effectivePairs = useMemo(() => {
    return pairs.map((p) => pairOverrides.get(p.position) ?? p).filter((p) => p.front || p.back)
  }, [pairs, pairOverrides])

  useEffect(() => {
    // Any time the source pairing changes, manual overrides from the previous
    // derivation no longer apply cleanly — start clean rather than risk a
    // stale swap silently reattaching to the wrong slot.
    setPairOverrides(new Map())
  }, [convention, preferTimeOrder, files])

  const pairedPairs = effectivePairs.filter((p) => p.front && p.back)
  const incompletePairs = effectivePairs.filter((p) => !p.front || !p.back)

  const swapPair = (position: number) => {
    setPairOverrides((prev) => {
      const base = pairs.find((p) => p.position === position)
      const current = prev.get(position) ?? base
      if (!current) return prev
      const next = new Map(prev)
      next.set(position, { ...current, front: current.back, back: current.front })
      return next
    })
  }

  const removePair = (position: number) => {
    setPairOverrides((prev) => {
      const next = new Map(prev)
      next.set(position, { position, front: null, back: null })
      return next
    })
  }

  const swapAllSides = () => {
    setPairOverrides(() => {
      const next = new Map<number, PairSlot>()
      for (const p of pairs) next.set(p.position, { ...p, front: p.back, back: p.front })
      return next
    })
  }

  const reverseOrder = () => {
    setPairOverrides(() => {
      const reversed = [...pairs].reverse()
      const next = new Map<number, PairSlot>()
      pairs.forEach((p, i) => next.set(p.position, { ...reversed[i], position: p.position }))
      return next
    })
  }

  // ---------------------------------------------------------------------
  // Rotation — keyed by PickedFile.id (not position/side) so a rotation
  // follows the actual image through a swap or reorder rather than sticking
  // to whichever slot it happened to occupy. Thumbnails preview via a CSS
  // transform (cheap); the real rotation is baked into the bytes at upload
  // (uploadOneSide, via rotateImageFile).
  // ---------------------------------------------------------------------

  const [rotations, setRotations] = useState<Map<string, number>>(new Map())

  const rotateOne = (fileId: string) => {
    setRotations((prev) => {
      const next = new Map(prev)
      next.set(fileId, ((next.get(fileId) || 0) + 90) % 360)
      return next
    })
  }

  const rotateAllFronts = () => {
    setRotations((prev) => {
      const next = new Map(prev)
      for (const p of effectivePairs) {
        if (p.front) next.set(p.front.id, ((next.get(p.front.id) || 0) + 90) % 360)
      }
      return next
    })
  }

  const rotateAllBacks = () => {
    setRotations((prev) => {
      const next = new Map(prev)
      for (const p of effectivePairs) {
        if (p.back) next.set(p.back.id, ((next.get(p.back.id) || 0) + 90) % 360)
      }
      return next
    })
  }

  // ---------------------------------------------------------------------
  // Duplicate detection — content hashes over every picked file, computed
  // once per file (cached by id) so the sha256 in startGrading's upload
  // payload and this check never diverge.
  // ---------------------------------------------------------------------

  const [fileHashes, setFileHashes] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    const toHash = files.filter((f) => !fileHashes.has(f.id))
    if (!toHash.length) return
    let cancelled = false
    ;(async () => {
      const updates = new Map<string, string>()
      await runWithConcurrency(toHash, 4, async (f) => {
        const hash = await sha256(f.file)
        if (hash) updates.set(f.id, hash)
      })
      if (!cancelled && updates.size) {
        setFileHashes((prev) => {
          const next = new Map(prev)
          updates.forEach((v, k) => next.set(k, v))
          return next
        })
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files])

  const duplicateInfo = useMemo(() => {
    const hashLocations = new Map<string, Array<{ position: number; side: 'front' | 'back'; fileId: string }>>()
    for (const p of effectivePairs) {
      for (const side of ['front', 'back'] as const) {
        const picked = side === 'front' ? p.front : p.back
        if (!picked) continue
        const hash = fileHashes.get(picked.id)
        if (!hash) continue
        if (!hashLocations.has(hash)) hashLocations.set(hash, [])
        hashLocations.get(hash)!.push({ position: p.position, side, fileId: picked.id })
      }
    }
    const duplicateFileIds = new Set<string>()
    let duplicateCount = 0
    for (const locs of hashLocations.values()) {
      if (locs.length > 1) {
        duplicateCount += locs.length - 1
        for (const loc of locs) duplicateFileIds.add(loc.fileId)
      }
    }
    // Front and back of the SAME pair sharing a hash is its own warning
    // ("front and back are the same image") — distinct from a hash repeated
    // across different pairs.
    const frontBackSamePairs = new Set<number>()
    for (const p of effectivePairs) {
      if (!p.front || !p.back) continue
      const fh = fileHashes.get(p.front.id)
      const bh = fileHashes.get(p.back.id)
      if (fh && bh && fh === bh) frontBackSamePairs.add(p.position)
    }
    return { hashLocations, duplicateFileIds, duplicateCount, frontBackSamePairs }
  }, [effectivePairs, fileHashes])

  // Keeps the FIRST occurrence of each duplicated hash (by scan position),
  // removing every later occurrence. That side goes missing on its pair,
  // surfacing through the existing "missing front/back" UI for a manual fix
  // (e.g. re-adding the real photo) rather than silently guessing.
  const removeDuplicates = () => {
    if (!duplicateInfo.duplicateCount) return
    setPairOverrides((prev) => {
      const next = new Map(prev)
      const seenHashes = new Set<string>()
      const sorted = [...effectivePairs].sort((a, b) => a.position - b.position)
      for (const p of sorted) {
        for (const side of ['front', 'back'] as const) {
          const picked = side === 'front' ? p.front : p.back
          if (!picked) continue
          const hash = fileHashes.get(picked.id)
          if (!hash) continue
          const locs = duplicateInfo.hashLocations.get(hash)
          if (!locs || locs.length < 2) continue
          if (seenHashes.has(hash)) {
            const base = pairs.find((pp) => pp.position === p.position)
            const current = next.get(p.position) ?? base ?? p
            next.set(p.position, { ...current, [side]: null })
          } else {
            seenHashes.add(hash)
          }
        }
      }
      return next
    })
    toast.success('Removed duplicate images. Any card left missing a side needs a fresh photo.')
  }

  // ---------------------------------------------------------------------
  // Image-quality preflight (WS4-lite) — runs during review, not after
  // commit. Cached per PickedFile.id so it survives reorders/swaps and
  // never re-runs for a file already checked.
  // ---------------------------------------------------------------------

  const [preflightResults, setPreflightResults] = useState<Map<string, PreflightResult>>(new Map())
  const [preflightRunning, setPreflightRunning] = useState(false)

  useEffect(() => {
    if (stage !== 'review') return
    const byId = new Map<string, PickedFile>()
    for (const p of effectivePairs) {
      if (p.front) byId.set(p.front.id, p.front)
      if (p.back) byId.set(p.back.id, p.back)
    }
    const toCheck = Array.from(byId.values()).filter((f) => !preflightResults.has(f.id))
    if (!toCheck.length) return
    let cancelled = false
    setPreflightRunning(true)
    ;(async () => {
      const updates = new Map<string, PreflightResult>()
      await runWithConcurrency(toCheck, 4, async (f) => {
        updates.set(f.id, await runPreflight(f.file))
      })
      if (!cancelled) {
        setPreflightResults((prev) => {
          const next = new Map(prev)
          updates.forEach((v, k) => next.set(k, v))
          return next
        })
      }
    })().finally(() => { if (!cancelled) setPreflightRunning(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, effectivePairs])

  function pairPreflight(p: PairSlot): { blocking: boolean; blockMessage: string | null; blank: boolean; warnMessage: string | null } {
    let blocking = false
    let blockMessage: string | null = null
    let blank = false
    let warnMessage: string | null = null
    for (const side of ['front', 'back'] as const) {
      const picked = side === 'front' ? p.front : p.back
      if (!picked) continue
      const result = preflightResults.get(picked.id)
      if (!result) continue
      if (preflightBlocks(result)) {
        blocking = true
        blockMessage = result.issues.find((i) => i.severity === 'block')?.message ?? 'Needs review.'
      }
      const blankIssue = result.issues.find((i) => i.code === 'blank')
      if (blankIssue) { blank = true; warnMessage = blankIssue.message }
      const aspectIssue = result.issues.find((i) => i.code === 'bad_aspect_ratio')
      if (aspectIssue && !warnMessage) warnMessage = aspectIssue.message
    }
    return { blocking, blockMessage, blank, warnMessage }
  }

  // Preflight decode-failure / sub-minimum-resolution pairs are excluded from
  // completePairs (and therefore the credit count) until resolved or
  // removed — they still show in the grid, tagged "needs review".
  const needsReviewPairs = pairedPairs.filter((p) => pairPreflight(p).blocking)
  const completePairs = pairedPairs.filter((p) => !pairPreflight(p).blocking)
  const blankFlaggedPairs = completePairs.filter((p) => pairPreflight(p).blank)
  const readyCount = completePairs.length - blankFlaggedPairs.length

  // ---------------------------------------------------------------------
  // Binders
  // ---------------------------------------------------------------------

  const createBinder = async () => {
    const name = newBinderName.trim()
    if (!name) return
    setCreatingBinder(true)
    try {
      const session = getStoredSession()
      const res = await fetch('/api/binders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ name }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.binder) {
        toast.error(data?.error || 'Could not create the binder.')
        return
      }
      setBinders((prev) => [...prev, data.binder])
      setSelectedBinderId(data.binder.id)
      setNewBinderName('')
      toast.success(`Created "${name}". Cards will file in as they grade.`)
    } catch (e: any) {
      toast.error(e?.message || 'Could not create the binder.')
    } finally {
      setCreatingBinder(false)
    }
  }

  // ---------------------------------------------------------------------
  // Credit gate
  // ---------------------------------------------------------------------

  const required = completePairs.length
  // Prefer the authoritative combined balance (personal + org pool); fall back
  // to the header's personal balance only until it loads.
  const effectiveBalance = authBalance ?? balance
  const insufficientLocally = !creditsLoading && required > 0 && effectiveBalance < required

  const persistDraftAndGoToCredits = () => {
    const draft: DraftMeta = {
      category: selectedType,
      subCategory,
      binderId: selectedBinderId || null,
      pairCount: required,
    }
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      /* sessionStorage unavailable — nothing to restore, not fatal */
    }
    router.push('/credits')
  }

  const keepFirstAffordable = (n: number) => {
    setTrimmedTo(Math.max(0, n))
    setGateBlock(null)
    toast.success(`Trimmed to the first ${n} card${n === 1 ? '' : 's'}.`)
  }

  // ---------------------------------------------------------------------
  // Upload + commit
  // ---------------------------------------------------------------------

  async function uploadOneSide(
    authClient: ReturnType<typeof getAuthenticatedClient>,
    userId: string,
    cardId: string,
    side: 'front' | 'back',
    picked: PickedFile,
    rotationDeg: number
  ): Promise<void> {
    const path = `${userId}/${cardId}/${side}.jpg`
    let file = picked.file
    try {
      file = await ensureBrowserDecodableImage(file)
    } catch {
      /* not HEIC, or conversion unavailable — upload the original */
    }
    // Bake in the rotation the reviewer picked BEFORE compression, so the
    // graded image is upright — canvas: draw rotated, export JPEG ~0.92.
    if (rotationDeg) {
      try {
        file = await rotateImageFile(file, rotationDeg)
      } catch (e) {
        console.warn(`[submissions/new] rotation failed for ${side}, uploading unrotated`, e)
      }
    }
    let compressed = file
    try {
      const settings = getOptimalCompressionSettings(file.size)
      const result = await compressImage(file, settings)
      compressed = result.compressedFile
    } catch (e) {
      console.warn(`[submissions/new] compression failed for ${side}, uploading original`, e)
    }

    let lastErr: any = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await authClient.storage.from('cards').upload(path, compressed, { upsert: true })
      if (!error) return
      lastErr = error
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    }
    throw lastErr || new Error(`Upload failed for ${side}`)
  }

  const startGrading = async () => {
    if (incompletePairs.length) {
      toast.error(`${incompletePairs.length} card${incompletePairs.length === 1 ? ' is' : 's are'} missing a front or back. Fix or remove them first.`)
      return
    }
    if (!completePairs.length) {
      toast.error('Add at least one paired card.')
      return
    }
    if (selectedType === 'Other' && !subCategory) {
      toast.error('Pick a sub-category for these cards.')
      return
    }
    const session = getStoredSession()
    if (!session?.user) {
      toast.error('You must be logged in.')
      router.push('/login')
      return
    }
    if (effectiveBalance < completePairs.length) {
      setGateBlock({ required: completePairs.length, balance: effectiveBalance, affordable: Math.max(0, effectiveBalance) })
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    setStage('uploading')
    setUploadPhase('creating')

    const userId = session.user.id
    const authClient = getAuthenticatedClient()

    try {
      // Mint card ids + storage paths BEFORE creating the draft, so the items
      // we hand the server already carry the paths the upload step will fill.
      const withIds = completePairs.map((p, i) => ({
        position: i,
        pair: p,
        cardId: genId(),
      }))
      cardIdByPositionRef.current = new Map(withIds.map((w) => [w.position, w.cardId]))

      const itemsPayload = await Promise.all(
        withIds.map(async ({ position, cardId, pair }) => {
          const frontPath = `${userId}/${cardId}/front.jpg`
          const backPath = `${userId}/${cardId}/back.jpg`
          const [frontHash, backHash] = await Promise.all([
            pair.front ? sha256(pair.front.file) : Promise.resolve(''),
            pair.back ? sha256(pair.back.file) : Promise.resolve(''),
          ])
          return {
            position,
            front_path: frontPath,
            back_path: backPath,
            front_hash: frontHash || null,
            back_hash: backHash || null,
          }
        })
      )

      const createRes = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          category: config.category,
          sub_category: selectedType === 'Naruto' ? 'Naruto / Kayou' : (config.category === 'Other' ? subCategory : undefined),
          binder_id: selectedBinderId || null,
          source: 'bulk_upload',
          items: itemsPayload,
        }),
      })
      const createData = await createRes.json().catch(() => null)
      if (!createRes.ok || !createData?.submission?.id) {
        if (createData?.code === 'insufficient_credits') {
          setGateBlock({ required: createData.required, balance: createData.balance, affordable: createData.affordable })
          setStage('review')
          setUploadPhase('idle')
          setSubmitting(false)
          return
        }
        throw new Error(createData?.error || createData?.message || 'Could not create the submission')
      }
      const submissionId = createData.submission.id as string
      submissionIdRef.current = submissionId

      // Upload every image, concurrency 4, per-pair progress + retry.
      setUploadPhase('uploading')
      const initialState = new Map<number, PairUploadState>()
      withIds.forEach(({ position }) => initialState.set(position, { frontDone: false, backDone: false, error: null }))
      setUploadState(initialState)

      await runWithConcurrency(withIds, UPLOAD_CONCURRENCY, async ({ position, cardId, pair }) => {
        try {
          if (pair.front) {
            await uploadOneSide(authClient, userId, cardId, 'front', pair.front, rotations.get(pair.front.id) || 0)
            setUploadState((prev) => new Map(prev).set(position, { ...(prev.get(position) as PairUploadState), frontDone: true }))
          }
          if (pair.back) {
            await uploadOneSide(authClient, userId, cardId, 'back', pair.back, rotations.get(pair.back.id) || 0)
            setUploadState((prev) => new Map(prev).set(position, { ...(prev.get(position) as PairUploadState), backDone: true }))
          }
        } catch (e: any) {
          setUploadState((prev) =>
            new Map(prev).set(position, {
              ...(prev.get(position) as PairUploadState),
              error: e?.message || 'Upload failed',
            })
          )
        }
      })

      setUploadPhase('committing')
      const commitRes = await fetch(`/api/submissions/${submissionId}/commit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const commitData = await commitRes.json().catch(() => null)
      if (!commitRes.ok || !commitData?.success) {
        if (commitData?.code === 'insufficient_credits') {
          setGateBlock({ required: commitData.required, balance: commitData.balance, affordable: commitData.affordable })
          setUploadPhase('idle')
          setStage('review')
          setSubmitting(false)
          return
        }
        throw new Error(commitData?.message || commitData?.error || 'Could not start grading')
      }

      // Kick the drain once so the first tick doesn't wait for the cron.
      fetch(`/api/submissions/drain?submission_id=${submissionId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {})

      refreshCredits()
      setUploadPhase('done')
      router.push(`/submissions/${submissionId}`)
    } catch (e: any) {
      console.error('[submissions/new] start grading failed:', e)
      setSubmitError(e?.message || 'Something went wrong starting this submission.')
      setUploadPhase('error')
      setStage('review')
    } finally {
      setSubmitting(false)
    }
  }

  const retryUploads = () => {
    // Re-running startGrading would create a second draft. A real "resume"
    // would re-POST only the failed sides against the existing submission —
    // not exposed by the server core, so for now a failed upload asks the
    // user to retry the whole submission.
    setStage('review')
    setUploadPhase('idle')
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/upload" className="text-sm text-indigo-600 hover:text-indigo-800">← Back to single-card upload</Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">Submit more than one card</h1>
          <p className="text-gray-600 text-sm mt-1">
            Select every scan or photo at once — front and back for each card. We&apos;ll pair them up before anything is charged.
          </p>
        </div>

        {restoredNotice && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
            Restored your card type and binder choice. Please reselect your images — browsers don&apos;t let us keep files across a trip to the credits page.
          </div>
        )}

        {/* Credit balance */}
        {!creditsLoading && (
          <div className="mb-4 inline-flex items-center gap-2 bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm font-medium">
            <span>{effectiveBalance} credit{effectiveBalance !== 1 ? 's' : ''} available</span>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 space-y-6">
          {/* Card type / sub-category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Card Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as CardType)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-white text-gray-900 font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                disabled={stage === 'uploading'}
              >
                {Object.entries(CARD_TYPES).map(([key, value]) => (
                  <option key={key} value={key}>{value.label}</option>
                ))}
              </select>
            </div>
            {selectedType === 'Other' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sub-Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-white text-gray-900 font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  disabled={stage === 'uploading'}
                >
                  <option value="">Select a sub-category...</option>
                  {Object.entries(OTHER_SUB_CATEGORIES).map(([group, items]) => (
                    <optgroup key={group} label={group}>
                      {items.map((item) => (<option key={item} value={item}>{item}</option>))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}
          </div>

          {stage === 'pick' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isDragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'}`}
              >
                <p className="text-gray-700 font-medium mb-1">Drag and drop your scans or photos here</p>
                <p className="text-xs text-gray-500 mb-4">JPEG or PNG (or a single .zip). Front and back of every card.</p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <label className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold cursor-pointer hover:bg-indigo-700">
                    Choose Photos
                    <input type="file" multiple accept="image/*,.zip,application/zip" className="hidden" onChange={handleFileInput} />
                  </label>
                  <label className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-50">
                    Choose a Folder
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileInput}
                      ref={(el) => { if (el) el.setAttribute('webkitdirectory', '') }}
                    />
                  </label>
                </div>
                {extractingZip && (
                  <p className="text-xs text-indigo-600 mt-3 font-medium">Extracting zip…</p>
                )}
              </div>

              {files.length > 0 && (
                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <span className="text-sm text-gray-700">{files.length} image{files.length === 1 ? '' : 's'} selected (~{Math.floor(files.length / 2)} cards)</span>
                  <div className="flex gap-2">
                    <button onClick={clearFiles} className="text-sm text-gray-500 hover:text-gray-700">Clear</button>
                    <button onClick={proceedToReview} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">
                      Review pairs →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {(stage === 'review' || stage === 'uploading') && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-sm text-gray-700">
                  Detected pairing: <span className="font-semibold">{convention === 'alternating' ? 'Alternating front/back' : convention === 'stems' ? 'Filename front/back stems' : 'Two folders'}</span>
                </div>
                {stage === 'review' && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setConvention('alternating')} className={`px-2 py-1 text-xs rounded-md border ${convention === 'alternating' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-300 text-gray-700'}`}>Alternating</button>
                    <button onClick={() => setConvention('stems')} className={`px-2 py-1 text-xs rounded-md border ${convention === 'stems' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-300 text-gray-700'}`}>Filename stems</button>
                    <button onClick={() => setConvention('folders')} className={`px-2 py-1 text-xs rounded-md border ${convention === 'folders' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-300 text-gray-700'}`}>Two folders</button>
                  </div>
                )}
              </div>

              {convention === 'alternating' && orderMismatch && !orderWarningDismissed && stage === 'review' && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">Filename order and capture-time order disagree.</p>
                    <p className="text-xs mt-0.5">We paired by filename. If that looks wrong below, switch to time order.</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => setPreferTimeOrder((v) => !v)} className="px-2 py-1 text-xs font-semibold bg-amber-600 text-white rounded-md hover:bg-amber-700">
                      {preferTimeOrder ? 'Use filename order' : 'Use time order'}
                    </button>
                    <button onClick={() => setOrderWarningDismissed(true)} className="px-2 py-1 text-xs bg-white border border-amber-300 text-amber-800 rounded-md">Dismiss</button>
                  </div>
                </div>
              )}

              {convention === 'alternating' && oddCount && stage === 'review' && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-sm text-red-800">
                  <p className="font-semibold">Odd number of images ({files.length}).</p>
                  <p className="text-xs mt-0.5">Alternating front/back mode needs an even count — a stray image means a double-feed or a missing back. Remove the extra image, or switch to a different pairing mode above.</p>
                </div>
              )}

              {incompletePairs.length > 0 && stage === 'review' && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-sm text-red-800">
                  {incompletePairs.length} card{incompletePairs.length === 1 ? '' : 's'} {incompletePairs.length === 1 ? 'is' : 'are'} missing a front or back. Fix them below (swap won&apos;t help a missing side — remove it or add the missing photo from the picker).
                </div>
              )}

              {duplicateInfo.duplicateCount > 0 && stage === 'review' && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800 flex items-center justify-between gap-3">
                  <span>
                    {duplicateInfo.duplicateCount} image{duplicateInfo.duplicateCount === 1 ? '' : 's'} exactly duplicate another selection (tagged <span className="font-bold">DUP</span> below).
                  </span>
                  <button onClick={removeDuplicates} className="px-3 py-1.5 text-xs font-semibold bg-white border border-amber-400 text-amber-800 rounded-lg hover:bg-amber-100 flex-shrink-0">
                    Remove duplicates
                  </button>
                </div>
              )}

              {stage === 'review' && (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                  <span>
                    <span className="font-semibold text-gray-900">{readyCount}</span> ready
                    {needsReviewPairs.length > 0 && <> · <span className="font-semibold text-red-700">{needsReviewPairs.length}</span> need review</>}
                    {blankFlaggedPairs.length > 0 && <> · <span className="font-semibold text-amber-700">{blankFlaggedPairs.length}</span> flagged blank</>}
                  </span>
                  {preflightRunning && (
                    <span className="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" title="Checking image quality…" />
                  )}
                </div>
              )}

              {stage === 'review' && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={swapAllSides} className="px-3 py-1.5 text-xs font-semibold bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Swap ALL fronts/backs</button>
                  <button onClick={reverseOrder} className="px-3 py-1.5 text-xs font-semibold bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Reverse order</button>
                  <button onClick={rotateAllFronts} className="px-3 py-1.5 text-xs font-semibold bg-white border border-gray-300 rounded-lg hover:bg-gray-50">⟳ Rotate all fronts</button>
                  <button onClick={rotateAllBacks} className="px-3 py-1.5 text-xs font-semibold bg-white border border-gray-300 rounded-lg hover:bg-gray-50">⟳ Rotate all backs</button>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[28rem] overflow-y-auto p-1">
                {effectivePairs.map((pair) => {
                  const upload = uploadState.get(pair.position)
                  const preflight = pairPreflight(pair)
                  const sameImageBothSides = duplicateInfo.frontBackSamePairs.has(pair.position)
                  return (
                    <div key={pair.position} className={`border rounded-lg p-2 bg-white ${!pair.front || !pair.back || preflight.blocking ? 'border-red-300' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-500">#{pair.position + 1}</span>
                        {stage === 'review' && (
                          <div className="flex gap-1">
                            <button onClick={() => swapPair(pair.position)} title="Swap front/back" className="text-xs text-gray-500 hover:text-indigo-600">⇄</button>
                            <button onClick={() => removePair(pair.position)} title="Remove" className="text-xs text-gray-500 hover:text-red-600">✕</button>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {(['front', 'back'] as const).map((side) => {
                          const picked = side === 'front' ? pair.front : pair.back
                          const done = upload ? (side === 'front' ? upload.frontDone : upload.backDone) : false
                          const deg = picked ? (rotations.get(picked.id) || 0) : 0
                          const result = picked ? preflightResults.get(picked.id) : undefined
                          const sideBlocking = result ? preflightBlocks(result) : false
                          const isDup = picked ? duplicateInfo.duplicateFileIds.has(picked.id) : false
                          return (
                            <div key={side} className="relative aspect-[5/7] bg-gray-100 rounded overflow-hidden border border-gray-200">
                              {picked ? (
                                <img
                                  src={URL.createObjectURL(picked.file)}
                                  alt={side}
                                  className="w-full h-full object-contain"
                                  style={{ transform: `rotate(${deg}deg)` }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-red-500 text-center px-1">missing {side}</div>
                              )}
                              {stage === 'review' && picked && (
                                <button
                                  onClick={() => rotateOne(picked.id)}
                                  title="Rotate 90°"
                                  className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center text-xs leading-none bg-black/50 text-white rounded hover:bg-black/70"
                                >
                                  ⟳
                                </button>
                              )}
                              {picked && isDup && (
                                <div className="absolute top-1 left-1 px-1 py-0.5 text-[8px] font-bold bg-amber-500 text-white rounded" title="This exact image appears more than once">
                                  DUP
                                </div>
                              )}
                              {picked && sideBlocking && (
                                <div className="absolute inset-x-0 top-0 px-1 py-0.5 text-[8px] font-bold bg-red-600 text-white text-center">
                                  {result?.issues.find((i) => i.severity === 'block')?.code === 'decode_failed' ? "can't open" : 'too small'}
                                </div>
                              )}
                              {stage === 'uploading' && picked && (
                                <div className={`absolute bottom-0 inset-x-0 text-[9px] text-center py-0.5 ${upload?.error ? 'bg-red-600 text-white' : done ? 'bg-green-600 text-white' : 'bg-black/50 text-white'}`}>
                                  {upload?.error ? 'error' : done ? 'uploaded' : 'uploading…'}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {sameImageBothSides && stage === 'review' && (
                        <p className="text-[10px] text-amber-700 font-medium mt-1">Front and back are the same image.</p>
                      )}
                      {preflight.blocking && stage === 'review' && (
                        <p className="text-[10px] text-red-700 font-medium mt-1">Needs review — {preflight.blockMessage}</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Binder */}
              {stage === 'review' && bindersAvailable && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Binder (optional)</label>
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      value={selectedBinderId}
                      onChange={(e) => setSelectedBinderId(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    >
                      <option value="">No binder — just my collection</option>
                      {binders.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                    </select>
                    <input
                      value={newBinderName}
                      onChange={(e) => setNewBinderName(e.target.value)}
                      placeholder="New binder name"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[10rem]"
                    />
                    <button
                      onClick={createBinder}
                      disabled={!newBinderName.trim() || creatingBinder}
                      className="px-3 py-2 text-sm font-semibold bg-white border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
                    >
                      {creatingBinder ? 'Creating…' : '+ Create'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">Cards file into this binder one by one as they finish grading.</p>
                </div>
              )}

              {/* Credit gate */}
              <div className={`rounded-lg p-3 border ${insufficientLocally || gateBlock ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
                <p className="text-sm font-medium text-gray-800">
                  {completePairs.length} card{completePairs.length === 1 ? '' : 's'} · {completePairs.length} credit{completePairs.length === 1 ? '' : 's'} required · you have {effectiveBalance}
                </p>
                {(insufficientLocally || gateBlock) && (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-red-700">
                      Not enough credits for all {gateBlock?.required ?? completePairs.length} cards.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => keepFirstAffordable((gateBlock?.affordable ?? balance))}
                        disabled={(gateBlock?.affordable ?? balance) <= 0}
                        className="px-3 py-1.5 text-sm font-semibold bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50"
                      >
                        Keep the first {gateBlock?.affordable ?? balance}
                      </button>
                      <button
                        onClick={persistDraftAndGoToCredits}
                        className="px-3 py-1.5 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Buy credits
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {submitError && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-sm text-red-800">{submitError}</div>
              )}

              {stage === 'uploading' && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-800">
                  {uploadPhase === 'creating' && 'Creating your submission…'}
                  {uploadPhase === 'uploading' && `Uploading images (up to ${UPLOAD_CONCURRENCY} at once)…`}
                  {uploadPhase === 'committing' && 'Starting grading…'}
                </div>
              )}

              <div className="flex flex-wrap gap-2 justify-between">
                {stage === 'review' && (
                  <button onClick={() => setStage('pick')} className="px-4 py-2 text-sm font-semibold bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">← Add more / change files</button>
                )}
                {stage === 'review' && (
                  <button
                    onClick={startGrading}
                    disabled={submitting || incompletePairs.length > 0 || !completePairs.length || (selectedType === 'Other' && !subCategory) || insufficientLocally || !!gateBlock}
                    className="px-6 py-2 text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Start grading {completePairs.length} card{completePairs.length === 1 ? '' : 's'}
                  </button>
                )}
                {stage === 'uploading' && uploadPhase === 'error' && (
                  <button onClick={retryUploads} className="px-4 py-2 text-sm font-semibold bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Back to review</button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <Link href="/submissions" className="text-sm text-gray-500 hover:text-gray-700">View past submissions →</Link>
        </div>
      </div>
    </div>
  )
}

export default function SubmissionsNewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <SubmissionsNewInner />
    </Suspense>
  )
}
