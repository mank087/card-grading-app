/**
 * Bulk submissions carry card notes onto every card they create, as the same
 * user_condition_* fields single upload writes — the drain grades through the
 * per-category GET routes, which read only those columns.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Op = { table: string; kind: string; payload?: any; cols?: string; filters: Array<[string, unknown]> }

const state: { ops: Op[]; submissionCardNotes: { data: any; error: any } } = {
  ops: [],
  submissionCardNotes: { data: null, error: null },
}

function respond(op: Op): { data: any; error: any } {
  if (op.table === 'submissions' && op.kind === 'insert') {
    return { data: { id: 'sub-1', user_id: op.payload.user_id, category: op.payload.category }, error: null }
  }
  if (op.table === 'submissions' && op.kind === 'select' && op.cols === 'card_notes') {
    return state.submissionCardNotes
  }
  if (op.table === 'cards' && op.kind === 'insert') return { data: { id: op.payload.id }, error: null }
  return { data: null, error: null }
}

function fakeClient() {
  return {
    from(table: string) {
      const op: Op = { table, kind: '', filters: [] }
      const b: any = {
        insert(payload: any) { op.kind = 'insert'; op.payload = payload; return b },
        update(payload: any) { op.kind = 'update'; op.payload = payload; return b },
        select(cols: string) { if (!op.kind) { op.kind = 'select'; op.cols = cols } return b },
        eq(c: string, v: unknown) { op.filters.push([c, v]); return b },
        in() { return b },
        order() { return b },
        maybeSingle() { state.ops.push(op); return Promise.resolve(respond(op)) },
        then(res: any, rej: any) { state.ops.push(op); return Promise.resolve(respond(op)).then(res, rej) },
      }
      return b
    },
  }
}

vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: () => fakeClient() }))
vi.mock('@/lib/serialGenerator', () => ({ generateNextSerial: vi.fn(async () => '0000000001') }))
vi.mock('@/lib/credits', () => ({ getUserCredits: vi.fn() }))
vi.mock('@/lib/organizations', () => ({ getOrgForUser: vi.fn() }))

import { createCardsForItems, createDraftSubmission } from './service'
import { buildUserConditionFields } from '@/lib/userConditionFields'
import { ensureProcessedConditionReport } from '@/lib/conditionReportProcessor'
import { EMPTY_CONDITION_REPORT } from '@/types/conditionReport'
import type { SubmissionItemRow, SubmissionRow } from './types'

const USER = '11111111-1111-4111-8111-111111111111'
const CARD = '22222222-2222-4222-8222-222222222222'

const submission: SubmissionRow = {
  id: 'sub-1', user_id: USER, name: null, category: 'Sports', sub_category: null, binder_id: null,
  status: 'draft', source: 'bulk_upload', card_count: 1, routing_key: null,
  created_at: '2026-09-28T00:00:00Z', committed_at: null, completed_at: null,
}

function item(): SubmissionItemRow {
  return {
    id: 'item-1', submission_id: 'sub-1', card_id: null, position: 0,
    front_path: `${USER}/${CARD}/front.jpg`, back_path: `${USER}/${CARD}/back.jpg`,
    front_hash: null, back_hash: null, status: 'queued' as any, claimed_at: null, attempts: 0, error: null,
    created_at: '2026-09-28T00:00:00Z',
  }
}

const cardInserts = () => state.ops.filter(o => o.table === 'cards' && o.kind === 'insert').map(o => o.payload)
const noTs = (p: any) => (p ? { ...p, processed_at: 'X' } : p)

beforeEach(() => {
  state.ops = []
  state.submissionCardNotes = { data: null, error: null }
})

describe('bulk submission card notes', () => {
  it('stores the notes on the submission draft', async () => {
    const r = await createDraftSubmission({ userId: USER, category: 'Sports', cardNotes: '  Refractor finish  ' })
    expect(r.ok).toBe(true)
    const insert = state.ops.find(o => o.table === 'submissions' && o.kind === 'insert')
    expect(insert?.payload.card_notes).toBe('Refractor finish')
  })

  it('omits card_notes entirely when there are none (works before the migration)', async () => {
    await createDraftSubmission({ userId: USER, category: 'Sports' })
    const insert = state.ops.find(o => o.table === 'submissions' && o.kind === 'insert')
    expect(insert?.payload).not.toHaveProperty('card_notes')
  })

  it('writes the same user_condition_* fields single upload writes onto each card', async () => {
    state.submissionCardNotes = { data: { card_notes: 'Refractor finish, not scratches' }, error: null }
    const r = await createCardsForItems(submission, [item()])
    expect(r.ok).toBe(true)

    const [card] = cardInserts()
    const single = buildUserConditionFields(EMPTY_CONDITION_REPORT, 'Refractor finish, not scratches')
    expect(card.user_condition_report).toEqual(single.user_condition_report)
    expect(card.has_user_condition_report).toBe(true)
    expect(noTs(card.user_condition_processed)).toEqual(noTs(single.user_condition_processed))

    // What the grading route (and so the drain) hands the prompt builder.
    const forPrompt = ensureProcessedConditionReport(card.user_condition_report, card.user_condition_processed)
    expect(forPrompt?.card_description).toBe('Refractor finish, not scratches')
  })

  it('adds no condition fields when the submission has no notes', async () => {
    await createCardsForItems(submission, [item()])
    const [card] = cardInserts()
    expect(card).not.toHaveProperty('user_condition_report')
    expect(card).not.toHaveProperty('has_user_condition_report')
  })

  it('tolerates the column not existing yet', async () => {
    state.submissionCardNotes = { data: null, error: { code: '42703', message: 'column does not exist' } }
    const r = await createCardsForItems(submission, [item()])
    expect(r.ok).toBe(true)
    expect(cardInserts()[0]).not.toHaveProperty('user_condition_report')
  })

  it('fails the commit (resumably) rather than silently dropping notes on a read error', async () => {
    state.submissionCardNotes = { data: null, error: { code: '08006', message: 'connection failure' } }
    const r = await createCardsForItems(submission, [item()])
    expect(r.ok).toBe(false)
    expect(cardInserts()).toHaveLength(0)
  })
})
