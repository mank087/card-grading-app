import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { isAppOrigin } from '../dcm-mobile/lib/embeddedNavigation'
import { authBridgeInjection } from '../dcm-mobile/lib/webviewAuthBridge'
const localRequire = createRequire(resolve('package.json'))
const React = localRequire('react')
const { create, act } = localRequire('react-test-renderer')
let tree: any
afterEach(async () => { if (tree) await act(() => tree.unmount()); tree = undefined; vi.unstubAllGlobals() })
async function mount() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const inject = vi.fn()
  const persist = vi.fn().mockResolvedValue('file:///cache/test.pdf')
  const shades = new Proxy({}, { get: () => '#888' })
  const dependencies: Record<string, any> = {
    'react': React, 'react/jsx-runtime': localRequire('react/jsx-runtime'),
    'react-native': Object.assign(Object.fromEntries(['View', 'Text', 'Image', 'Modal', 'Pressable', 'TouchableOpacity', 'ActivityIndicator'].map(name => [name, name])), { Platform: { OS: 'ios' }, StyleSheet: { create: (x: any) => x }, Alert: { alert: vi.fn() }, Linking: {} }),
    'react-native-webview': { WebView: React.forwardRef((props: any, ref: any) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: inject })); return React.createElement('WebView', props) }) },
    '@/contexts/AuthContext': { useAuth: () => ({ session: { access_token: 'test-session' } }) },
    '@/lib/webviewAuthBridge': { authBridgeInjection }, '@/lib/embeddedNavigation': { isAppOrigin },
    '@/lib/constants': { Colors: new Proxy({}, { get: () => shades }) },
    '@/lib/downloads': { persistBase64ToCache: persist },
    'expo-sharing': {}, 'expo-file-system/legacy': {}, '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
  }
  const compiled = ts.transpileModule(readFileSync('dcm-mobile/components/exports/ExportRunner.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports: any = {}
  new Function('require', 'exports', compiled)((name: string) => { if (!(name in dependencies)) throw Error(name); return dependencies[name] }, exports)
  const source = { url: 'https://dcmgrading.com/label-export/batch?ids=test', title: 'Labels' }
  await act(async () => { tree = create(React.createElement(exports.default, { source, onClose: vi.fn() })) })
  const web = () => tree.root.findByType('WebView').props
  const deliver = async (url = source.url) => {
    await act(async () => web().onMessage({ nativeEvent: { url, data: JSON.stringify({ type: 'label-export-ready', files: [{ name: 'test.pdf', mime: 'application/pdf', dataUrl: 'data:application/pdf;base64,dGVzdA==' }] }) } }))
  }
  return { inject, persist, web, deliver }
}
describe('native export generation and preview', () => {
  it('hands authentication to the hidden generator and constrains its navigation', async () => {
    const app = await mount()
    await act(() => app.web().onLoadEnd())
    expect(app.inject).toHaveBeenCalledWith(authBridgeInjection('test-session'))
    expect(app.web().source.uri).not.toContain('token=')
    expect(app.web().onShouldStartLoadWithRequest({ url: 'https://evil.test/' })).toBe(false)
    expect(app.web().onShouldStartLoadWithRequest({ url: 'https://dcmgrading.com/label-export/batch' })).toBe(true)
  })
  it('keeps the generated iOS PDF preview local without applying the web authentication gate', async () => {
    const app = await mount()
    await app.deliver()
    expect(app.persist).toHaveBeenCalledWith('test.pdf', 'dGVzdA==')
    expect(app.web().source.uri).toBe('file:///cache/test.pdf')
    expect(app.web().onLoadEnd).toBeUndefined()
    expect(app.web().onShouldStartLoadWithRequest).toBeUndefined()
    expect(app.inject).not.toHaveBeenCalled()
  })
  it('does not write files supplied by a foreign document', async () => {
    const app = await mount()
    await app.deliver('https://evil.test/')
    expect(app.persist).not.toHaveBeenCalled()
    expect(app.web().source.uri).toContain('/label-export/batch')
  })
})
