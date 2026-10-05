import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as reviewContract from '../dcm-mobile/lib/gradeReview'
import { reviewRequestSchema } from '../src/lib/gradeReview/types'
const localRequire = createRequire(resolve('package.json'))
const React = localRequire('react')
const { create, act } = localRequire('react-test-renderer')
let tree: any
afterEach(async () => { if (tree) await act(() => tree.unmount()); tree = undefined; vi.unstubAllGlobals() })
const runId = 'b1000000-0000-4000-8000-000000000001'
async function mount(state: any, viewer = 'owner') {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const fetched = vi.fn(async (_url: string, options?: any) => ({ ok: true, json: async () => options?.method === 'POST' ? { review: { id: 'review-1', status: 'queued', requested_at: '2026-10-05', note: 'Request received', customer_result: null } } : state }))
  vi.stubGlobal('fetch', fetched)
  const onChanged = vi.fn()
  const shades = new Proxy({}, { get: () => '#888' })
  const dependencies: Record<string, any> = {
    'react': React, 'react/jsx-runtime': localRequire('react/jsx-runtime'),
    'react-native': Object.assign(Object.fromEntries(['View', 'Text', 'Modal', 'ScrollView', 'TextInput', 'TouchableOpacity', 'ActivityIndicator', 'KeyboardAvoidingView'].map(name => [name, name])), { Platform: { OS: 'android' }, StyleSheet: { create: (x: any) => x }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } }),
    '@react-navigation/native': { useIsFocused: () => true },
    '@/contexts/AuthContext': { useAuth: () => ({ user: { id: viewer } }) },
    '@/lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test', user: { id: viewer } } } }) } } },
    '@/lib/gradeReview': reviewContract,
    '@/lib/constants': { Colors: new Proxy({}, { get: () => shades }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
  }
  const compiled = ts.transpileModule(readFileSync('dcm-mobile/components/gradeReview/GradeReview.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports: any = {}
  new Function('require', 'exports', compiled)((name: string) => { if (!(name in dependencies)) throw Error(name); return dependencies[name] }, exports)
  await act(async () => { tree = create(React.createElement(exports.default, { cardId: runId, ownerId: 'owner', onChanged })) })
  const button = (label: string) => tree.root.findAllByType('TouchableOpacity').find((node: any) => node.findAllByType('Text').some((text: any) => text.props.children === label))
  const press = async (label: string) => { await act(async () => button(label).props.onPress()) }
  return { fetched, onChanged, button, press, posts: () => fetched.mock.calls.filter((call: any) => call[1]?.method === 'POST') }
}
const eligible = { enabled: true, eligible: true, detailsEligible: true, gradeRunId: runId, review: null }
describe('native grade review workflow', () => {
  it('requires an explanation before posting a server-compatible review request', async () => {
    const app = await mount(eligible)
    await app.press('Request Grade Review')
    expect(app.button('Submit Review Request').props.disabled).toBe(true)
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Review note' }).props.onChangeText('The back corner is sharper than described.'))
    expect(app.button('Submit Review Request').props.disabled).toBe(false)
    await app.press('Submit Review Request')
    expect(app.posts()).toHaveLength(1)
    const [url, options] = app.posts()[0]
    expect(url).toBe(`https://dcmgrading.com/api/cards/${runId}/grade-review`)
    expect(reviewRequestSchema.safeParse(JSON.parse(options.body)).success).toBe(true)
    expect(options.headers.Authorization).toBe('Bearer test')
  })
  it('allows a details-only correction without grade-review membership', async () => {
    const app = await mount({ ...eligible, eligible: false })
    await app.press('Fix Card Details')
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Correct card number' }).props.onChangeText('123'))
    await app.press('Submit Review Request')
    expect(JSON.parse(app.posts()[0][1].body)).toMatchObject({ reviewGrade: false, details: { card_number: '123' } })
  })
  it.each([['Accept Grade Change', 'accept'], ['Keep Original Grade', 'keep_original']])('posts the owner decision for %s', async (label, decision) => {
    const app = await mount({ ...eligible, eligible: false, review: { id: 'review-1', status: 'awaiting_owner', requested_at: '2026-10-05', note: '', customer_result: 'Completed', original_grade: 8, proposed_grade: 9 } })
    await app.press('View Grade Review')
    await app.press(label)
    expect(app.posts()[0][0]).toBe(`https://dcmgrading.com/api/cards/${runId}/grade-review/decision`)
    expect(JSON.parse(app.posts()[0][1].body)).toEqual({ reviewId: 'review-1', decision })
    expect(app.onChanged).toHaveBeenCalledTimes(1)
  })
  it('does not load owner-only review data for another account', async () => {
    const app = await mount(eligible, 'other-owner')
    expect(app.fetched).not.toHaveBeenCalled()
    expect(tree.toJSON()).toBeNull()
  })
})
