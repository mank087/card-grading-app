import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'

/**
 * Slabby Lab: transcribe a recorded voiceover into WORD-LEVEL timings.
 *
 * Karaoke captions used to spread the script evenly across the beat, which
 * only ever approximated and drifts on any line with a pause. Feeding the
 * real audio through Whisper gives per-word start/end times, so captions land
 * on the word actually being spoken.
 *
 * Also returns the transcript, so a beat recorded off-script (ad-libbed) can
 * have its caption text corrected to what was really said.
 *
 * Body: { audio: "data:audio/webm;base64,…" }
 * Returns: { text, words: [{ word, start, end }], duration }
 */

export const maxDuration = 60

const MAX_BYTES = 25 * 1024 * 1024 // OpenAI's per-file limit

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value
    if (!token || !(await verifyAdminSession(token))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const dataUrl = String(body?.audio || '')
    const match = /^data:(audio\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl)
    if (!match) {
      return NextResponse.json({ error: 'Expected an audio data URL' }, { status: 400 })
    }

    const mime = match[1].toLowerCase()
    const buf = Buffer.from(match[2], 'base64')
    if (buf.length === 0) return NextResponse.json({ error: 'Empty audio' }, { status: 400 })
    if (buf.length > MAX_BYTES) {
      return NextResponse.json({ error: 'Recording too large (25MB max)' }, { status: 413 })
    }

    // Whisper picks the decoder from the file extension, so the name matters.
    const EXT: Record<string, string> = {
      'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav',
      'audio/x-wav': 'wav', 'audio/aac': 'aac', 'audio/flac': 'flac',
    }
    const ext = EXT[mime] || 'webm'

    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(buf)], { type: mime }), `voiceover.${ext}`)
    form.append('model', 'whisper-1')
    form.append('response_format', 'verbose_json')
    form.append('timestamp_granularities[]', 'word')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    })

    if (!res.ok) {
      const detail = await res.text()
      console.error('[SlabbyTranscribe] OpenAI error:', res.status, detail.slice(0, 300))
      return NextResponse.json({ error: `Transcription failed (${res.status})` }, { status: 502 })
    }

    const json = await res.json()
    const words = Array.isArray(json.words)
      ? json.words
          .map((w: any) => ({
            word: String(w.word ?? '').trim(),
            start: Number(w.start) || 0,
            end: Number(w.end) || 0,
          }))
          .filter((w: any) => w.word)
      : []

    return NextResponse.json({
      text: String(json.text || '').trim(),
      words,
      duration: Number(json.duration) || null,
    })
  } catch (error: any) {
    console.error('[SlabbyTranscribe] Error:', error?.message)
    return NextResponse.json({ error: error?.message || 'Transcription failed' }, { status: 500 })
  }
}
