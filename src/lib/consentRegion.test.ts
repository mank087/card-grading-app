import { afterEach, describe, expect, it } from 'vitest'
import { consentModeFor, parseRegion, regionForCountry } from './consentRegion'

const FLAG = 'NEXT_PUBLIC_CONSENT_US_OPTOUT'
const original = process.env[FLAG]

afterEach(() => {
  if (original === undefined) delete process.env[FLAG]
  else process.env[FLAG] = original
})

describe('regionForCountry', () => {
  it('buckets EEA, UK and Switzerland as eu', () => {
    for (const cc of ['DE', 'fr', 'IE', 'NO', 'IS', 'LI', 'GB', 'CH']) {
      expect(regionForCountry(cc)).toBe('eu')
    }
  })
  it('buckets the United States as us and everything else as other', () => {
    expect(regionForCountry('US')).toBe('us')
    expect(regionForCountry('CA')).toBe('other')
    expect(regionForCountry('AU')).toBe('other')
    expect(regionForCountry('JP')).toBe('other')
  })
  it('is unknown when the header is missing', () => {
    expect(regionForCountry(null)).toBe('unknown')
    expect(regionForCountry('')).toBe('unknown')
  })
})

describe('parseRegion', () => {
  it('rejects anything but the four buckets', () => {
    expect(parseRegion('eu')).toBe('eu')
    expect(parseRegion('US')).toBe('unknown')
    expect(parseRegion('garbage')).toBe('unknown')
    expect(parseRegion(undefined)).toBe('unknown')
  })
})

describe('consentModeFor', () => {
  it('is strict everywhere while the flag is off', () => {
    delete process.env[FLAG]
    expect(consentModeFor('us', false)).toBe('strict')
    expect(consentModeFor('eu', false)).toBe('strict')
    expect(consentModeFor('other', false)).toBe('strict')
    expect(consentModeFor('unknown', false)).toBe('strict')
  })
  it('only the US switches to opt-out when the flag is on', () => {
    process.env[FLAG] = '1'
    expect(consentModeFor('us', false)).toBe('us-optout')
    expect(consentModeFor('eu', false)).toBe('strict')
    expect(consentModeFor('other', false)).toBe('strict')
    expect(consentModeFor('unknown', false)).toBe('strict')
  })
  it('GPC forces strict even in the US with the flag on', () => {
    process.env[FLAG] = '1'
    expect(consentModeFor('us', true)).toBe('strict')
  })
})
