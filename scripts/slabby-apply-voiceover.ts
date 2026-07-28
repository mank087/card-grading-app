/**
 * Rebuild a Slabby scene around YOUR recorded voiceover.
 *
 * The problem this solves: beat durations were originally timed to synthetic
 * TTS, which reads faster than a person. Recording over a fixed render forces
 * you to rush. Instead, record at your natural pace and let each beat stretch
 * to fit — audio drives the edit, not the other way around.
 *
 * USAGE
 *   1. Record one clip per beat into slabby/voiceover/
 *      Name them beat-01.mp3 … beat-12.mp3  (.mp3 / .m4a / .wav all fine)
 *      Any beat you skip keeps its existing audio, so you can redo one line
 *      without re-recording everything.
 *   2. npx tsx scripts/slabby-apply-voiceover.ts
 *   3. cd slabby && npx remotion render src/index.ts composer-shorts \
 *        out/is-grading-worth-it-60s.mp4 --props=scenes/is-grading-worth-it-60s.json
 *
 * Options:
 *   --scene=<name>   scene file in slabby/scenes (default is-grading-worth-it-60s)
 *   --pad=<seconds>  silence held after each line (default 0.45; the closing
 *                    beat gets double so the end card doesn't cut off)
 *   --dry            report timings without writing
 */
import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'

const arg = (k: string, d: string) => {
  const hit = process.argv.find(a => a.startsWith(`--${k}=`))
  return hit ? hit.split('=')[1] : d
}
const SCENE = arg('scene', 'is-grading-worth-it-60s')
const PAD = parseFloat(arg('pad', '0.45'))
const DRY = process.argv.includes('--dry')

const SCENE_PATH = path.join('slabby', 'scenes', `${SCENE}.json`)
const VO_DIR = path.join('slabby', 'voiceover')
const EXTS = ['.mp3', '.m4a', '.wav', '.aac', '.ogg', '.webm']
const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
  '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.webm': 'audio/webm',
}

/** Duration via ffprobe when available, else parse the container ourselves. */
function durationOf(file: string): number {
  try {
    const out = execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', file,
    ], { encoding: 'utf8' }).trim()
    const d = parseFloat(out)
    if (d > 0) return +d.toFixed(2)
  } catch { /* ffprobe not installed — fall through */ }

  const buf = fs.readFileSync(file)
  const ext = path.extname(file).toLowerCase()

  if (ext === '.wav') {
    // fmt chunk: byteRate at offset 28; data chunk size / byteRate
    const byteRate = buf.readUInt32LE(28)
    const idx = buf.indexOf(Buffer.from('data'))
    if (byteRate > 0 && idx > 0) return +((buf.readUInt32LE(idx + 4)) / byteRate).toFixed(2)
  }

  if (ext === '.mp3') {
    const RATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
    for (let i = 0; i < Math.min(buf.length - 4, 20000); i++) {
      if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) {
        const kbps = RATES[(buf[i + 2] >> 4) & 0x0f]
        if (kbps) return +(((buf.length - i) * 8) / (kbps * 1000)).toFixed(2)
      }
    }
  }

  if (ext === '.m4a' || ext === '.aac') {
    // mvhd: timescale + duration
    const idx = buf.indexOf(Buffer.from('mvhd'))
    if (idx > 0) {
      const ts = buf.readUInt32BE(idx + 12)
      const du = buf.readUInt32BE(idx + 16)
      if (ts > 0) return +(du / ts).toFixed(2)
    }
  }

  throw new Error(`Could not measure ${path.basename(file)} — install ffmpeg or export as .mp3/.wav`)
}

function findClip(n: number): string | null {
  const num = String(n).padStart(2, '0')
  for (const ext of EXTS) {
    for (const stem of [`beat-${num}`, `beat${num}`, `${num}`]) {
      const p = path.join(VO_DIR, stem + ext)
      if (fs.existsSync(p)) return p
    }
  }
  return null
}

function main() {
  if (!fs.existsSync(SCENE_PATH)) throw new Error(`No scene at ${SCENE_PATH}`)
  fs.mkdirSync(VO_DIR, { recursive: true })

  const doc = JSON.parse(fs.readFileSync(SCENE_PATH, 'utf8'))
  const beats = doc.scene.beats as any[]

  console.log(`Scene: ${SCENE}  (${beats.length} beats)`)
  console.log(`Looking for clips in ${VO_DIR}/ …\n`)

  let replaced = 0
  let before = 0
  beats.forEach((b, i) => {
    before += b.duration
    const clip = findClip(i + 1)
    const line = String(b.voiceover || '').slice(0, 44)

    if (!clip) {
      console.log(`  ${String(i + 1).padStart(2)}. ${b.duration.toFixed(2)}s  (kept)     "${line}…"`)
      return
    }

    const dur = durationOf(clip)
    const pad = i === beats.length - 1 ? PAD * 2 : PAD
    const newDur = +(dur + pad).toFixed(2)
    const ext = path.extname(clip).toLowerCase()
    const b64 = fs.readFileSync(clip).toString('base64')

    b.voiceoverAudio = `data:${MIME[ext] || 'audio/mpeg'};base64,${b64}`
    b.voiceoverDuration = dur
    b.duration = newDur
    replaced++

    const delta = newDur - (b.duration === newDur ? newDur : 0)
    console.log(`  ${String(i + 1).padStart(2)}. ${newDur.toFixed(2)}s  ← ${path.basename(clip)} (${dur}s voice) "${line}…"`)
  })

  const after = beats.reduce((a, b) => a + b.duration, 0)

  if (replaced === 0) {
    console.log(`\nNo clips found. Drop files named beat-01…beat-${String(beats.length).padStart(2, '0')} into ${VO_DIR}/ and re-run.`)
    console.log(`Accepted formats: ${EXTS.join(' ')}`)
    return
  }

  console.log(`\n${replaced}/${beats.length} beats replaced.`)
  console.log(`Runtime: ${before.toFixed(1)}s → ${after.toFixed(1)}s`)

  if (DRY) { console.log('\n--dry: nothing written.'); return }

  fs.writeFileSync(SCENE_PATH, JSON.stringify(doc))
  console.log(`\n✅ Wrote ${SCENE_PATH}`)
  console.log(`   Render:  cd slabby && npx remotion render src/index.ts composer-shorts out/${SCENE}.mp4 --props=scenes/${SCENE}.json`)
}

main()
