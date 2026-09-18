# Scrydex Pokemon catalog

English physical cards are imported into the existing `pokemon_sets` and
`pokemon_cards` tables. App lookups continue to use Supabase. MTG still uses
Scryfall. Japanese tables retain their TCGdex IDs; this importer does not write
Japanese records because Scrydex uses different IDs for those expansions.

Set `SCRYDEX_API_KEY` and `SCRYDEX_TEAM_ID` in `.env.local` for local imports,
and in the deployment environment for the weekly freshness check. The importer
also requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
Never use `NEXT_PUBLIC_` for the Scrydex credentials.

```powershell
# Fetch and validate the anniversary sets without database writes
node scripts/import-pokemon-scrydex.js
# Import anniversary cards and refresh Mega Evolution promos
node scripts/import-pokemon-scrydex.js --set=me55,me55c,mep --write
# Refresh missing/partial sets, last 90 days, and all promo sets
node scripts/import-pokemon-scrydex.js --sync --write
```

Dry runs still call Scrydex and consume API credits. Prices/population reports
are not requested. All pages and mapped cards for a set are validated before
its first write. IDs are retained from Scrydex, and writes are repeatable
upserts. Missing optional metadata and existing market links are preserved.
Every written batch is read back by ID to confirm its set, name and number.
Extra existing rows are never deleted or treated as proof that every feed ID
is present. `--sync` count checks are selection hints; recent and promo sets
are refreshed regardless of counts. For an older set with suspected missing
IDs despite an equal/higher count, use `--set=ID --write` explicitly.

Writes are not transactional across the set and card batches. A failure exits
nonzero; rerun that set to finish. No customer grading records are modified.
The weekly check remains alert-only, prefers Scrydex when configured, and
notes the legacy feed limitation in its summary when credentials are absent. Deployment is required for the
updated check to run in production; it does not schedule automatic imports.

Validation: `node --test scripts/scrydex-pokemon.test.cjs`

References: https://scrydex.com/docs/pokemon/cards and
https://scrydex.com/docs/pokemon/expansions

## One-time public anniversary import

`scripts/import-pokemon-30th-public.cjs` reads the public HTML checklists and
the structured card information exposed by each public card page. It never
calls the authenticated API. It is limited to English `me55` and `me55c`.

```powershell
node scripts/import-pokemon-30th-public.cjs --collect
node scripts/import-pokemon-30th-public.cjs --load
```

Collection is resumable and saves source URLs, card metadata, printed numbers,
and validated small/large image files with SHA-256 checksums in
`data/scrydex-30th-2026-09-16/` (ignored by Git). Any failed HTTP request stops
the run; no login, challenge, or access-control workaround is attempted.

Loading first checks both snapshots and saves existing catalog rows as a local
backup. It uploads the card images and public expansion logos/symbols into the `pokemon-catalog` bucket
and writes our own image URLs into `pokemon_cards`. It verifies all card IDs
and image URLs, plus downloaded image checksums for three cards per set.
Existing application lookups can use the new records immediately without an
application deployment. The script creates no scheduled external calls.
