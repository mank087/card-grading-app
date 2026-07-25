import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'

/**
 * Slabby Lab voiceover: text → speech via OpenAI TTS, returned as an mp3
 * data URL so the audio embeds into the scene JSON (self-contained through
 * preview and render, same pattern as images). Cost ≈ $0.015/1K chars.
 */

const VOICES = new Set(['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'])

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value
    if (!token || !(await verifyAdminSession(token))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const text = String(body?.text || '').trim().slice(0, 2000)
    if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 })
    const voice = VOICES.has(body?.voice) ? body.voice : 'ash'

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice,
        input: text,
        instructions: 'Upbeat, playful trading-card show host. Energetic but clear.',
        response_format: 'mp3',
      }),
    })
    if (!res.ok) {
      const detail = await res.text()
      console.error('[SlabbyTTS] OpenAI error:', res.status, detail.slice(0, 300))
      return NextResponse.json({ error: `TTS failed (${res.status})` }, { status: 502 })
    }
    const buf = Buffer.from(await res.arrayBuffer())
    return NextResponse.json({ audio: `data:audio/mpeg;base64,${buf.toString('base64')}` })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'TTS failed' }, { status: 500 })
  }
}
