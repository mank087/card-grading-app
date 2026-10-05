import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import ts from 'typescript'
import { authBridgeInjection, bridgeTokenParam, bridgeTokenFirstParam } from '../dcm-mobile/lib/webviewAuthBridge'
const localRequire = createRequire(resolve('package.json'))
const React = localRequire('react')
const { act, create } = localRequire('react-test-renderer')
function load(file: string) {
  const exports: any = {}
  const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  new Function('require', 'exports', js)((name: string) => {
    if (name === 'react') return React
    throw Error(`Unexpected dependency ${name}`)
  }, exports)
  return exports
}
let tree: any
afterEach(async () => { if (tree) await act(() => tree.unmount()); tree = undefined; vi.useRealTimers(); vi.unstubAllGlobals() })
function setupWindow() {
  const window: any = Object.assign(new EventTarget(), { location: { origin: 'https://dcmgrading.com' }, ReactNativeWebView: { postMessage: vi.fn() } })
  vi.stubGlobal('window', window)
  vi.stubGlobal('navigator', { userAgent: 'Android DCMGradingApp/1.0.3 DCMBridge/1' })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  return window
}
describe('native session handshake', () => {
  it('waits for late Android injection before resolving authentication', async () => {
    const window = setupWindow()
    const api = load('src/lib/nativeAppBridge.ts')
    expect(api.expectsNativeSession()).toBe(true)
    expect(api.isNativeHost()).toBe(false)
    let ready = false
    const pending = api.awaitNativeSession().then(() => { ready = true })
    await Promise.resolve()
    expect(ready).toBe(false)
    expect(JSON.parse(window.ReactNativeWebView.postMessage.mock.calls[0][0])).toEqual({ type: 'ready', version: 1 })
    window.__dcmNativeBridge = 1
    window.dispatchEvent(new Event('dcm-native-session'))
    await pending
    expect(ready).toBe(true)
  })
  it('does not delay ordinary web visitors or older app versions', async () => {
    setupWindow()
    vi.stubGlobal('navigator', { userAgent: 'DCMGradingApp/1.0.2' })
    await expect(load('src/lib/nativeAppBridge.ts').awaitNativeSession()).resolves.toBeUndefined()
  })
  it('has a bounded failure instead of redirecting to login on a failed handoff', async () => {
    vi.useFakeTimers()
    setupWindow()
    const pending = load('src/lib/nativeAppBridge.ts').awaitNativeSession()
    const assertion = expect(pending).rejects.toThrow('Go back and reopen')
    await vi.advanceTimersByTimeAsync(12000)
    await assertion
  })
  it('shares one native refresh request and reads the confirmed expiration', async () => {
    const window = setupWindow()
    window.__dcmNativeBridge = 1
    const api = load('src/lib/nativeAppBridge.ts')
    const first = api.refreshNativeSession()
    expect(api.refreshNativeSession()).toBe(first)
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ access_token: 'test', expires_at: Date.now() / 1000 + 3600 }) })
    window.dispatchEvent(new Event('dcm-native-session'))
    expect(await first).toEqual({ success: true })
    expect(window.ReactNativeWebView.postMessage).toHaveBeenCalledTimes(1)
  })
})
describe('export authentication compatibility', () => {
  it('never adds the new client token to its URL', () => {
    expect(bridgeTokenParam('secret-placeholder')).toBe('')
    expect(bridgeTokenFirstParam('secret-placeholder')).toBe('')
  })
  it('injects only into a trusted document and posts to that document origin', () => {
    const script = authBridgeInjection('test-token')!
    const page: any = { postMessage: vi.fn() }
    new Function('location', 'window', script)({ origin: 'https://evil.test' }, page)
    expect(page.__dcmExportToken).toBeUndefined()
    new Function('location', 'window', script)({ origin: 'https://dcmgrading.com' }, page)
    expect(page.postMessage).toHaveBeenCalledWith(JSON.stringify({ type: 'dcm-auth', token: 'test-token' }), 'https://dcmgrading.com')
  })
  async function hook(legacy: string | null, early?: string) {
    const window = setupWindow()
    if (early) window.__dcmExportToken = early
    const api = load('src/lib/useNativeExportToken.ts')
    let token = ''
    function Reader() { token = api.useNativeExportToken(legacy); return null }
    await act(async () => { tree = create(React.createElement(Reader)) })
    return { window, token: () => token }
  }
  it('continues to support older installed clients with a legacy URL token', async () => {
    const app = await hook('legacy-test')
    expect(app.token()).toBe('legacy-test')
  })
  it('recovers a token supplied before React hydration', async () => {
    const app = await hook(null, 'early-test')
    expect(app.token()).toBe('early-test')
  })
  it('waits for a trusted late message and rejects an iframe or foreign origin', async () => {
    const app = await hook(null)
    const message = async (source: unknown, origin: string, token: string) => {
      const event = new Event('message')
      Object.assign(event, { source, origin, data: JSON.stringify({ type: 'dcm-auth', token }) })
      await act(async () => { app.window.dispatchEvent(event) })
    }
    await message({}, 'https://dcmgrading.com', 'wrong-frame')
    await message(app.window, 'https://evil.test', 'wrong-origin')
    expect(app.token()).toBe('')
    await message(app.window, 'https://dcmgrading.com', 'late-test')
    expect(app.token()).toBe('late-test')
  })
})
