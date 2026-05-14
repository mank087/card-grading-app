/**
 * Apple App Store IAP verification.
 *
 * Uses @apple/app-store-server-library to verify JWS-signed transactions
 * and notifications. The library does the heavy lifting (cert chain validation,
 * bundle ID + app Apple ID checks, environment detection).
 *
 * Env vars required (Vercel):
 *   APPLE_IAP_KEY_ID            — 10-char key id from App Store Connect
 *   APPLE_IAP_ISSUER_ID         — issuer UUID from App Store Connect
 *   APPLE_IAP_PRIVATE_KEY       — full .p8 file contents (with BEGIN/END lines)
 *   APPLE_APP_BUNDLE_ID         — com.dcmgrading.app
 *   APPLE_APP_APPLE_ID          — numeric app ID from App Store Connect
 *
 * Root certs (Apple Root CA G2 + G3) live in src/lib/iap/apple-certs/.
 * Download from https://www.apple.com/certificateauthority/ and commit.
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

let cachedVerifier: SignedDataVerifier | null = null

/**
 * Lazily build (and cache) the SignedDataVerifier. Certs are loaded from
 * the repo. App Apple ID is required for production environment.
 */
function getVerifier(): SignedDataVerifier {
  if (cachedVerifier) return cachedVerifier

  const certsDir = join(process.cwd(), 'src/lib/iap/apple-certs')
  const appleRootCAs: Buffer[] = [
    readFileSync(join(certsDir, 'AppleRootCA-G2.cer')),
    readFileSync(join(certsDir, 'AppleRootCA-G3.cer')),
  ]

  // Production environment is required to ship; SDK auto-detects sandbox
  // when the incoming JWS is sandbox-signed.
  const env = Environment.PRODUCTION

  cachedVerifier = new SignedDataVerifier(
    appleRootCAs,
    true, // enableOnlineChecks — validates against Apple's OCSP
    env,
    BUNDLE_ID,
    APP_APPLE_ID,
  )
  return cachedVerifier
}

/**
 * Verify and decode a signed transaction (JWS) from the mobile client.
 * Returns the decoded payload or throws if signature/bundle/app-id mismatch.
 */
export async function verifySignedTransaction(
  signedTransaction: string,
): Promise<JWSTransactionDecodedPayload> {
  const verifier = getVerifier()
  return verifier.verifyAndDecodeTransaction(signedTransaction)
}

/**
 * Verify and decode a signed renewal info payload.
 */
export async function verifySignedRenewalInfo(
  signedRenewalInfo: string,
): Promise<JWSRenewalInfoDecodedPayload> {
  const verifier = getVerifier()
  return verifier.verifyAndDecodeRenewalInfo(signedRenewalInfo)
}

/**
 * Verify and decode an App Store Server Notification V2 payload.
 * Apple posts these to our webhook on subscription events.
 */
export async function verifyServerNotification(
  signedPayload: string,
): Promise<ResponseBodyV2DecodedPayload> {
  const verifier = getVerifier()
  return verifier.verifyAndDecodeNotification(signedPayload)
}

/**
 * Convert Apple's environment string ('Production' | 'Sandbox') to our
 * lowercase enum used in the iap_transactions table.
 */
export function normalizeEnvironment(env: string | undefined): 'production' | 'sandbox' {
  return env === 'Sandbox' ? 'sandbox' : 'production'
}
