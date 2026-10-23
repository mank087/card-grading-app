import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  clickIds: null as Record<string, unknown> | null,
  upserts: [] as Array<Array<Record<string, unknown>>>,
}))

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ad_click_ids: db.clickIds } }) }) }),
      upsert: async (rows: Array<Record<string, unknown>>) => { db.upserts.push(rows); return { error: null } },
    }),
  },
}))

import { enqueueAdConversion, metaEvent, type UploadRow } from './adConversions'
import { deriveFbc } from './adClickIds'

const row = (over: Partial<UploadRow> = {}): UploadRow => ({
  id: 'r1',
  user_id: 'u1',
  platform: 'meta',
  source: 'stripe',
  event_name: 'purchase',
  click_id: 'fb.1.1761100000000.IwAR123',
  click_id_kind: 'fbc',
  event_id: 'a1b2c3',
  value: 19.99,
  currency: 'USD',
  occurred_at: '2026-10-22T12:00:00.000Z',
  attempts: 0,
  ...over,
})

describe('deriveFbc', () => {
  it("builds Meta's fb.1.<ms>.<fbclid> format", () => {
    expect(deriveFbc('IwAR2abc_-.x', 1761134400123)).toBe('fb.1.1761134400123.IwAR2abc_-.x')
  })
})

describe('metaEvent', () => {
  it('maps a web purchase with fbc, LDU and no PII', () => {
    expect(metaEvent(row())).toEqual({
      event_name: 'Purchase',
      event_time: Date.parse('2026-10-22T12:00:00.000Z') / 1000,
      event_id: 'a1b2c3',
      action_source: 'website',
      event_source_url: 'https://dcmgrading.com/credits/success',
      user_data: { fbc: 'fb.1.1761100000000.IwAR123' },
      custom_data: { value: 19.99, currency: 'USD' },
      data_processing_options: ['LDU'],
      data_processing_options_country: 0,
      data_processing_options_state: 0,
    })
  })

  it('maps a registration to CompleteRegistration with fbp and no value', () => {
    const e = metaEvent(row({ source: 'web', event_name: 'registration', event_id: 'reg_u1', click_id: 'fb.1.1761100000000.987', click_id_kind: 'fbp', value: 0 }))
    expect(e.event_name).toBe('CompleteRegistration')
    expect(e.event_id).toBe('reg_u1')
    expect(e.user_data).toEqual({ fbp: 'fb.1.1761100000000.987' })
    expect(e).not.toHaveProperty('custom_data')
    expect(e.event_source_url).toBe('https://dcmgrading.com/auth/callback')
  })

  it('marks in-app purchases as non-website', () => {
    const e = metaEvent(row({ source: 'apple', event_id: 'apple:1000' }))
    expect(e.action_source).toBe('other')
    expect(e).not.toHaveProperty('event_source_url')
  })
})

describe('enqueueAdConversion', () => {
  beforeEach(() => { db.upserts = []; db.clickIds = null })

  it('queues Google, Microsoft and Meta rows for a consented purchase', async () => {
    db.clickIds = { gclid: 'g1', msclkid: 'm1', fbc: 'fb.1.1761100000000.f1', fbp: 'fb.1.1761100000000.p1', consent: 'granted' }
    const n = await enqueueAdConversion({ userId: 'u1', source: 'stripe', eventId: 'e1', value: 9.99 })
    expect(n).toBe(3)
    const all = db.upserts.flat()
    expect(all.map(r => r.platform)).toEqual(['google', 'microsoft', 'meta'])
    expect(all[2]).toMatchObject({ click_id: 'fb.1.1761100000000.f1', click_id_kind: 'fbc' })
    expect(all.every(r => !('event_name' in r))).toBe(true)
  })

  it('sends registrations to Meta only', async () => {
    db.clickIds = { gclid: 'g1', msclkid: 'm1', fbp: 'fb.1.1761100000000.p1', consent: 'granted' }
    const n = await enqueueAdConversion({ userId: 'u1', source: 'web', eventId: 'reg_u1', value: 0, event: 'registration' })
    expect(n).toBe(1)
    expect(db.upserts.flat()).toEqual([expect.objectContaining({ platform: 'meta', click_id_kind: 'fbp', event_name: 'registration', value: 0 })])
  })

  it('queues nothing without granted consent', async () => {
    db.clickIds = { fbc: 'fb.1.1761100000000.f1', consent: 'essential' }
    expect(await enqueueAdConversion({ userId: 'u1', source: 'stripe', eventId: 'e1', value: 9.99 })).toBe(0)
    expect(db.upserts).toEqual([])
  })
})
