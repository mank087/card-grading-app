/**
 * Apple App Store IAP verification.
 *
 * Uses @apple/app-store-server-library to verify JWS-signed transactions
 * and notifications. The library does the heavy lifting (cert chain validation,
 * bundle ID + app Apple ID checks).
 *
 * Two verifiers are cached — one for Production and one for Sandbox.
 * We peek at the JWS payload to determine which environment signed the
 * transaction, then pick the matching verifier. Production iOS App Store
 * traffic uses Production; TestFlight, App Store Connect sandbox testers,
 * and reviewer accounts all produce Sandbox JWS.
 *
 * Online OCSP cert checks are DISABLED — Vercel serverless cold starts
 * + Apple OCSP latency reliably exceed our 10s function timeout, hanging
 * verification. The bundled Apple Root CA chain (G2 + G3) provides
 * sufficient trust without round-tripping to OCSP per request.
 *
 * Env vars required (Vercel):
 *   APPLE_IAP_KEY_ID            — 10-char key id from App Store Connect
 *   APPLE_IAP_ISSUER_ID         — issuer UUID from App Store Connect
 *   APPLE_IAP_PRIVATE_KEY       — full .p8 file contents (with BEGIN/END lines)
 *   APPLE_APP_BUNDLE_ID         — com.dcmgrading.app
 *   APPLE_APP_APPLE_ID          — numeric app ID from App Store Connect
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import {
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
  type JWSRenewalInfoDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library'

const BUNDLE_ID = process.env.APPLE_APP_BUNDLE_ID || 'com.dcmgrading.app'
const APP_APPLE_ID = process.env.APPLE_APP_APPLE_ID
  ? Number(process.env.APPLE_APP_APPLE_ID)
  : undefined

const verifierCache = new Map<Environment, SignedDataVerifier>()

function getVerifier(environment: Environment): SignedDataVerifier {
  const cached = verifierCache.get(environment)
  if (cached) return cached

  const certsDir = join(process.cwd(), 'src/lib/iap/apple-certs')
  const appleRootCAs: Buffer[] = [
    readFileSync(join(certsDir, 'AppleRootCA-G2.cer')),
    readFileSync(join(certsDir, 'AppleRootCA-G3.cer')),
  ]

  const verifier = new SignedDataVerifier(
    appleRootCAs,
    false, // enableOnlineChecks — disabled, see file header
    environment,
    BUNDLE_ID,
    // appAppleId is required for PRODUCTION, optional/undefined for SANDBOX.
    environment === Environment.PRODUCTION ? APP_APPLE_ID : undefined,
  )
  verifierCache.set(environment, verifier)
  return verifier
}

/**
 * Peek at the unsigned JWS payload to determine which environment it
 * was issued from. We do NOT trust this value — the verifier still
 * checks the signature — but we use it to pick which verifier to
 * call so the environment-match check in verifyAndDecodeTransaction
 * passes instead of throwing a generic environment-mismatch error.
 */
function peekEnvironment(signedJws: string): Environment {
  const parts = signedJws.split('.')
  if (parts.length !== 3) return Environment.PRODUCTION
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
    return payload?.environment === 'Sandbox' ? Environment.SANDBOX : Environment.PRODUCTION
  } catch {
    return Environment.PRODUCTION
  }
}

export async function verifySignedTransaction(
  signedTransaction: string,
): Promise<JWSTransactionDecodedPayload> {
  const env = peekEnvironment(signedTransaction)
  const verifier = getVerifier(env)
  return verifier.verifyAndDecodeTransaction(signedTransaction)
}

export async function verifySignedRenewalInfo(
  signedRenewalInfo: string,
): Promise<JWSRenewalInfoDecodedPayload> {
  const env = peekEnvironment(signedRenewalInfo)
  const verifier = getVerifier(env)
  return verifier.verifyAndDecodeRenewalInfo(signedRenewalInfo)
}

/**
 * App Store Server Notifications carry the environment in their own
 * top-level field; if not present, fall back to peeking the embedded
 * signedPayload's JWS body.
 */
export async function verifyServerNotification(
  signedPayload: string,
): Promise<ResponseBodyV2DecodedPayload> {
  const env = peekEnvironment(signedPayload)
  const verifier = getVerifier(env)
  return verifier.verifyAndDecodeNotification(signedPayload)
}

/**
 * Convert Apple's environment string ('Production' | 'Sandbox') to our
 * lowercase enum used in the iap_transactions table.
 */
export function normalizeEnvironment(env: string | undefined): 'production' | 'sandbox' {
  return env === 'Sandbox' ? 'sandbox' : 'production'
}
