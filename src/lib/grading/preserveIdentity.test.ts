import { describe, test, expect, beforeEach, vi } from 'vitest'
import { preserveIdentityOnRegrade } from './preserveIdentity'

/**
 * Minimal stand-in for the supabase chain the guard uses:
 *   supabase.from('cards').select(cols).eq('id', id).maybeSingle()
 */
function mockSupabase(result: { data?: any; error?: { message: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null })
  return {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  } as any
}

/** A supabase whose very first call throws, exercising the outer catch. */
function throwingSupabase() {
  return { from: () => { throw new Error('connection reset') } } as any
}

const STORED = {
  card_name: 'Charizard',
  card_set: 'Base Set',
  label_data: null,
  conversational_card_info: null,
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('preserveIdentityOnRegrade', () => {
  describe('abort semantics', () => {
    // THE REGRESSION THESE EXIST FOR. `preserved: false` is ambiguous: it covers
    // both "nothing to preserve" and "I could not check". Before `abort`, callers
    // treated them the same and carried on saving -- so a transient read failure
    // let a regrade rename a correctly-identified card, which is precisely the
    // failure this guard was written to prevent.

    test('aborts when the stored identity cannot be read', async () => {
      const payload: Record<string, any> = { card_name: 'Wrong Name' }
      const r = await preserveIdentityOnRegrade(mockSupabase({ error: { message: 'network timeout' } }), 'card-1', payload, { forceRegrade: true })
      expect(r.abort).toBe(true)
      expect(r.preserved).toBe(false)
    })

    test('aborts when the row is simply absent', async () => {
      const r = await preserveIdentityOnRegrade(mockSupabase({ data: null }), 'card-1', { card_name: 'Wrong Name' }, { forceRegrade: true })
      expect(r.abort).toBe(true)
    })

    test('aborts when the guard throws', async () => {
      const r = await preserveIdentityOnRegrade(throwingSupabase(), 'card-1', { card_name: 'Wrong Name' }, { forceRegrade: true })
      expect(r.abort).toBe(true)
    })
  })

  describe('legitimate non-preservation must NOT abort', () => {
    // These three are normal outcomes. Aborting on them would break first grades
    // and deliberate re-identification -- the fail-closed change must be precise
    // about which "false" it is reacting to.

    test('not a regrade', async () => {
      const r = await preserveIdentityOnRegrade(mockSupabase({ data: STORED }), 'card-1', {}, { forceRegrade: false })
      expect(r.preserved).toBe(false)
      expect(r.abort).toBeFalsy()
    })

    test('reidentify was explicitly requested', async () => {
      const r = await preserveIdentityOnRegrade(mockSupabase({ data: STORED }), 'card-1', {}, { forceRegrade: true, reidentify: true })
      expect(r.preserved).toBe(false)
      expect(r.abort).toBeFalsy()
    })

    test('card was never identified in the first place', async () => {
      const r = await preserveIdentityOnRegrade(mockSupabase({ data: { ...STORED, card_name: null } }), 'card-1', { card_name: 'Fresh' }, { forceRegrade: true })
      expect(r.preserved).toBe(false)
      expect(r.abort).toBeFalsy()
    })
  })

  describe('the guard still does its job', () => {
    test('overwrites a renamed card with the stored identity and reports the change', async () => {
      const payload: Record<string, any> = { card_name: 'Kewl Tune', card_set: 'Wrong Set' }
      const r = await preserveIdentityOnRegrade(mockSupabase({ data: STORED }), 'card-1', payload, { forceRegrade: true })
      expect(r.preserved).toBe(true)
      expect(r.abort).toBeFalsy()
      expect(payload.card_name).toBe('Charizard')
      expect(payload.card_set).toBe('Base Set')
      expect(r.changedColumns).toContain('card_name')
    })

    test('reports no changed columns when the regrade agreed with the stored identity', async () => {
      const payload: Record<string, any> = { card_name: 'Charizard', card_set: 'Base Set' }
      const r = await preserveIdentityOnRegrade(mockSupabase({ data: STORED }), 'card-1', payload, { forceRegrade: true })
      expect(r.preserved).toBe(true)
      expect(r.changedColumns).toHaveLength(0)
    })
  })
})
