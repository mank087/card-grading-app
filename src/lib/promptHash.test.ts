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
// do not matter). Pinned at DCM_Grading_v9.37.
const PROMPTS_DIR = fileURLToPath(new URL('../../prompts/', import.meta.url));

const PINNED: Record<string, string> = {
  'master_grading_rubric_v5.txt': 'a05aef56b7921c81c7e5fdf28a5f0d555c563700fc93336ba95b5d3d00193eac',
  'lorcana_delta_v5.txt': '61d54b04268ee9fdf77dbba84bcf251e40302067ed9220ef8a9cf90f43f9ef34',
  'mtg_delta_v5.txt': 'd565f6ec152ef2c98b32a5cc3ad7988d5d8cb1bab0ce03540015362d371eb9ae',
  'onepiece_delta_v5.txt': '146a219963aba059cf6fb36a40bb950801b0f5669f8a8f9abb23fb3b5a802561',
  'other_delta_v5.txt': 'b22e293bd4ed50d6f72f317cbc537ad0a86b16993aaa8543d3fc22ad81280a76',
  'pokemon_delta_v5.txt': 'b40e4bef62a7b9ad95e9b28b5e8171e1a89f3e9413140ef6a81a35ecdede0fc1',
  'sports_delta_v5.txt': '8928f0fe493ad5f3198c05d8acf5a52daf460d9390db76217e663f23ce2fb8cc',
  'yugioh_delta_v5.txt': '713a596161f3523e8157418c20dfd48d3b5001689e0947cffe7498f6bab7ee03',
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
