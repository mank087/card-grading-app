import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { embeddedDestination, isAppOrigin, isPublicAppPath, sessionInjection } from '../dcm-mobile/lib/embeddedNavigation'
import { recoveryCredentials, consumeRecoveryLink, rememberRecoveryLink } from '../dcm-mobile/lib/recoveryLink'
import { buildReviewRequest, GRADE_REVIEW_NOTE_MIN, reviewStatusLabels } from '../dcm-mobile/lib/gradeReview'
import { reviewRequestSchema, GRADE_REVIEW_NOTE_MIN as serverNoteMin, reviewStatusLabels as serverStatusLabels } from '../src/lib/gradeReview/types'

const base = 'https://dcmgrading.com'
const cardId = 'b1000000-0000-4000-8000-000000000001'
describe('embedded navigation and platform purchases', () => {
  it.each(['/credits', '/vip', '/card-lovers'])('keeps iOS %s inside its native platform router', path => {
    expect(embeddedDestination(`${base}${path}?source=bulk`, base, 'ios', true)).toEqual({ kind: 'native', href: `/pages${path}` })
    expect(embeddedDestination(`${base}${path}`, base, 'android', true).kind).toBe('web')
  })
  it.each(['checkout.stripe.com', 'billing.stripe.com', 'hooks.stripe.com'])('preserves Android hosted checkout on %s', host => {
    expect(embeddedDestination(`https://${host}/session`, base, 'android', true).kind).toBe('web')
    expect(embeddedDestination(`https://${host}/session`, base, 'ios', true)).toEqual({ kind: 'native', href: '/pages/credits' })
  })
  it('keeps public card viewing on the public web endpoint for guests', () => {
    expect(embeddedDestination(`${base}/pokemon/${cardId}`, base, 'ios', false).kind).toBe('web')
    expect(embeddedDestination(`${base}/pokemon/${cardId}`, base, 'ios', true)).toEqual({ kind: 'native', href: `/card/${cardId}` })
  })
  it('keeps submission progress embedded', () => expect(embeddedDestination(`${base}/submissions/${cardId}`, base, 'ios', true).kind).toBe('web'))
  it.each(['javascript:alert(1)', 'file:///secret', 'data:text/html,test', 'https://user:password@dcmgrading.com/account'])('blocks unsafe URL %s', url => {
    expect(embeddedDestination(url, base, 'android', true).kind).toBe('blocked')
  })
  it.each(['https://dcmgrading.com.evil.test', 'https://dcmgrading.com@evil.test', 'http://dcmgrading.com', 'https://evil.test/dcmgrading.com'])('never treats %s as the app origin', url => expect(isAppOrigin(url, base)).toBe(false))
  it('allows the canonical and www origins', () => expect(isAppOrigin('https://www.dcmgrading.com/credits', base)).toBe(true))
  it.each([`/card/${cardId}`, `/sports/${cardId}`, '/collection/my-cards', '/verify/DCM123', '/reset-password'])('allows public entry %s', path => expect(isPublicAppPath(path)).toBe(true))
  it.each(['/collection', '/pages/my-account', '/pages/credits', '/submissions/new', '/api/cards/my-collection'])('keeps private entry %s behind authentication', path => expect(isPublicAppPath(path)).toBe(false))
})

function storage(initial: Record<string, string> = {}) {
  const data: any = { ...initial }
  Object.defineProperties(data, {
    getItem: { value: (key: string) => data[key] ?? null },
    setItem: { value: (key: string, value: string) => { data[key] = value } },
    removeItem: { value: (key: string) => { delete data[key] } },
  })
  return data
}
describe('session handoff', () => {
  const session = { access_token: 'test-access', refresh_token: 'test-refresh', expires_at: 2000000000, user: { id: 'owner' } }
  function inject(origin: string, state: unknown, localStorage = storage()) {
    const window = { dispatchEvent: vi.fn() }
    new Function('location', 'window', 'localStorage', 'Event', sessionInjection(base, state))({ origin }, window, localStorage, Event)
    return { window, localStorage }
  }
  it('does not send tokens to external checkout or a spoofed domain', () => {
    for (const origin of ['https://checkout.stripe.com', 'https://dcmgrading.com.evil.test']) {
      const result = inject(origin, session)
      expect(result.localStorage.getItem('supabase.auth.token')).toBeNull()
      expect(result.window.dispatchEvent).not.toHaveBeenCalled()
    }
  })
  it('preserves the real expiration and escapes session values', () => {
    const result = inject(base, { ...session, user: { id: "owner';alert(1)//" } })
    expect(JSON.parse(result.localStorage.getItem('supabase.auth.token'))).toEqual({ ...session, user: { id: "owner';alert(1)//" } })
  })
  it('clears the previous account SDK session on switch and logout', () => {
    const local = storage({ 'supabase.auth.token': JSON.stringify({ ...session, user: { id: 'previous' } }), 'sb-project-auth-token': 'previous-private-session', harmless: 'preference' })
    inject(base, session, local)
    expect(local.getItem('sb-project-auth-token')).toBeNull()
    inject(base, null, local)
    expect(local.getItem('supabase.auth.token')).toBeNull()
    expect(local.harmless).toBe('preference')
  })
  it('acknowledges an unchanged refresh without emitting another auth change', () => {
    const result = inject(base, session, storage({ 'supabase.auth.token': JSON.stringify(session) }))
    expect(result.window.dispatchEvent.mock.calls.map(call => call[0].type)).toEqual(['dcm-native-session'])
  })
  it('replaces an incomplete stored session without interrupting the handshake', () => {
    const result = inject(base, session, storage({ 'supabase.auth.token': '{}', 'sb-project-auth-token': 'stale' }))
    expect(JSON.parse(result.localStorage.getItem('supabase.auth.token'))).toEqual(session)
    expect(result.localStorage.getItem('sb-project-auth-token')).toBeNull()
    expect(result.window.dispatchEvent.mock.calls.map(call => call[0].type)).toContain('dcm-native-session')
  })
})

describe('password recovery routing', () => {
  it('keeps recovery fragments available without persisting them in route state', () => {
    const raw = `${base}/reset-password#type=recovery&access_token=test&refresh_token=refresh`
    expect(recoveryCredentials(raw, base)).toEqual({ access_token: 'test', refresh_token: 'refresh' })
    rememberRecoveryLink(raw)
    expect(consumeRecoveryLink()).toBe(raw)
    expect(consumeRecoveryLink()).toBeNull()
  })
  it('handles the custom scheme and a PKCE recovery link', () => {
    expect(recoveryCredentials('dcmgrading://reset-password?code=abc', base)).toEqual({ code: 'abc' })
    expect(recoveryCredentials(`${base}/reset-password?code=abc`, base)).toEqual({ code: 'abc' })
  })
  it.each(['https://evil.test/reset-password?code=x', `${base}/account?code=x`, `${base}/reset-password#type=signup&access_token=x&refresh_token=y`])('rejects unrelated recovery input %s', url => expect(recoveryCredentials(url, base)).toBeNull())
})

describe('native grade-review API parity', () => {
  const state = { enabled: true, eligible: true, detailsEligible: true, gradeRunId: cardId, review: null }
  it('matches current server labels and minimum note length', () => {
    expect(GRADE_REVIEW_NOTE_MIN).toBe(serverNoteMin)
    expect(reviewStatusLabels).toEqual(serverStatusLabels)
  })
  it('builds a request accepted by the server schema', () => {
    const request = buildReviewRequest(state, true, true, 'The back corner appears sharper than described.', { card_number: ' 123 ' })
    expect(reviewRequestSchema.safeParse(request).success).toBe(true)
    expect(request.details).toEqual({ card_number: '123' })
  })
  it('allows details-only correction without grade-review membership', () => {
    const request = buildReviewRequest({ ...state, eligible: false }, true, true, '', { card_name: 'Correct name' })
    expect(request.reviewGrade).toBe(false)
    expect(reviewRequestSchema.safeParse(request).success).toBe(true)
  })
  it('rejects empty, too-short, oversized, and unavailable requests', () => {
    expect(() => buildReviewRequest(state, true, false, 'short', {})).toThrow()
    expect(() => buildReviewRequest(state, false, true, '', {})).toThrow()
    expect(() => buildReviewRequest(state, false, true, '', { card_name: 'x'.repeat(201) })).toThrow()
    expect(() => buildReviewRequest({ ...state, enabled: false }, true, false, 'long enough explanation', {})).toThrow()
  })
})

const localRequire = createRequire(resolve('package.json'))
const React = localRequire('react')
const { create, act } = localRequire('react-test-renderer')
function load(file: string, dependencies: Record<string, any>) {
  const exports: any = {}
  const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'exports', js)((name: string) => {
    if (name in dependencies) return dependencies[name]
    if (name === 'react' || name === 'react/jsx-runtime') return localRequire(name)
    throw Error(`Unexpected dependency ${name}`)
  }, exports)
  return exports
}
let tree: any
afterEach(async () => { if (tree) await act(() => tree.unmount()); tree = undefined; vi.unstubAllGlobals() })
describe('credit balance reliability', () => {
  async function setup() {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    let user: any = { id: 'first' }
    const single = vi.fn().mockResolvedValue({ data: { balance: 7 }, error: null })
    const query = { select: () => query, eq: () => query, single }
    const context = load('dcm-mobile/contexts/CreditsContext.tsx', {
      'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
      './AuthContext': { useAuth: () => ({ user }) }, '@/lib/supabase': { supabase: { from: () => query } },
    })
    let value: any
    function Reader() { value = context.useCredits(); return null }
    const render = () => React.createElement(context.CreditsProvider, {}, React.createElement(Reader))
    await act(async () => { tree = create(render()) })
    return { single, value: () => value, changeUser: async (next: any) => { user = next; await act(async () => { tree.update(render()) }) } }
  }
  it('keeps a confirmed balance on query and network errors', async () => {
    const app = await setup()
    expect(app.value().balance).toBe(7)
    app.single.mockResolvedValueOnce({ data: null, error: Error('network') })
    await act(async () => app.value().refresh())
    expect(app.value()).toMatchObject({ balance: 7, hasBalance: true, isLoading: false })
    expect(app.value().error).toContain('unavailable')
    app.single.mockRejectedValueOnce(Error('offline'))
    await act(async () => app.value().refresh())
    expect(app.value().balance).toBe(7)
  })
  it('clears stale errors when a confirmed zero balance arrives', async () => {
    const app = await setup()
    app.single.mockResolvedValueOnce({ data: null, error: Error('offline') })
    await act(async () => app.value().refresh())
    app.single.mockResolvedValueOnce({ data: { balance: 0 }, error: null })
    await act(async () => app.value().refresh())
    expect(app.value()).toMatchObject({ balance: 0, error: null, hasBalance: true })
  })
  it('ignores a slower earlier response', async () => {
    const app = await setup()
    let finish!: (result: any) => void
    app.single.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    let slow: Promise<void>
    await act(async () => { slow = app.value().refresh() })
    app.single.mockResolvedValueOnce({ data: { balance: 12 }, error: null })
    await act(async () => app.value().refresh())
    await act(async () => { finish({ data: { balance: 3 }, error: null }); await slow! })
    expect(app.value().balance).toBe(12)
  })
  it('does not carry a previous account balance through a failed account switch', async () => {
    const app = await setup()
    app.single.mockResolvedValueOnce({ data: null, error: Error('offline') })
    await app.changeUser({ id: 'second' })
    expect(app.value()).toMatchObject({ balance: 0, hasBalance: false })
    await app.changeUser(null)
    expect(app.value()).toMatchObject({ balance: 0, hasBalance: false, error: null })
  })
})
