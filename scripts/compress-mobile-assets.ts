/**
 * Compress oversized image assets in dcm-mobile/assets/images/.
 *
 * Per the mobile app audit:
 *   dcm-logo.png is 1.4 MB (should be ~50 KB — flat logo)
 *   onboarding/* is ~5.3 MB (4-panel welcome carousel)
 *   slab-*.png totals ~1.7 MB across 4 large files
 *
 * Strategy:
 *   - Logos / UI overlays → keep PNG, run through sharp's adaptive compression
 *     (lossless palette reduction). Maintains crisp edges + transparency.
 *   - Slab card art / onboarding photos → re-encode at smaller dimensions if
 *     wildly oversized; lossy PNG with 80% quality is fine for these.
 *
 * Backups: each original file is saved as <name>.orig.<ext> before overwrite,
 * so this script is idempotent and safe to re-run.
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const ASSETS = '/c/Users/benja/card-grading-app/dcm-mobile/assets/images'.replace(/\//g, path.sep).replace('c:', 'C:');
// On Windows the above gets messy — use the proper path:
const IMAGES_DIR = path.resolve('C:/Users/benja/card-grading-app/dcm-mobile/assets/images');

interface CompressTask {
  file: string;
  // Maximum width in pixels. If larger, downscale.
  maxWidth?: number;
  // PNG compression options.
  png?: { quality?: number; effort?: number; palette?: boolean };
}

const TASKS: CompressTask[] = [
  // Logo — flat purple "DCM" mark. Use palette mode for huge size reduction
  // (lossless palette is identical-looking but ~10-20x smaller for flat art).
  { file: 'dcm-logo.png',          maxWidth: 800, png: { palette: true, quality: 90, effort: 9 } },

  // Slab art (illustrative card backgrounds) — large detailed renders.
  // Lossy PNG (q80) cuts size ~50% with no perceptible quality loss at the
  // sizes these are displayed.
  { file: 'slab-pokemon.png',      maxWidth: 1200, png: { quality: 80, effort: 9 } },
  { file: 'slab-onepiece.png',     maxWidth: 1200, png: { quality: 80, effort: 9 } },
  { file: 'slab-football.png',     maxWidth: 1200, png: { quality: 80, effort: 9 } },
  { file: 'slab-baseball.png',     maxWidth: 1200, png: { quality: 80, effort: 9 } },
  { file: 'slab-starwars.png',     maxWidth: 1200, png: { quality: 80, effort: 9 } },
  { file: 'slab-yugioh.png',       maxWidth: 1200, png: { quality: 80, effort: 9 } },
  { file: 'slab-mtg.png',          maxWidth: 1200, png: { quality: 80, effort: 9 } },
  { file: 'slab-lorcana.png',      maxWidth: 1200, png: { quality: 80, effort: 9 } },

  // Holder photos — these need to retain card-window precision (slot
  // positions are measured from these), so don't downscale beyond 600px.
  { file: 'graded-card-slab.png',  maxWidth: 600,  png: { quality: 85, effort: 9 } },
  { file: 'mag-one-touch-DCM.png', maxWidth: 600,  png: { quality: 85, effort: 9 } },
  { file: 'top-loader-dcm.png',    maxWidth: 600,  png: { quality: 85, effort: 9 } },

  // Shop hero images — already JPG, just the slabs PNG is heavy.
  { file: 'shop-traditional-slabs.jpg', maxWidth: 1200 },

  // Card images that show on the carousel (large)
  { file: 'onboarding/card1.png',  maxWidth: 1000, png: { quality: 80, effort: 9 } },
  { file: 'onboarding/card2.png',  maxWidth: 1000, png: { quality: 80, effort: 9 } },
  { file: 'onboarding/card3.png',  maxWidth: 1000, png: { quality: 80, effort: 9 } },
  { file: 'onboarding/card4.png',  maxWidth: 1000, png: { quality: 80, effort: 9 } },
  { file: 'onboarding/card5.png',  maxWidth: 1000, png: { quality: 80, effort: 9 } },
  { file: 'onboarding/card6.png',  maxWidth: 1000, png: { quality: 80, effort: 9 } },
  { file: 'onboarding/card7.png',  maxWidth: 1000, png: { quality: 80, effort: 9 } },
  { file: 'onboarding/card8.png',  maxWidth: 1000, png: { quality: 80, effort: 9 } },
  { file: 'onboarding/card9.png',  maxWidth: 1000, png: { quality: 80, effort: 9 } },
  { file: 'onboarding/card10.png', maxWidth: 1000, png: { quality: 80, effort: 9 } },
  { file: 'onboarding/card11.png', maxWidth: 1000, png: { quality: 80, effort: 9 } },
  { file: 'onboarding/card12.png', maxWidth: 1000, png: { quality: 80, effort: 9 } },
  { file: 'onboarding/slab-judge.png', maxWidth: 800, png: { quality: 85, effort: 9 } },
];

async function main() {
  let totalBefore = 0;
  let totalAfter = 0;
  let processed = 0;

  for (const task of TASKS) {
    const fullPath = path.join(IMAGES_DIR, task.file);
    if (!fs.existsSync(fullPath)) {
      console.log(`SKIP (missing): ${task.file}`);
      continue;
    }

    const ext = path.extname(task.file).toLowerCase();
    const stem = task.file.replace(ext, '');
    const backupPath = path.join(IMAGES_DIR, `${stem}.orig${ext}`);

    // Skip if already compressed (backup exists and is newer than current)
    if (fs.existsSync(backupPath)) {
      console.log(`SKIP (already compressed): ${task.file}  (backup at .orig${ext})`);
      continue;
    }

    const beforeSize = fs.statSync(fullPath).size;
    totalBefore += beforeSize;

    // Backup
    fs.copyFileSync(fullPath, backupPath);

    try {
      const tempPath = path.join(IMAGES_DIR, `${stem}.tmp${ext}`);
      let pipeline = sharp(fullPath, { animated: false });
      const meta = await pipeline.metadata();

      if (task.maxWidth && meta.width && meta.width > task.maxWidth) {
        pipeline = pipeline.resize({ width: task.maxWidth, withoutEnlargement: true });
      }

      if (ext === '.png') {
        pipeline = pipeline.png({
          quality: task.png?.quality ?? 80,
          effort: task.png?.effort ?? 9,
          palette: task.png?.palette,
          compressionLevel: 9,
        });
      } else if (ext === '.jpg' || ext === '.jpeg') {
        pipeline = pipeline.jpeg({ quality: 80, mozjpeg: true });
      }

      await pipeline.toFile(tempPath);
      fs.renameSync(tempPath, fullPath);

      const afterSize = fs.statSync(fullPath).size;
      totalAfter += afterSize;
      processed++;
      const reduction = ((1 - afterSize / beforeSize) * 100).toFixed(1);
      console.log(`  ${task.file.padEnd(35)} ${(beforeSize / 1024).toFixed(0).padStart(6)} KB → ${(afterSize / 1024).toFixed(0).padStart(5)} KB   (-${reduction}%)`);
    } catch (err: any) {
      console.error(`  FAILED ${task.file}:`, err.message);
      // Restore from backup
      fs.copyFileSync(backupPath, fullPath);
      fs.unlinkSync(backupPath);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Files processed: ${processed} / ${TASKS.length}`);
  console.log(`Total before:    ${(totalBefore / 1024).toFixed(0)} KB (${(totalBefore / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Total after:     ${(totalAfter / 1024).toFixed(0)} KB (${(totalAfter / 1024 / 1024).toFixed(2)} MB)`);
  if (totalBefore > 0) {
    console.log(`Reduction:       ${((totalBefore - totalAfter) / 1024).toFixed(0)} KB saved (${(((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1)}%)`);
  }
  console.log('\nOriginal files preserved as <name>.orig.<ext>. Re-run is a no-op.');
  console.log('To revert: rename .orig back to original name.');
}

main().catch(err => { console.error(err); process.exit(1); });
