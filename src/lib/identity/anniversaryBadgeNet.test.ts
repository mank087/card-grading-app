import { describe, expect, it, vi } from 'vitest';
import {
  badgeNetOutcome, findClassicTwins, needsBadgeCheck, resolveBadgeKind, reusableCheck, runBadgeNet, samePrintedFraction, type ClassicTwin,
} from './anniversaryBadgeNet';

const TWINS: ClassicTwin[] = [
  { id: 'me55c-58', name: 'Pikachu', set_id: 'me55c', printed: '58/102', badge: '30' },
  { id: 'me55c-4', name: 'Charizard', set_id: 'me55c', printed: '4/102', badge: '30' },
  { id: 'cel25c-4_A', name: 'Charizard', set_id: 'cel25c', printed: '4/102', badge: '25' },
  { id: 'me55c-149', name: 'Lugia', set_id: 'me55c', printed: '149/147', badge: '30' },
  { id: 'cel25c-24_A', name: "_____'s Pikachu", set_id: 'cel25c', printed: '24', badge: '25' },
];

describe('twin detection', () => {
  it('matches name + printed fraction', () => {
    expect(findClassicTwins('Pikachu', '58/102', TWINS).map(t => t.id)).toEqual(['me55c-58']);
    expect(findClassicTwins('Charizard', '004/102', TWINS).map(t => t.id)).toEqual(['me55c-4', 'cel25c-4_A']);
    expect(findClassicTwins('Lugia', '149', TWINS).map(t => t.id)).toEqual(['me55c-149']);
  });
  it('does not match another denominator, another name, or a bare twin number against a fraction', () => {
    expect(findClassicTwins('Pikachu', '58/130', TWINS)).toEqual([]);
    expect(findClassicTwins('Raichu', '58/102', TWINS)).toEqual([]);
    expect(findClassicTwins('Pikachu', '024/198', TWINS)).toEqual([]);
    expect(findClassicTwins('', '58/102', TWINS)).toEqual([]);
  });
  it('compares fractions without leading zeros', () => {
    expect(samePrintedFraction('058/102', '58/102')).toBe(true);
    expect(samePrintedFraction('58/102', '59/102')).toBe(false);
  });
});

describe('when to ask', () => {
  const twins = [TWINS[0]];
  it('asks for a twin match with no badge reported', () => {
    expect(needsBadgeCheck({ info: { printed_badge: null }, matchedSetId: 'base1', twins, ownerConfirmed: false })).toBe(true);
    expect(needsBadgeCheck({ info: {}, matchedSetId: null, twins, ownerConfirmed: false })).toBe(true);
  });
  it.each([
    [{ info: { printed_badge: '30' }, matchedSetId: 'base1', twins, ownerConfirmed: false }],
    [{ info: { first_look_printed_badge: '30' }, matchedSetId: 'base1', twins, ownerConfirmed: false }],
    [{ info: { printed_badge: 'pumpkin' }, matchedSetId: 'base1', twins, ownerConfirmed: false }],
    [{ info: {}, matchedSetId: 'me55c', twins, ownerConfirmed: false }],
    [{ info: {}, matchedSetId: 'base1', twins: [], ownerConfirmed: false }],
    [{ info: {}, matchedSetId: 'base1', twins, ownerConfirmed: true }],
  ])('does not ask: %j', input => {
    expect(needsBadgeCheck(input as any)).toBe(false);
  });
});

describe('what the verdict does', () => {
  const charizards = TWINS.slice(1, 3); // in BOTH Classic Collections
  it('a seen badge with one possible kind re-scopes to it, whatever the digits were read as', () => {
    expect(badgeNetOutcome({ answer: 'yes', badge: '25' }, [TWINS[0]])).toEqual({ action: 'rescope', badge: '30', certain: true });
    expect(badgeNetOutcome({ answer: 'yes', badge: null }, [TWINS[3]])).toEqual({ action: 'rescope', badge: '30', certain: true });
  });
  it('both kinds possible: certain only when the border and the digits agree', () => {
    expect(badgeNetOutcome({ answer: 'yes', badge: '30', sparkle_border: true }, charizards)).toEqual({ action: 'rescope', badge: '30', certain: true });
    expect(badgeNetOutcome({ answer: 'yes', badge: '25', sparkle_border: false }, charizards)).toEqual({ action: 'rescope', badge: '25', certain: true });
    expect(badgeNetOutcome({ answer: 'yes', badge: '25', sparkle_border: true }, charizards)).toEqual({ action: 'rescope', badge: '25', certain: false });
    expect(badgeNetOutcome({ answer: 'yes', badge: '25', sparkle_border: null }, charizards)).toEqual({ action: 'rescope', badge: '25', certain: false });
    expect(badgeNetOutcome({ answer: 'yes', badge: null, sparkle_border: true }, charizards)).toEqual({ action: 'rescope', badge: '30', certain: false });
    expect(badgeNetOutcome({ answer: 'yes', badge: null, sparkle_border: null }, charizards)).toEqual({ action: 'keep_low' });
  });
  it('no keeps, unclear keeps at low, a failed check keeps untouched', () => {
    expect(badgeNetOutcome({ answer: 'no', badge: null }, [TWINS[0]])).toEqual({ action: 'keep' });
    expect(badgeNetOutcome({ answer: 'unclear', badge: null }, [TWINS[0]])).toEqual({ action: 'keep_low' });
    expect(badgeNetOutcome(null, [TWINS[0]])).toEqual({ action: 'keep' });
  });
  it('resolveBadgeKind with no candidates falls back to the digits, uncertain', () => {
    expect(resolveBadgeKind({ answer: 'yes', badge: '30' }, [])).toEqual({ badge: '30', certain: false });
    expect(resolveBadgeKind({ answer: 'no', badge: null }, ['30'])).toBeNull();
  });
  it('reuses a stored verdict only for the same printed number', () => {
    const stored = { answer: 'no', badge: null, where: null, for_number: '58/102', at: 't' };
    expect(reusableCheck(stored, '058/102')).toEqual(stored);
    expect(reusableCheck(stored, '4/102')).toBeNull();
    expect(reusableCheck({ answer: 'maybe' }, '58/102')).toBeNull();
  });
});

describe('runBadgeNet', () => {
  const deps = (answer: any) => ({
    loadTwins: vi.fn(async () => TWINS),
    loadFront: vi.fn(async () => Buffer.from('jpeg')),
    check: vi.fn(async () => answer && { ...answer, model: 'm', tokens: { in: 1, out: 1 }, ms: 1 }),
  });
  const base = { info: {}, name: 'Pikachu', printed: '58/102', matchedSetId: 'base1', ownerConfirmed: false, stored: null };

  it('asks once and returns a storable verdict', async () => {
    const d = deps({ answer: 'yes', badge: '30', where: 'lower-left' });
    const r = await runBadgeNet({} as any, 'card-1', base, d);
    expect(r?.outcome).toEqual({ action: 'rescope', badge: '30', certain: true });
    expect(r?.fresh).toBe(true);
    expect(r?.stored).toMatchObject({ answer: 'yes', badge: '30', for_number: '58/102' });
    expect(d.check).toHaveBeenCalledTimes(1);
  });
  it('uses the stored verdict instead of asking again', async () => {
    const d = deps({ answer: 'yes', badge: '30', where: null });
    const r = await runBadgeNet({} as any, 'card-1', { ...base, stored: { answer: 'no', badge: null, where: null, for_number: '58/102', at: 't' } }, d);
    expect(r?.outcome).toEqual({ action: 'keep' });
    expect(r?.fresh).toBe(false);
    expect(d.check).not.toHaveBeenCalled();
  });
  it('does nothing for a card with no twin, and never throws', async () => {
    expect(await runBadgeNet({} as any, 'c', { ...base, name: 'Raichu' }, deps(null))).toBeNull();
    const broken = { loadTwins: vi.fn(async () => { throw new Error('db down'); }) };
    expect(await runBadgeNet({} as any, 'c', base, broken as any)).toBeNull();
  });
  it('a failed check leaves the match untouched and stores nothing', async () => {
    const r = await runBadgeNet({} as any, 'c', base, deps(null));
    expect(r?.outcome).toEqual({ action: 'keep' });
    expect(r?.stored).toBeNull();
  });
});
