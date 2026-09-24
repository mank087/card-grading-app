import { describe, expect, it } from 'vitest';
import { describeDeclinedEnsemble } from './declinedEnsemble';
import { incompleteInspectionFromErrorMessage, incompleteInspectionMessage } from './inspectionMessageText';

const declined = (over: any = {}) => ({
  card_presence_validation: { front_card_detected: true, back_card_detected: true, front_validation_notes: '', back_validation_notes: '' },
  alteration_detection: { marking_detected: false },
  final_grade: { decimal_grade: null, summary: '' },
  ...over,
});

describe('why the evaluations declined', () => {
  it('returns null when every evaluation scored', () => {
    expect(describeDeclinedEnsemble([{}, {}, {}], [false, false, false])).toBeNull();
  });

  it('a photo with no card in it (production: a selfie as the back photo)', () => {
    const d = describeDeclinedEnsemble([declined({ card_presence_validation: { front_card_detected: true, back_card_detected: false, back_validation_notes: 'A person\'s face, not a card.' } })], [true]);
    expect(d).toMatchObject({ reason: 'no_card' });
    expect(d!.note).toMatch(/back photo/);
  });

  it('front and back of two different cards', () => {
    const d = describeDeclinedEnsemble([declined({ final_grade: { summary: 'The front and back images show two different cards, so no grade is assigned.' } })], [true]);
    expect(d!.reason).toBe('different_cards');
  });

  it('several cards in one photo, and items that are not trading cards', () => {
    expect(describeDeclinedEnsemble([declined({ final_grade: { summary: 'Multiple cards appear in each photo.' } })], [true])!.reason).toBe('multiple_cards');
    expect(describeDeclinedEnsemble([declined({ final_grade: { summary: 'This is a comic book, not a trading card.' } })], [true])!.reason).toBe('not_a_card');
  });

  it('a claimed added marking carries the claim for verification (production Espeon: a printed outline)', () => {
    const d = describeDeclinedEnsemble([
      declined({ alteration_detection: { marking_detected: true, marking_location: 'front', marking_description: 'Turquoise-blue hand-applied lines cross the artwork.' } }),
      { final_grade: { decimal_grade: 1 } },
    ], [true, false]);
    expect(d).toMatchObject({ reason: 'suspected_alteration', declined: 1 });
    expect(d!.markingClaims[0]).toMatch(/^surface front marking: /);
  });

  it('names the specific reason from the notes even when the no-card flag is set (production notes, Sept 19-23)', () => {
    const noCard = (front: string, back: string) => declined({ card_presence_validation: {
      front_card_detected: false, back_card_detected: false, front_validation_notes: front, back_validation_notes: back } });
    const cases: Array<[string, string, string]> = [
      ['The image shows the front cover of an Archie comic magazine, not a physical trading card.', 'The image shows the back cover of the same Archie comic magazine, not a physical trading card.', 'not_a_card'],
      ['Multiple Pokemon cards are visible simultaneously, so no single target card is uniquely identifiable for grading.', 'Multiple Pokemon card backs are visible simultaneously.', 'multiple_cards'],
      ['Two distinct trading cards are shown: Zeraora V and Hisuian Zoroark VSTAR. A single target card is not specified, and neither image is a card back.', 'No card back image was submitted.', 'different_cards'],
      ['The image shows a blurred printed worksheet or page with text and graphics, not a physical trading card.', 'The image shows a green printed document or worksheet with text, not the back of a physical trading card.', 'no_card'],
    ];
    for (const [front, back, reason] of cases) expect(describeDeclinedEnsemble([noCard(front, back)], [true])!.reason).toBe(reason);
    const selfie = declined({ card_presence_validation: { front_card_detected: true, back_card_detected: false, back_validation_notes: 'The second image shows a person rather than the back of a trading card.' } });
    expect(describeDeclinedEnsemble([selfie], [true])!.reason).toBe('no_card');
  });

  it('no stated reason stays unknown (generic retake advice)', () => {
    expect(describeDeclinedEnsemble([declined()], [true])!.reason).toBe('unknown');
  });
});

describe('owner message for each reason', () => {
  it('names the reason instead of blaming the photos', () => {
    const body = (inspection_reason: string | null) => ({ code: 'INSPECTION_INCOMPLETE', inspection_incomplete: true, credit_refunded: true, inspection_reason });
    expect(incompleteInspectionMessage(body('different_cards'))).toMatch(/^The front and back photos appear to show two different cards\. Your grading credit was refunded\./);
    expect(incompleteInspectionMessage(body('altered_marking'))).toMatch(/added to this card after it was printed/);
    expect(incompleteInspectionMessage(body(null))).toMatch(/Retake both photos/);
    expect(incompleteInspectionMessage(body('something_new'))).toMatch(/Retake both photos/);
  });

  it('reads the reason back from the stored error message', () => {
    expect(incompleteInspectionFromErrorMessage('Inspection incomplete (ensemble). [no_card] ...')).toMatch(/^We could not find a trading card in one of the photos\./);
    expect(incompleteInspectionFromErrorMessage('Inspection incomplete (zoom). We could not finish ...')).toMatch(/Retake both photos/);
  });
});
