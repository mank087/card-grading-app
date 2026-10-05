import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as destinations from '../dcm-mobile/lib/embeddedNavigation'
const localRequire = createRequire(resolve('package.json'))
const React = localRequire('react')
const { create, act } = localRequire('react-test-renderer')
let tree: any
afterEach(async () => { if (tree) await act(() => tree.unmount()); tree = undefined; vi.unstubAllGlobals() })
async function mount(platform: string, path = '/submissions/new') {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), canGoBack: () => true }
  const refresh = vi.fn().mockResolvedValue(undefined)
  const signOut = vi.fn().mockResolvedValue(undefined)
  const inject = vi.fn()
  const browser = vi.fn().mockResolvedValue(undefined)
  const session = { access_token: 'test', refresh_token: 'refresh', expires_at: Date.now() / 1000 + 3600, user: { id: 'owner' } }
  const navigation = { addListener: () => () => {} }
  const shades = new Proxy({}, { get: () => '#888' })
  const dependencies: Record<string, any> = {
    'react': React, 'react/jsx-runtime': localRequire('react/jsx-runtime'),
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Button', ActivityIndicator: 'Spinner', Platform: { OS: platform }, StyleSheet: { create: (x: any) => x }, BackHandler: { addEventListener: () => ({ remove() {} }) }, Alert: { alert: vi.fn() }, Linking: { openURL: browser } },
    'react-native-webview': { WebView: React.forwardRef((props: any, ref: any) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: inject, goBack: vi.fn(), reload: vi.fn() })); return React.createElement('WebView', props) }) },
    'expo-router': { useRouter: () => router, useSegments: () => ['pages'], useNavigation: () => navigation },
    '@react-navigation/native': { useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]) },
    'expo-web-browser': { openBrowserAsync: browser }, 'expo-file-system/legacy': {}, 'expo-sharing': {},
    '@/lib/constants': { Colors: new Proxy({}, { get: () => shades }) },
    '@/lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session } }) } } },
    '@/contexts/AuthContext': { useAuth: () => ({ session, isLoading: false, signOut }) }, '@/contexts/CreditsContext': { useCredits: () => ({ refresh }) },
    '@/components/MobileTabBar': { default: 'TabBar' }, '@/components/AppHeaderBar': { default: 'Header' },
    '@/lib/embeddedWeb': { APP_USER_AGENT_SUFFIX: 'DCMGradingApp/1.0.3 DCMBridge/1', withEmbeddedParams: (x: string) => x },
    '@/lib/embeddedNavigation': destinations, '@/lib/embeddedChrome': { inAppChromeInjection: 'true;' },
  }
  const compiled = ts.transpileModule(readFileSync('dcm-mobile/components/ui/InAppPage.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports: any = {}
  new Function('require', 'exports', compiled)((name: string) => { if (!(name in dependencies)) throw Error(name); return dependencies[name] }, exports)
  await act(async () => { tree = create(React.createElement(exports.default, { path })) })
  const web = () => tree.root.findByType('WebView').props
  const message = async (type: string, extra = {}, url = 'https://dcmgrading.com/submissions/new') => {
    await act(async () => web().onMessage({ nativeEvent: { url, data: JSON.stringify({ version: 1, type, ...extra }) } }))
  }
  return { router, refresh, signOut, inject, browser, web, message }
}
describe('embedded purchase and session integration', () => {
  it('does not render a web credit page at all on iOS', async () => {
    const app = await mount('ios', '/credits')
    expect(tree.root.findAllByType('WebView')).toHaveLength(0)
    expect(app.router.replace).toHaveBeenCalledWith('/pages/credits')
  })
  it('renders the existing credit page and allows Stripe checkout on Android', async () => {
    const app = await mount('android', '/credits')
    expect(app.web().source.uri).toBe('https://dcmgrading.com/credits')
    expect(app.web().onShouldStartLoadWithRequest({ url: 'https://checkout.stripe.com/test', isTopFrame: true })).toBe(true)
  })
  it.each(['ios', 'android'])('opens purchases separately and preserves the batch web page on %s', async platform => {
    const app = await mount(platform)
    await app.message('navigate', { url: 'https://dcmgrading.com/credits' })
    expect(app.router.push).toHaveBeenCalledWith('/pages/credits')
    expect(app.web().source.uri).toBe('https://dcmgrading.com/submissions/new')
    expect(app.browser).not.toHaveBeenCalled()
  })
  it('refreshes native credits on a trusted completion signal without trusting a supplied amount', async () => {
    const app = await mount('android')
    app.refresh.mockClear()
    await app.message('credits-changed', { balance: 999 })
    expect(app.refresh).toHaveBeenCalledTimes(1)
    await app.message('credits-changed', {}, 'https://evil.test/')
    expect(app.refresh).toHaveBeenCalledTimes(1)
  })
  it('does not accept a logout or navigation command from another origin', async () => {
    const app = await mount('ios')
    await app.message('auth-sign-out', {}, 'https://checkout.stripe.com/')
    await app.message('navigate', { url: 'https://dcmgrading.com/credits' }, 'https://evil.test/')
    expect(app.signOut).not.toHaveBeenCalled()
    expect(app.router.push).not.toHaveBeenCalled()
  })
})
