import { describe, expect, it } from 'vitest';
import { readIncompleteInspectionMessage } from './inspectionMessage';
describe('customer inspection outcome', () => {
  it('shows next steps and confirmed refund without consuming the original body', async () => {
    const response = Response.json({ code: 'INSPECTION_INCOMPLETE', inspection_incomplete: true, credit_refunded: true }, { status: 500 });
    const message = await readIncompleteInspectionMessage(response);
    expect(message).toContain('Your grading credit was refunded.');
    expect(message).toContain('Retake both photos');
    expect(message).toContain('contact support');
    expect((await response.json()).code).toBe('INSPECTION_INCOMPLETE');
  });
  it('does not promise a refund when it failed or is unknown', async () => {
    for (const credit_refunded of [false, undefined]) {
      const message = await readIncompleteInspectionMessage(Response.json({ code: 'INSPECTION_INCOMPLETE', inspection_incomplete: true, credit_refunded }));
      expect(message).not.toContain('refunded');
      expect(message).toContain('contact support before submitting');
      expect(message).not.toMatch(/retry|retake/i);
    }
  });
  it('leaves unrelated and malformed errors to existing handling', async () => {
    expect(await readIncompleteInspectionMessage(Response.json({ error: 'other' }))).toBeNull();
    expect(await readIncompleteInspectionMessage(new Response('not json'))).toBeNull();
  });
  it('explains an uncharged failed web regrade without promising a refund', async () => {
    const message = await readIncompleteInspectionMessage(Response.json({ code: 'INSPECTION_INCOMPLETE',
      inspection_incomplete: true, credit_refunded: false, credit_refund_status: 'not_charged' }));
    expect(message).toContain('No grading credit was charged for this attempt.');
    expect(message).not.toContain('could not confirm');
  });
});
