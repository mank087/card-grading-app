import { describe, expect, it } from 'vitest';
import { BADGE_CHECK_PROMPT, parseBadgeCheck } from './anniversaryBadgeCheck';

describe('parseBadgeCheck', () => {
  it.each([
    ['{"answer":"yes","badge":"30","where":"lower-left of the art box","sparkle_border":true}', { answer: 'yes', badge: '30', where: 'lower-left of the art box', sparkle_border: true }],
    ['{"answer":"YES","badge":25,"where":"near the set symbol","sparkle_border":"false"}', { answer: 'yes', badge: '25', where: 'near the set symbol', sparkle_border: false }],
    ['{"answer":"no","badge":"30","where":"none"}', { answer: 'no', badge: null, where: null, sparkle_border: null }],
    ['{"answer":"unclear","badge":null,"where":"glare over the art"}', { answer: 'unclear', badge: null, where: 'glare over the art', sparkle_border: null }],
    // a badge seen without legible digits is still a "yes": the kind is settled elsewhere
    ['{"answer":"yes","badge":null,"where":"corner"}', { answer: 'yes', badge: null, where: 'corner', sparkle_border: null }],
    ['{"answer":"yes","badge":"pumpkin","where":null}', { answer: 'yes', badge: null, where: null, sparkle_border: null }],
    ['```json\n{"answer":"no","badge":null,"where":null}\n```', { answer: 'no', badge: null, where: null, sparkle_border: null }],
  ])('%s', (text, expected) => {
    expect(parseBadgeCheck(text)).toEqual(expected);
  });

  it.each(['', 'not json', '{"answer":"maybe"}', '[]', 'null'])('rejects %j', text => {
    expect(parseBadgeCheck(text)).toBeNull();
  });

  it('keeps the prompt short and names both badges', () => {
    expect(BADGE_CHECK_PROMPT.length).toBeLessThan(1400);
    expect(BADGE_CHECK_PROMPT).toMatch(/sparkle/);
    expect(BADGE_CHECK_PROMPT).toMatch(/"30"/);
    expect(BADGE_CHECK_PROMPT).toMatch(/"25"/);
  });
});
