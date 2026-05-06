/**
 * Re-exports the context-backed useUserEmblems so existing imports keep
 * working. The implementation lives in @/contexts/EmblemsContext —
 * that's the single source of truth shared across all consumers.
 */
export { useUserEmblems } from '@/contexts/EmblemsContext'
export type { EmblemsState as UserEmblems, EmblemKey } from '@/contexts/EmblemsContext'
