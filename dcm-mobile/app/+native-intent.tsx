import { recoveryCredentials, rememberRecoveryLink } from '@/lib/recoveryLink'

/** Keep recovery credentials out of router state, navigation history and persisted return paths. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const base = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'
    const raw = path.startsWith('/') ? new URL(path, base).href : path
    if (recoveryCredentials(raw, base)) { rememberRecoveryLink(raw); return '/reset-password' }
    return path
  } catch { return '/reset-password' }
}
