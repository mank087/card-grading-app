/**
 * Wrapper for the OpenAI Admin Costs API.
 *
 *   GET https://api.openai.com/v1/organization/costs
 *     ?start_time=<unix>&end_time=<unix>&bucket_width=1d&limit=180
 *
 * Returns daily cost lines aggregated across all line items (input, output,
 * cached, image, fine-tuning, embedding, etc.). One row per bucket; we sum
 * the amounts within each row.
 *
 * Requires an Admin key (sk-admin-…) with `api.usage.read` scope. Do NOT
 * confuse with OPENAI_API_KEY (project key — inference only). Stored in env
 * as OPENAI_ADMIN_API_KEY. Org id from OPENAI_ORG_ID.
 *
 * Docs: https://platform.openai.com/docs/api-reference/usage/costs
 */

const ADMIN_BASE = 'https://api.openai.com/v1/organization'

export interface OpenAIDailyCost {
  /** YYYY-MM-DD (UTC) */
  date: string
  /** Sum of all line-item amounts for the day, in USD */
  cost_usd: number
  /** Raw API response for this bucket — stored verbatim for audit */
  raw_payload: unknown
}

interface CostBucketResult {
  object: 'bucket'
  start_time: number
  end_time: number
  results: Array<{
    object: 'organization.costs.result'
    amount: { value: number; currency: string }
    line_item: string | null
    project_id: string | null
  }>
}

interface CostsApiResponse {
  object: 'page'
  data: CostBucketResult[]
  has_more: boolean
  next_page: string | null
}

function unixSeconds(d: Date): number {
  return Math.floor(d.getTime() / 1000)
}

function dayKey(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10)
}

/**
 * Fetch one day's worth of cost data. Used by the nightly cron.
 */
export async function fetchOpenAIDailyCost(date: Date): Promise<OpenAIDailyCost | null> {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0))
  const end = new Date(start.getTime() + 24 * 3600 * 1000)
  const results = await fetchOpenAICostRange(start, end)
  return results[0] ?? null
}

/**
 * Fetch a range of daily cost buckets. Used by the backfill script.
 * Stops paginating at `has_more=false`.
 */
export async function fetchOpenAICostRange(start: Date, end: Date): Promise<OpenAIDailyCost[]> {
  const apiKey = process.env.OPENAI_ADMIN_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_ADMIN_API_KEY is not set. Create an admin key in OpenAI Dashboard → Settings → Admin keys.')
  }
  const orgId = process.env.OPENAI_ORG_ID
  // org id is optional — admin keys are already scoped to one org. Include it
  // when set since some accounts require it on this endpoint.

  const out: OpenAIDailyCost[] = []
  let page: string | null = null

  do {
    const url = new URL(ADMIN_BASE + '/costs')
    url.searchParams.set('start_time', String(unixSeconds(start)))
    url.searchParams.set('end_time', String(unixSeconds(end)))
    url.searchParams.set('bucket_width', '1d')
    url.searchParams.set('limit', '180')
    if (page) url.searchParams.set('page', page)

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
    if (orgId) headers['OpenAI-Organization'] = orgId

    const res = await fetch(url.toString(), { headers })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`OpenAI Admin Costs API ${res.status}: ${body.slice(0, 500)}`)
    }
    const json = (await res.json()) as CostsApiResponse

    for (const bucket of json.data) {
      const total = bucket.results.reduce((s, r) => s + (r.amount?.value || 0), 0)
      out.push({
        date: dayKey(bucket.start_time),
        cost_usd: Math.round(total * 10000) / 10000,
        raw_payload: bucket,
      })
    }

    page = json.has_more ? json.next_page : null
  } while (page)

  return out
}
