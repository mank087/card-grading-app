import { describe, it, expect } from 'vitest';
import { weakestCategory } from './weakestCategory';

describe('weakestCategory', () => {
  it('names the tile that is actually lowest after a hold dragged it (Malik Nabers 030038)', () => {
    expect(weakestCategory({ centering: 9, corners: 10, edges: 10, surface: 10 })).toBe('centering');
  });
  it('breaks ties in report order', () => {
    expect(weakestCategory({ centering: 9, corners: 9, edges: 9, surface: 9 })).toBe('centering');
    expect(weakestCategory({ centering: 10, corners: 8, edges: 8, surface: 9 })).toBe('corners');
  });
  it('ignores missing values and returns null when there are none', () => {
    expect(weakestCategory({ corners: 7, surface: undefined })).toBe('corners');
    expect(weakestCategory({})).toBeNull();
  });
});
