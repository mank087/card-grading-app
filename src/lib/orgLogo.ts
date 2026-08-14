/**
 * Org logo processing — shared by the admin branding upload and the
 * self-serve application wizard. Accepts one PNG; normalizes to a square
 * transparent canvas and derives white and black ink variants with sharp so
 * the same mark works on dark labels (white variant) and light/Heritage
 * labels (black). Stores all three to org-assets and stamps the org row.
 */
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import sharp from 'sharp'

export const LOGO_MAX_BYTES = 2 * 1024 * 1024
const MIN_EDGE = 256
const MAX_EDGE = 1200 // labels never need more; keeps signed-URL fetches fast

/**
 * Ensure the logo has a usable alpha channel. The ink variants recolor every
 * opaque pixel, so a logo delivered on a solid background (no transparency)
 * would tint into a featureless box. When the image is effectively fully
 * opaque AND its four corners agree on one flat background color, that
 * background is knocked out (soft threshold on color distance, so
 * anti-aliased edges survive). Logos that already carry transparency, or
 * whose corners disagree (photographic/full-bleed art), pass through
 * untouched.
 */
async function ensureAlpha(png: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info

  let transparentish = 0
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) transparentish++
  }
  const totalPx = w * h
  if (transparentish / totalPx > 0.005) return png // already has real transparency

  // Sample the four corners (3x3 average each) and require them to agree.
  const cornerAvg = (cx: number, cy: number) => {
    let r = 0, g = 0, b = 0, n = 0
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const x = Math.min(w - 1, cx + dx), y = Math.min(h - 1, cy + dy)
        const i = (y * w + x) * 4
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
      }
    }
    return { r: r / n, g: g / n, b: b / n }
  }
  const corners = [cornerAvg(0, 0), cornerAvg(w - 3, 0), cornerAvg(0, h - 3), cornerAvg(w - 3, h - 3)]
  const dist = (a: { r: number; g: number; b: number }, b2: { r: number; g: number; b: number }) =>
    Math.sqrt((a.r - b2.r) ** 2 + (a.g - b2.g) ** 2 + (a.b - b2.b) ** 2)
  const bg = corners[0]
  if (corners.some(c => dist(c, bg) > 24)) return png // corners disagree: not a flat background

  // Knock out the background: alpha ramps from 0 (== bg) to 255 (far from bg).
  const NEAR = 32, FAR = 96
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.sqrt((data[i] - bg.r) ** 2 + (data[i + 1] - bg.g) ** 2 + (data[i + 2] - bg.b) ** 2)
    const a = d <= NEAR ? 0 : d >= FAR ? 255 : Math.round(((d - NEAR) / (FAR - NEAR)) * 255)
    data[i + 3] = Math.min(data[i + 3], a) as number
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()
}

/** Recolor every opaque pixel to a flat ink, preserving the alpha channel. */
async function tintToInk(png: Buffer, ink: { r: number; g: number; b: number }): Promise<Buffer> {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    data[i] = ink.r
    data[i + 1] = ink.g
    data[i + 2] = ink.b
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer()
}

export interface LogoResult {
  success: true
  previews: { color: string | null; white: string | null; black: string | null }
}
export interface LogoError {
  success: false
  error: string
  status: number
}

/**
 * Validate, derive, store, and stamp an org's logo set. The org row must
 * already exist. Seeds brand_colors from the logo only when none are set.
 */
export async function processAndStoreOrgLogo(
  orgId: string,
  file: File,
  currentBrandColors: string[] | null | undefined
): Promise<LogoResult | LogoError> {
  if (file.size > LOGO_MAX_BYTES) {
    return { success: false, error: 'Logo must be under 2MB', status: 400 }
  }

  const input = Buffer.from(await file.arrayBuffer())
  let meta
  try {
    meta = await sharp(input).metadata()
  } catch {
    return { success: false, error: 'File is not a readable image', status: 400 }
  }
  if (meta.format !== 'png') {
    return { success: false, error: 'Logo must be a PNG (transparent background recommended)', status: 400 }
  }
  if ((meta.width || 0) < MIN_EDGE && (meta.height || 0) < MIN_EDGE) {
    return { success: false, error: `Logo should be at least ${MIN_EDGE}px on its longest edge`, status: 400 }
  }

  // Solid-background logos (no transparency) would tint into featureless
  // boxes — knock the background out first when it's safely detectable.
  let alphaSafe: Buffer
  try {
    alphaSafe = await ensureAlpha(input)
  } catch (err) {
    console.warn('[orgLogo] background knockout failed, using original:', err)
    alphaSafe = input
  }

  // Normalize to a SQUARE canvas (contain + transparent padding). Many label
  // slots are square and stretch whatever they're given — a wide logo came out
  // distorted on printed labels. Baking the padding here fixes every slot at
  // once without touching the renderers.
  const normalized = await sharp(alphaSafe)
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, withoutEnlargement: false })
    .png()
    .toBuffer()

  let whiteVariant: Buffer
  let blackVariant: Buffer
  try {
    whiteVariant = await tintToInk(normalized, { r: 255, g: 255, b: 255 })
    blackVariant = await tintToInk(normalized, { r: 16, g: 16, b: 20 })
  } catch (err) {
    console.error('[orgLogo] variant derivation failed:', err)
    return { success: false, error: 'Failed to derive logo variants', status: 500 }
  }

  const base = `${orgId}`
  const uploads: Array<[string, Buffer]> = [
    [`${base}/logo.png`, normalized],
    [`${base}/logo-white.png`, whiteVariant],
    [`${base}/logo-black.png`, blackVariant],
  ]
  for (const [path, buf] of uploads) {
    const { error } = await supabaseAdmin.storage
      .from('org-assets')
      .upload(path, buf, { contentType: 'image/png', upsert: true })
    if (error) {
      console.error('[orgLogo] upload failed:', path, error)
      return { success: false, error: `Failed to store ${path}`, status: 500 }
    }
  }

  // Seed the org brand palette from the logo — placeholders only: never
  // overwrite a customized palette. (Extraction failure is non-fatal.)
  let seededBrandColors: string[] | null = null
  if (!currentBrandColors || currentBrandColors.length === 0) {
    try {
      const { extractLogoPalette } = await import('@/lib/logoPalette')
      const palette = await extractLogoPalette(normalized)
      if (palette.length > 0) seededBrandColors = palette
    } catch (err) {
      console.warn('[orgLogo] logo palette extraction failed (non-fatal):', err)
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from('organizations')
    .update({
      logo_path: `${base}/logo.png`,
      logo_white_path: `${base}/logo-white.png`,
      logo_black_path: `${base}/logo-black.png`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orgId)

  // Separate best-effort write: palette seeding must not fail the upload.
  if (seededBrandColors) {
    const { error: paletteError } = await supabaseAdmin
      .from('organizations')
      .update({ brand_colors: seededBrandColors, brand_color: seededBrandColors[0] })
      .eq('id', orgId)
    if (paletteError) console.warn('[orgLogo] brand palette seed skipped:', paletteError.message)
  }
  if (updateError) {
    console.error('[orgLogo] org row update failed:', updateError)
    return { success: false, error: 'Logos stored but organization update failed', status: 500 }
  }

  const signed: Record<string, string | null> = {}
  for (const [path] of uploads) {
    const { data } = await supabaseAdmin.storage.from('org-assets').createSignedUrl(path, 3600)
    signed[path.split('/').pop()!.replace('.png', '')] = data?.signedUrl ?? null
  }

  return {
    success: true,
    previews: { color: signed['logo'], white: signed['logo-white'], black: signed['logo-black'] },
  }
}
