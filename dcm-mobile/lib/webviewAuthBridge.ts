import { isAppOrigin } from './embeddedNavigation'
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'

/** Web receivers must deploy before this binary. Older clients retain URL-token compatibility. */
export const USE_POSTMESSAGE_BRIDGE = true
export function bridgeTokenParam(_token: string | null | undefined): string { return '' }
export function bridgeTokenFirstParam(_token: string | null | undefined): string { return '' }
export function authBridgeInjection(token: string | null | undefined): string | null {
  if (!token) return null
  const origin = new URL(API_BASE).origin
  const origins = ['https://dcmgrading.com', 'https://www.dcmgrading.com'].filter(url => isAppOrigin(url, API_BASE))
  if (!origins.includes(origin)) origins.push(origin)
  return `(function(){if(${JSON.stringify(origins)}.indexOf(location.origin)<0)return;
    window.__dcmExportToken=${JSON.stringify(token)};
    window.postMessage(JSON.stringify({type:'dcm-auth',token:window.__dcmExportToken}),location.origin);
  })(); true;`
}
