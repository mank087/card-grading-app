/**
 * UUID validation guard.
 *
 * Route params and persisted queue entries are plain strings — a null id can
 * survive as the literal string "null" (or undefined), and passing it to a
 * Postgres uuid column throws `22P02: invalid input syntax for type uuid`.
 * Validate before querying.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value)
}
