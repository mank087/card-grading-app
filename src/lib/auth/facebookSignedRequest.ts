/**
 * Verify a Facebook `signed_request` (used by the Data Deletion Callback).
 *
 * Format, per Facebook's docs: `<sig>.<payload>`, both base64url. `sig` is the
 * raw HMAC-SHA256 of the *encoded* payload string, keyed with the app secret.
 * The payload JSON must declare algorithm "HMAC-SHA256".
 *
 * Nothing in the payload may be trusted until this returns ok — before it
 * existed, anyone could POST a forged payload and delete a user's account.
 */
import { createHmac, timingSafeEqual } from 'crypto'

export type SignedRequestResult =
  | { ok: true; payload: Record<string, unknown> & { user_id: string } }
  | { ok: false; reason: string }

function base64UrlDecode(input: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(input)) return null
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(b64, 'base64')
}

export function parseFacebookSignedRequest(
  signedRequest: string,
  appSecret: string
): SignedRequestResult {
  if (!appSecret) return { ok: false, reason: 'no app secret configured' }
  if (typeof signedRequest !== 'string') return { ok: false, reason: 'missing signed_request' }

  const parts = signedRequest.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: 'malformed signed_request' }
  }
  const [encodedSig, encodedPayload] = parts

  const sig = base64UrlDecode(encodedSig)
  const payloadBuf = base64UrlDecode(encodedPayload)
  if (!sig || !payloadBuf) return { ok: false, reason: 'invalid base64url' }

  const expected = createHmac('sha256', appSecret).update(encodedPayload).digest()
  // timingSafeEqual throws on length mismatch; check length first (length is
  // not secret — it is always 32 for SHA-256).
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    return { ok: false, reason: 'bad signature' }
  }

  let payload: unknown
  try {
    payload = JSON.parse(payloadBuf.toString('utf-8'))
  } catch {
    return { ok: false, reason: 'payload is not JSON' }
  }
  if (!payload || typeof payload !== 'object') {
    return { ok: false, reason: 'payload is not an object' }
  }
  const p = payload as Record<string, unknown>

  if (typeof p.algorithm !== 'string' || p.algorithm.toUpperCase() !== 'HMAC-SHA256') {
    return { ok: false, reason: 'unsupported algorithm' }
  }

  const userId = p.user_id
  if ((typeof userId !== 'string' && typeof userId !== 'number') || String(userId) === '') {
    return { ok: false, reason: 'missing user_id' }
  }

  return { ok: true, payload: { ...p, user_id: String(userId) } }
}
