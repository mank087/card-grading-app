/**
 * The app's incomplete-inspection wording must be the web's, byte for byte.
 * Compared as text: importing from dcm-mobile pulls in its Expo tsconfig, which
 * CI does not install.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { incompleteInspectionMessage, incompleteInspectionFromErrorMessage } from './inspectionMessageText';

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

describe('incomplete-inspection wording shared with the mobile app', () => {
  it('is identical in both copies', () => {
    expect(read('dcm-mobile/lib/inspectionMessage.ts')).toBe(read('src/lib/grading/inspectionMessageText.ts'));
  });

  it('says what the server confirmed about the refund, and nothing more', () => {
    const body = (over: Record<string, unknown>) => ({ code: 'INSPECTION_INCOMPLETE', inspection_incomplete: true, ...over });
    expect(incompleteInspectionMessage(body({ credit_refunded: true }))).toContain('Your grading credit was refunded.');
    expect(incompleteInspectionMessage(body({ credit_refund_status: 'not_charged' }))).toContain('No grading credit was charged');
    expect(incompleteInspectionMessage(body({ credit_refunded: false }))).toContain('We could not confirm a credit refund.');
    expect(incompleteInspectionMessage({ code: 'SOMETHING_ELSE' })).toBeNull();
    const fromRow = incompleteInspectionFromErrorMessage('Inspection incomplete (zoom). A reliable grade could not be completed.');
    expect(fromRow).toContain('Inspection incomplete');
    expect(fromRow).not.toMatch(/refunded/i);
    expect(incompleteInspectionFromErrorMessage('Grading timed out')).toBeNull();
  });
});
