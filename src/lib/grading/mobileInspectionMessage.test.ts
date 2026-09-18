/** The mobile copy of the incomplete-inspection wording must say exactly what the web says. */
import { describe, expect, it } from 'vitest';
import { incompleteInspectionMessage, incompleteInspectionFromErrorMessage } from '../../../dcm-mobile/lib/inspectionMessage';
import { readIncompleteInspectionMessage } from './inspectionMessage';

const body = (over: Record<string, unknown>) => ({ code: 'INSPECTION_INCOMPLETE', inspection_incomplete: true, ...over });
const asResponse = (data: unknown) => new Response(JSON.stringify(data), { status: 500, headers: { 'content-type': 'application/json' } });

describe('mobile incomplete-inspection wording', () => {
  it('matches the web for refunded, not charged and unconfirmed', async () => {
    for (const data of [body({ credit_refunded: true }), body({ credit_refund_status: 'not_charged' }), body({ credit_refunded: false, credit_refund_status: 'failed' })]) {
      expect(incompleteInspectionMessage(data)).toBe(await readIncompleteInspectionMessage(asResponse(data)));
    }
  });
  it('ignores ordinary failures and never claims a refund from the card row alone', () => {
    expect(incompleteInspectionMessage({ code: 'SOMETHING_ELSE' })).toBeNull();
    expect(incompleteInspectionMessage(null)).toBeNull();
    const fromRow = incompleteInspectionFromErrorMessage('Inspection incomplete (zoom). A reliable grade could not be completed.');
    expect(fromRow).toContain('Inspection incomplete');
    expect(fromRow).not.toMatch(/refunded/i);
    expect(incompleteInspectionFromErrorMessage('Grading timed out')).toBeNull();
  });
});
