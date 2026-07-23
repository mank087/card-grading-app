/**
 * UUID validation guard.
 *
 * Dynamic [id] routes receive raw URL segments as strings — a client bug that
 * serializes a null id produces the literal string "null", which Postgres
 * rejects with `22P02: invalid input syntax for type uuid`. Validate before
 * querying so bad ids get a clean 404 instead of a database error.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}
