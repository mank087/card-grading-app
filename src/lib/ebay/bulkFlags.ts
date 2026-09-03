/**
 * Bulk listing feature flags, client half.
 *
 * NEXT_PUBLIC_EBAY_BULK_ENABLED gates the UI (the multi-select in the picker
 * and the review page); EBAY_BULK_ENABLED gates the API and is read
 * server-side in bulkService.ts. Both default OFF, and the server flag is the
 * real gate — a client with the public flag forced on still gets a 404 from
 * every route.
 *
 * Read through a function, not a module constant, so the value is not baked
 * into an import graph that a test or a story can't override.
 */
export function bulkUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EBAY_BULK_ENABLED === 'true';
}
