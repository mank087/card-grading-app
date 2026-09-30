import { describe, expect, it } from 'vitest';
import { searchKnowledge } from './helpBotSearch';
import { knowledgeBase } from '@/components/helpbot/helpBotKnowledge';
const top = (q: string) => searchKnowledge(q, knowledgeBase)[0]?.entry.id;

describe('help chat: sign-in and confirmation email questions', () => {
  for (const q of ["I didn't get my confirmation email", "can't sign in to my account", 'my messages were rejected, trying to set up an account', 'never got the verification link']) {
    it(`"${q}" answers with the confirmation-email entry`, () => {
      expect(top(q)).toBe('confirmation-email');
    });
  }
  it('"how do I contact support" still answers with contact-support', () => {
    expect(top('how do I contact support')).toBe('contact-support');
  });
});
