/**
 * Generates all app icon variants from a single source PNG.
 *
 * Outputs:
 *   icon.png            — 1024x1024, NO alpha, for iOS App Store
 *                         (Apple rejects transparency / pre-rounded corners)
 *   adaptive-icon.png   — 1024x1024 with transparent surround; foreground
 *                         scaled to fit Android's 66% inner safe zone so
 *                         the design survives circle/squircle masks
 *   splash-icon.png     — 1024x1024 transparent canvas, design centered;
 *                         Expo composites this over splash.backgroundColor
 *   favicon.png         — 48x48 web favicon
 *
 * The source's dark-gray corners (sampled #262628) match the chosen
 * adaptiveIcon.backgroundColor + splash backgroundColor — that hides any
 * seam between the foreground PNG and the system-painted background.
 *
 * Run: node scripts/generate-app-icons.js
 */

const sharp = require('sharp')
const path = require('path')

const SRC = path.resolve(__dirname, '../../public/DCM-logo.png')
const OUT = path.resolve(__dirname, '../assets/images')

const ADAPTIVE_BG = '#262628' // matches sampled source corners

async function generateIosIcon() {
  // iOS App Store: 1024x1024, opaque (no alpha channel at all).
  // The source already fills every pixel with the gradient, so flattening
  // onto the matching corner color is invisible AND strips the alpha.
  await sharp(SRC)
    .resize(1024, 1024, { fit: 'cover' })
    .flatten({ background: ADAPTIVE_BG })
    .png()
    .toFile(path.join(OUT, 'icon.png'))
  console.log('✓ icon.png (iOS, 1024x1024, no alpha)')
}

async function generateAdaptiveIcon() {
  // Android adaptive icon foreground: design must live within the
  // center 66% safe zone — 1024 * 0.66 ≈ 676. We use 700 to leave a hair
  // of breathing room, centered on a transparent 1024 canvas.
  const inner = 700
  const pad = (1024 - inner) / 2
  const fg = await sharp(SRC)
    .resize(inner, inner, { fit: 'cover' })
    .toBuffer()

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: fg, top: pad, left: pad }])
    .png()
    .toFile(path.join(OUT, 'adaptive-icon.png'))
  console.log('✓ adaptive-icon.png (Android, 1024x1024 with transparent surround)')
}

async function generateSplashIcon() {
  // Splash uses resizeMode: "contain" — Expo centers this on the
  // splash backgroundColor. We flatten alpha (keeps PNG ~360KB instead
  // of ~1.9MB) since the splash backgroundColor matches the corners.
  await sharp(SRC)
    .resize(1024, 1024, { fit: 'cover' })
    .flatten({ background: ADAPTIVE_BG })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, 'splash-icon.png'))
  console.log('✓ splash-icon.png (1024x1024, no alpha, max compression)')
}

async function generateFavicon() {
  await sharp(SRC)
    .resize(48, 48, { fit: 'cover' })
    .png()
    .toFile(path.join(OUT, 'favicon.png'))
  console.log('✓ favicon.png (48x48)')
}

;(async () => {
  await generateIosIcon()
  await generateAdaptiveIcon()
  await generateSplashIcon()
  await generateFavicon()
  console.log('\nDone. Update app.json adaptiveIcon.backgroundColor and splash.backgroundColor to', ADAPTIVE_BG)
})().catch(e => { console.error(e); process.exit(1) })
