/**
 * Drift guard for the capture-gate reason codes.
 *
 * dcm-mobile is a separate package and cannot import from this one, so
 * dcm-mobile/lib/captureReasonCodes.ts is a hand-maintained mirror. This test
 * is the only thing preventing the two from quietly disagreeing.
 *
 * Why that matters more than it looks: a renamed or missing code does not
 * throw anywhere. It splits one rule's telemetry across two buckets, so a
 * per-rule false-positive rate — the number that gates enforcement — reads
 * lower than it truly is. The failure mode is a gate promoted on bad evidence,
 * not a crash.
 *
 * Reads the mirror as TEXT rather than importing it, because the mobile
 * package is excluded from this project's module resolution.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CAPTURE_REASON_CODES,
  CAPTURE_REASON_MESSAGES,
  HARD_REJECT_CODES,
  FAIL_OPEN_CODES,
  isHardReject,
  type CaptureReasonCode,
} from './captureReasonCodes';

const MIRROR_PATH = join(process.cwd(), 'dcm-mobile', 'lib', 'captureReasonCodes.ts');

function readMirror(): string {
  return readFileSync(MIRROR_PATH, 'utf8');
}

/** Pull the quoted entries out of the mirror's CAPTURE_REASON_CODES array. */
function mirrorCodes(src: string): string[] {
  const block = src.match(/CAPTURE_REASON_CODES\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!block) throw new Error('mirror: CAPTURE_REASON_CODES array not found');
  return [...block[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
}

/** Pull `key: 'message'` pairs out of the mirror's message map. */
function mirrorMessages(src: string): Record<string, string> {
  const block = src.match(/CAPTURE_REASON_MESSAGES[^=]*=\s*\{([\s\S]*?)\n\}/);
  if (!block) throw new Error('mirror: CAPTURE_REASON_MESSAGES object not found');
  const out: Record<string, string> = {};
  for (const m of block[1].matchAll(/^\s*([a-z_]+):\s*'((?:[^'\\]|\\.)*)',?\s*$/gm)) {
    out[m[1]] = m[2].replace(/\\'/g, "'");
  }
  return out;
}

describe('capture reason codes', () => {
  it('every code has a customer-facing message', () => {
    for (const code of CAPTURE_REASON_CODES) {
      const msg = CAPTURE_REASON_MESSAGES[code];
      expect(msg, `missing message for ${code}`).toBeTruthy();
      expect(msg.length, `message for ${code} is too terse to act on`).toBeGreaterThan(20);
    }
  });

  it('has no duplicate codes', () => {
    expect(new Set(CAPTURE_REASON_CODES).size).toBe(CAPTURE_REASON_CODES.length);
  });

  it('hard-reject and fail-open sets are disjoint', () => {
    // A code that could both block a submission and mean "we could not
    // measure" is the exact confusion this vocabulary exists to prevent.
    for (const code of FAIL_OPEN_CODES) {
      expect(isHardReject(code), `${code} must never hard-reject`).toBe(false);
    }
    for (const code of HARD_REJECT_CODES) {
      expect(FAIL_OPEN_CODES).not.toContain(code);
    }
  });

  it('every hard-reject and fail-open code is a real code', () => {
    const known = new Set<string>(CAPTURE_REASON_CODES);
    for (const code of [...HARD_REJECT_CODES, ...FAIL_OPEN_CODES]) {
      expect(known.has(code), `${code} is not in CAPTURE_REASON_CODES`).toBe(true);
    }
  });

  describe('dcm-mobile mirror', () => {
    it('declares exactly the same codes, in the same order', () => {
      expect(mirrorCodes(readMirror())).toEqual([...CAPTURE_REASON_CODES]);
    });

    it('declares identical messages', () => {
      const mirrored = mirrorMessages(readMirror());
      for (const code of CAPTURE_REASON_CODES) {
        expect(mirrored[code], `mirror is missing a message for ${code}`).toBe(
          CAPTURE_REASON_MESSAGES[code as CaptureReasonCode]
        );
      }
      expect(Object.keys(mirrored).sort()).toEqual([...CAPTURE_REASON_CODES].sort());
    });
  });
});
