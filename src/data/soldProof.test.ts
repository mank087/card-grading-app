import { describe, expect, it } from 'vitest'
import { SOLD_PROOF, soldProofFor } from './soldProof'

const [tens, sportsEightPlus, ninesAndTens] = SOLD_PROOF.stats

describe('soldProofFor', () => {
  it('gives DCM 10s the DCM 10 stat in every category', () => {
    expect(soldProofFor(10, 'Pokemon')).toBe(tens)
    expect(soldProofFor('10', 'Sports')).toBe(tens)
  })

  it('gives sports cards graded 8 or 9 the sports stat', () => {
    expect(soldProofFor(8, 'Sports')).toBe(sportsEightPlus)
    expect(soldProofFor(9, 'Baseball')).toBe(sportsEightPlus)
  })

  it('gives other DCM 9s the 9-and-10 stat', () => {
    expect(soldProofFor(9, 'MTG')).toBe(ninesAndTens)
    expect(soldProofFor(9, null)).toBe(ninesAndTens)
  })

  // Below DCM 8 (and non-sports 8s) the sales data does not support a premium claim.
  it('makes no claim for grades the data does not support', () => {
    expect(soldProofFor(8, 'Pokemon')).toBeNull()
    expect(soldProofFor(7, 'Sports')).toBeNull()
    expect(soldProofFor(1, 'Sports')).toBeNull()
    expect(soldProofFor(null, 'Sports')).toBeNull()
    expect(soldProofFor('pending', 'Sports')).toBeNull()
  })
})
