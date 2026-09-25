import { classifyEbayErrors, PAUSE_REASONS } from './bulkPublish';

describe('classifyEbayErrors', () => {
  it('holds the batch on the app-wide eBay call limit instead of failing cards (Sept 25)', () => {
    expect(classifyEbayErrors([{ code: '518', message: 'Your application has exceeded usage limit on this call' }])).toBe('ebay_busy');
    expect(PAUSE_REASONS.ebay_busy).toMatch(/Nothing was failed/);
  });
  it('still treats ordinary listing problems as the card\'s own', () => {
    expect(classifyEbayErrors([{ code: '37', message: 'Input data is invalid' }])).toBe('item');
  });
});
