import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Pins the exact text of the live grading prompts (the master rubric is the system prompt on
// every grade; one category delta is appended). A prompt change is a grading change: it must
// update the pin below DELIBERATELY, together with a DCM_PROMPT_VERSION bump in
// src/lib/visionGrader.ts and a calibration run against the frozen cases. Do not regenerate
// these hashes just to make the test pass.
// Hashes are sha256 of the file text with CRLF normalised to LF (so checkout line endings
// do not matter). Pinned at DCM_Grading_v9.37; the Pokemon, MTG, One Piece and Yu-Gi-Oh deltas
// re-pinned at DCM_Grading_v9.42 (printed-feature guards); Pokemon and Sports deltas re-pinned
// at DCM_Grading_v9.47 (Japanese old-back expansion symbol; jersey number is not the card number).
const PROMPTS_DIR = fileURLToPath(new URL('../../prompts/', import.meta.url));

const PINNED: Record<string, string> = {
  'master_grading_rubric_v5.txt': 'd0e7bcdf978fd4a1aa81fb7535c75f65d63a9337be1b9eb5a821dd30e8b8b8db',
  'lorcana_delta_v5.txt': '61d54b04268ee9fdf77dbba84bcf251e40302067ed9220ef8a9cf90f43f9ef34',
  'mtg_delta_v5.txt': '07964d905a4de11b7c8843e1fb299ee3d01edf3cc677e97e02095a9efce00196',
  'onepiece_delta_v5.txt': '3663226c318a3cff790e8cb73e456b278eb19df95659f541ad5b272fdde5be47',
  'other_delta_v5.txt': 'b22e293bd4ed50d6f72f317cbc537ad0a86b16993aaa8543d3fc22ad81280a76',
  'pokemon_delta_v5.txt': 'dd9182d0cfb8b6ec0525b8f384aadc459a2b75ae3aa33e8562bea6cb17e06d42',
  'sports_delta_v5.txt': 'b46eb0210b0226a0b477a92313851cb2ec03aa0de58546372448c6f0cc606c2d',
  'yugioh_delta_v5.txt': 'e191d41ad53b995dfad5d8cdf4d0f465d09c151795192b2dfa05b3477315b5a1',
};

const read = (file: string) => readFileSync(PROMPTS_DIR + file, 'utf8').replace(/\r\n/g, '\n');
const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

describe('live grading prompt pin', () => {
  it('pins every master/delta prompt file that exists', () => {
    const live = readdirSync(PROMPTS_DIR).filter(n => /^(master_grading_rubric|.+_delta)_v5\.txt$/.test(n)).sort();
    expect(live).toEqual(Object.keys(PINNED).sort());
  });

  it.each(Object.entries(PINNED))('%s matches its pinned sha256', (file, hash) => {
    expect(sha256(read(file))).toBe(hash);
  });

  it('keeps the master under 300,000 characters and each delta under 60,000', () => {
    expect(read('master_grading_rubric_v5.txt').length).toBeLessThan(300_000);
    for (const file of Object.keys(PINNED).filter(f => f.endsWith('_delta_v5.txt'))) {
      expect(read(file).length, file).toBeLessThan(60_000);
    }
  });
});
