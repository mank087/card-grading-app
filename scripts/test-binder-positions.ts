/**
 * Unit tests for binder fractional indexing.
 * The whole ordering feature rests on this file behaving correctly under
 * repeated inserts into the same gap, so it gets a real test rather than a
 * "looks right" reading.
 */
import {
  MIN_GAP,
  POSITION_STEP,
  neighboursForDrop,
  positionAfterMax,
  positionBetween,
  rebalancedPositions,
} from '../src/lib/binders/position';

let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`);
};

// --- basic placement ---
check('empty list gets STEP', positionBetween({ before: null, after: null }) === POSITION_STEP);
check('append goes past the max', positionBetween({ before: 2048, after: null }) === 2048 + POSITION_STEP);
check('front-insert halves the first', positionBetween({ before: null, after: 1024 }) === 512);
check('midpoint between two', positionBetween({ before: 1024, after: 2048 }) === 1536);
check('positionAfterMax on empty', positionAfterMax(null) === POSITION_STEP);

// --- ordering is preserved through repeated midpoint inserts ---
{
  let list = [1024, 2048, 3072];
  for (let i = 0; i < 25; i++) {
    const p = positionBetween({ before: list[0], after: list[1] });
    if (p === null) break;
    list.splice(1, 0, p);
  }
  const sorted = [...list].sort((a, b) => a - b);
  check('repeated inserts stay strictly ordered',
    list.every((v, i) => v === sorted[i]) && new Set(list).size === list.length,
    `len=${list.length} uniq=${new Set(list).size}`);
}

// --- the rebalance guard actually fires before precision dies ---
{
  let before = 1024, after = 1025, inserts = 0, hitGuard = false;
  for (let i = 0; i < 200; i++) {
    const p = positionBetween({ before, after });
    if (p === null) { hitGuard = true; break; }
    // Two cards must never land on the same position.
    if (p === before || p === after) {
      check('collapsed to a duplicate position before the guard fired', false, `p=${p}`);
      break;
    }
    after = p;
    inserts++;
  }
  check('rebalance guard fires instead of colliding', hitGuard, `gave up after ${inserts} inserts`);
  check('guard threshold is sane', MIN_GAP > 0 && MIN_GAP < 1);
}

// --- rebalance output ---
{
  const r = rebalancedPositions(4);
  check('rebalance spacing is even and ascending',
    r.length === 4 && r[0] === POSITION_STEP && r.every((v, i) => i === 0 || v > r[i - 1]),
    JSON.stringify(r));
}

// --- drop-intent resolution ---
{
  const ordered = [
    { card_id: 'a', position: 1024 },
    { card_id: 'b', position: 2048 },
    { card_id: 'c', position: 3072 },
  ];

  check('move to front', JSON.stringify(neighboursForDrop(ordered, 'c', null)) ===
    JSON.stringify({ before: null, after: 1024 }));

  check('move to end (after last)', JSON.stringify(neighboursForDrop(ordered, 'a', 'c')) ===
    JSON.stringify({ before: 3072, after: null }));

  // The moving card must be excluded from its own neighbour calc, or a small
  // move computes a midpoint against itself and doesn't move.
  check('moving card excluded from its own neighbours',
    JSON.stringify(neighboursForDrop(ordered, 'b', 'a')) ===
    JSON.stringify({ before: 1024, after: 3072 }));

  check('stale anchor rejected', neighboursForDrop(ordered, 'a', 'ghost') === null);

  const single = [{ card_id: 'a', position: 1024 }];
  check('single-item list, move to front',
    JSON.stringify(neighboursForDrop(single, 'a', null)) ===
    JSON.stringify({ before: null, after: null }));
}

console.log(failed === 0 ? '\nAll binder position tests passed.' : `\n${failed} test(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
