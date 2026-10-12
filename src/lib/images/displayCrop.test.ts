import sharp from 'sharp';
import { createDisplayCrops, displayPathFor, isCardShaped, planDisplayCrop, renderDisplayCrop } from './displayCrop';
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
    // A 1500x2000 px card rotated about 2.3 degrees clockwise (top edge drops 60 px).
    const tilted = [{ x: 250, y: 220 }, { x: 750, y: 235 }, { x: 723, y: 735 }, { x: 223, y: 720 }];
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

// Oct 12 2026 audit: real outlines from the capture gate that stopped short of the
// card's bottom edge. dc-1 accepted them (outline 0.78-0.81 wide) and the display
// copy cut off the bottom of the card on every surface.
describe('planDisplayCrop: outlines that miss part of the card (Oct 2026 audit)', () => {
  it.each([
    // ed0ea559 (McGwire), 2056x2879 photo: true card spans y ~357-702, outline 324-646.
    ['McGwire front', [{ x: 310, y: 324 }, { x: 653, y: 324 }, { x: 658, y: 646 }, { x: 309, y: 645 }], 2056, 2879],
    // 877b9b10 (Peterson), 2250x3000 photo: true card spans y ~137-800, outline 137-715.
    ['Peterson front', [{ x: 171, y: 137 }, { x: 790, y: 138 }, { x: 790, y: 714 }, { x: 171, y: 715 }], 2250, 3000],
    ['Peterson back', [{ x: 184, y: 189 }, { x: 806, y: 190 }, { x: 805, y: 769 }, { x: 184, y: 769 }], 2250, 3000],
  ])('keeps the original for %s', (_label, quad, w, h) => {
    expect(planDisplayCrop(quad, w, h)).toEqual({ ok: false, reason: 'not_card_shaped' });
  });

  it('keeps the original when the card is too close to the photo edge for a margin', () => {
    // Card-shaped (1500x2100 px) but only ~2% of its height from the bottom edge.
    const low = [{ x: 250, y: 455 }, { x: 750, y: 455 }, { x: 750, y: 980 }, { x: 250, y: 980 }];
    expect(planDisplayCrop(low, 3000, 4000)).toEqual({ ok: false, reason: 'no_margin' });
  });

  it('crops a correctly outlined card to card shape, centred, holding the whole outline', () => {
    // 1500 x 2100 px card (0.714) near the top of a 3000x4000 photo: room above is
    // only ~6% of the card height, so every side gets that same smaller margin.
    const card = [{ x: 250, y: 60 }, { x: 750, y: 60 }, { x: 750, y: 585 }, { x: 250, y: 585 }];
    const plan = planDisplayCrop(card, 3000, 4000);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const { left, top, width, height } = plan.box;
    expect(width / height).toBeCloseTo(1500 / 2100, 2);
    expect(left).toBeLessThanOrEqual(750);
    expect(top).toBeLessThanOrEqual(240);
    expect(left + width).toBeGreaterThanOrEqual(2250);
    expect(top + height).toBeGreaterThanOrEqual(2340);
    // Centred: equal margins left/right and top/bottom (within rounding).
    expect(Math.abs((750 - left) - (left + width - 2250))).toBeLessThanOrEqual(2);
    expect(Math.abs((240 - top) - (top + height - 2340))).toBeLessThanOrEqual(2);
  });

  it('accepts a landscape card', () => {
    // 2800 x 2000 px (1.40) in a 4000x3000 landscape photo.
    const wide = [{ x: 150, y: 167 }, { x: 850, y: 167 }, { x: 850, y: 833 }, { x: 150, y: 833 }];
    const plan = planDisplayCrop(wide, 4000, 3000);
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(isCardShaped(plan.box.width, plan.box.height)).toBe(true);
  });
});

describe('isCardShaped', () => {
  it.each([
    [2.5, 3.5, true], [3.5, 2.5, true], [59, 86, true], [1500, 2000, true],
    [834, 1076, false], [1606, 2000, false], [743, 829, false], [1284, 2000, false], [0, 10, false],
  ])('%s x %s -> %s', (w, h, ok) => {
    expect(isCardShaped(w, h)).toBe(ok);
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
