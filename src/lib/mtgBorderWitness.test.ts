import { describe, expect, it } from 'vitest';
import { applyBorderWitness, borderContradicts, type MatchResult } from './mtgCardMatcher';

const print = (over: Record<string, unknown>) => ({ id: String(over.id), oracle_id: 'o1', name: 'Animate Dead', flavor_name: null, border_color: 'black', collector_number: '92', set_name: 'Limited Edition Alpha', set_code: 'lea', ...over }) as any;
const alpha = print({ id: 'lea', set_name: 'Limited Edition Alpha', set_code: 'lea', border_color: 'black', collector_number: '92' });
const beta = print({ id: 'leb', set_name: 'Limited Edition Beta', set_code: 'leb', border_color: 'black', collector_number: '92' });
const unlimited = print({ id: '2ed', set_name: 'Unlimited Edition', set_code: '2ed', border_color: 'white', collector_number: '92' });
const revised = print({ id: '3ed', set_name: 'Revised Edition', set_code: '3ed', border_color: 'white', collector_number: '93' });
const prints = async () => [alpha, beta, unlimited, revised];
const match = (card: any): MatchResult => ({ card, score: 1, confidence: { setCodeMatched: false, setCodeScore: 0, numberMatched: false, numberScore: 0, nameMatched: true, nameScore: 1, overallConfidence: 'high', matchedFeatures: 1, totalFeatures: 3, warnings: [] } });

describe('border witness', () => {
  it('only the strong pairs contradict', () => {
    expect(borderContradicts('white', 'black')).toBe(true);
    expect(borderContradicts('white', 'silver')).toBe(true);
    expect(borderContradicts('black', 'white')).toBe(true);
    expect(borderContradicts('black', 'borderless')).toBe(false);
    expect(borderContradicts('borderless', 'black')).toBe(false);
    expect(borderContradicts('unclear', 'black')).toBe(false);
    expect(borderContradicts(null, 'black')).toBe(false);
  });

  it('a white-bordered card linked to Alpha is re-picked by the read number (Revised #93)', async () => {
    const r = await applyBorderWitness(match(alpha), 'white', '93', prints);
    expect(r.card?.set_name).toBe('Revised Edition');
    expect(r.confidence.overallConfidence).toBe('high');
    expect(r.confidence.warnings.join(' ')).toMatch(/Border witness/);
  });

  it('with no number and several white printings, the link is dropped and the candidates go to visual disambiguation', async () => {
    const r = await applyBorderWitness(match(alpha), 'white', null, prints);
    expect(r.card).toBeNull();
    expect(r.confidence.overallConfidence).toBe('low');
    expect(r.printCandidates?.map(p => p.set_name)).toEqual(['Unlimited Edition', 'Revised Edition']);
  });

  it('a single consistent printing is taken at medium', async () => {
    const r = await applyBorderWitness(match(alpha), 'white', null, async () => [alpha, revised]);
    expect(r.card?.set_name).toBe('Revised Edition');
    expect(r.confidence.overallConfidence).toBe('medium');
  });

  it('keeps the link when no printing of the card has the observed border (Chrome Mox silver frame read as white)', async () => {
    const mox = print({ id: 'mrd', name: 'Chrome Mox', set_name: 'Mirrodin', border_color: 'black', collector_number: '152' });
    const r = await applyBorderWitness(match(mox), 'white', '152', async () => [mox, print({ id: 'ema', name: 'Chrome Mox', set_name: 'Eternal Masters', border_color: 'black', collector_number: '220' })]);
    expect(r.card?.id).toBe('mrd');
    expect(r.confidence.overallConfidence).toBe('high');
    expect(r.confidence.warnings.join(' ')).toMatch(/link kept/);
  });

  it('leaves consistent and borderless links alone, and does nothing without a card', async () => {
    expect((await applyBorderWitness(match(alpha), 'black', '92', prints)).card?.id).toBe('lea');
    expect((await applyBorderWitness(match(print({ id: 'sld', border_color: 'borderless' })), 'black', null, prints)).card?.id).toBe('sld');
    expect((await applyBorderWitness(match(null), 'white', null, prints)).card).toBeNull();
  });
});
