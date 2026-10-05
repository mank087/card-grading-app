import sharp from 'sharp';
import { createDisplayCrops, displayPathFor, planDisplayCrop, renderDisplayCrop } from './displayCrop';
import { displayCropFor, displayImagePath } from './displayPath';

// A card filling the middle of a 3000x4000 portrait photo (0-1000 coordinates).
const centered = [{ x: 250, y: 220 }, { x: 750, y: 220 }, { x: 750, y: 720 }, { x: 250, y: 720 }];

describe('planDisplayCrop', () => {
  it('trims a far-away card with a margin and no rotation when it is straight', () => {
    // 1500 x 2000 px card (0.75 aspect) in a 3000 x 4000 photo.
    const plan = planDisplayCrop(centered, 3000, 4000);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.angleDeg).toBe(0);
    // 8% margin on each side of the card.
    expect(plan.box.left).toBe(Math.floor(750 - 1500 * 0.08));
    expect(plan.box.width).toBeGreaterThan(1500);
    expect(plan.box.width).toBeLessThan(1500 * 1.2);
  });

  it('straightens a tilted card (counter-rotates the tilt)', () => {
    // Top edge drops 60 px over 1500 px: about 2.3 degrees clockwise.
    const tilted = [{ x: 250, y: 220 }, { x: 750, y: 235 }, { x: 746, y: 735 }, { x: 246, y: 720 }];
    const plan = planDisplayCrop(tilted, 3000, 4000);
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.angleDeg).toBeCloseTo(-2.29, 1);
  });

  it.each([
    ['touches the photo edge', [{ x: 0, y: 220 }, { x: 750, y: 220 }, { x: 750, y: 720 }, { x: 0, y: 720 }], 'touches_edge'],
    ['is not card-shaped', [{ x: 100, y: 450 }, { x: 900, y: 450 }, { x: 900, y: 550 }, { x: 100, y: 550 }], 'not_card_shaped'],
    ['is badly skewed', [{ x: 250, y: 220 }, { x: 750, y: 220 }, { x: 650, y: 720 }, { x: 350, y: 720 }], 'skewed_outline'],
    ['is out of order', [{ x: 750, y: 220 }, { x: 250, y: 220 }, { x: 250, y: 720 }, { x: 750, y: 720 }], 'not_convex'],
    ['is missing', null, 'no_outline'],
  ])('keeps the original when the outline %s', (_label, quad, reason) => {
    expect(planDisplayCrop(quad, 3000, 4000)).toEqual({ ok: false, reason });
  });

  it('skips a card that already fills the photo', () => {
    const full = [{ x: 60, y: 60 }, { x: 940, y: 60 }, { x: 940, y: 940 }, { x: 60, y: 940 }];
    expect(planDisplayCrop(full, 3000, 4000)).toEqual({ ok: false, reason: 'already_tight' });
  });
});

describe('renderDisplayCrop', () => {
  it('produces a trimmed JPEG from a real image', async () => {
    const photo = await sharp({ create: { width: 1500, height: 2000, channels: 3, background: '#556b2f' } })
      .composite([{ input: await sharp({ create: { width: 750, height: 1000, channels: 3, background: '#ffffff' } }).png().toBuffer(), left: 375, top: 440 }])
      .jpeg().toBuffer();
    const out = await renderDisplayCrop(photo, centered);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.width).toBeLessThan(1500);
      expect(out.height / out.width).toBeCloseTo(4 / 3, 1);
    }
  });
});

describe('createDisplayCrops + displayImagePath', () => {
  it('uploads beside the original, records it, and the read side picks it up', async () => {
    const photo = await sharp({ create: { width: 1500, height: 2000, channels: 3, background: '#334' } }).jpeg().toBuffer();
    const uploads: string[] = [];
    const storage = { upload: async (path: string) => { uploads.push(path); return { error: null }; } };
    const record = await createDisplayCrops(storage, {
      front: { path: 'u/c/front.jpg', buffer: photo, quad: centered },
      back: { path: 'u/c/back.jpg', buffer: photo, quad: null },
    });
    expect(uploads).toEqual(['u/c/front_display.jpg', 'u/c/front_display_thumb.jpg']);
    expect(record.back).toEqual({ skipped: 'no_outline' });
    const card = { front_path: 'u/c/front.jpg', back_path: 'u/c/back.jpg', capture_quality: { display: record } };
    expect(displayImagePath(card, 'front')).toBe('u/c/front_display.jpg');
    expect(displayImagePath(card, 'back')).toBe('u/c/back.jpg');
    // A copy recorded somewhere else is never trusted.
    expect(displayCropFor({ ...card, capture_quality: { display: { ...record, front: { path: 'other/x_display.jpg', width: 1, height: 1 } } } }, 'front')).toBeNull();
    expect(displayImagePath({ front_path: 'u/c/front.jpg' }, 'front')).toBe('u/c/front.jpg');
  });

  it('names the copy next to the original', () => {
    expect(displayPathFor('a/b/front.jpg')).toBe('a/b/front_display.jpg');
  });
});
