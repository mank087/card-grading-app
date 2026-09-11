import { describe, expect, it } from 'vitest'
import { applyImageMove, type PairSlot, type PickedFile } from './pairing'

const pf = (id: string): PickedFile => ({ id, file: new File([id], id + '.jpg'), name: id + '.jpg', lastModified: 0, relativePath: '' })
const base: PairSlot[] = [
  { position: 0, front: pf('a-front'), back: pf('b-front') },   // a stray frame shifted card 1's back
  { position: 1, front: pf('a-back'), back: pf('b-back') },
  { position: 2, front: pf('c-front'), back: null },
]
const ids = (m: Map<number, PairSlot>, pos: number) => {
  const p = m.get(pos) ?? base[pos]
  return [p.front?.id ?? null, p.back?.id ?? null]
}

describe('applyImageMove', () => {
  it('swaps two images across cards and keeps both', () => {
    const next = applyImageMove(new Map(), base, { position: 0, side: 'back' }, { position: 1, side: 'front' })
    expect(ids(next, 0)).toEqual(['a-front', 'a-back'])
    expect(ids(next, 1)).toEqual(['b-front', 'b-back'])
    expect(next.has(2)).toBe(false)
  })
  it('moves an image into an empty slot, leaving the source empty', () => {
    const next = applyImageMove(new Map(), base, { position: 1, side: 'back' }, { position: 2, side: 'back' })
    expect(ids(next, 1)).toEqual(['a-back', null])
    expect(ids(next, 2)).toEqual(['c-front', 'b-back'])
  })
  it('swaps front and back when dropped on the same card', () => {
    const next = applyImageMove(new Map(), base, { position: 0, side: 'front' }, { position: 0, side: 'back' })
    expect(ids(next, 0)).toEqual(['b-front', 'a-front'])
  })
  it('is a no-op on the same slot and returns the same map', () => {
    const prev = new Map<number, PairSlot>()
    expect(applyImageMove(prev, base, { position: 0, side: 'front' }, { position: 0, side: 'front' })).toBe(prev)
  })
  it('layers on earlier overrides instead of the base pairing', () => {
    const first = applyImageMove(new Map(), base, { position: 0, side: 'back' }, { position: 1, side: 'front' })
    const second = applyImageMove(first, base, { position: 1, side: 'back' }, { position: 2, side: 'back' })
    expect(ids(second, 0)).toEqual(['a-front', 'a-back'])
    expect(ids(second, 1)).toEqual(['b-front', null])
    expect(ids(second, 2)).toEqual(['c-front', 'b-back'])
  })
  it('ignores an unknown position', () => {
    const prev = new Map<number, PairSlot>()
    expect(applyImageMove(prev, base, { position: 9, side: 'front' }, { position: 0, side: 'front' })).toBe(prev)
  })
})
