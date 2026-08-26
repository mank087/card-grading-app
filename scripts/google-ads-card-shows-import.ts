/**
 * Google Ads Editor import — one Search campaign per upcoming card show.
 *
 * Each campaign runs from 10 days before the show to its last day, targets the
 * show's city + state, and drives to the show's page (/card-shows/{slug}).
 * Three ad groups per show: show name, "{city} card show", venue. One RSA each.
 *
 *   DOTENV_CONFIG_PATH=.env.local npx tsx scripts/google-ads-card-shows-import.ts [outDir]
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const OUT = process.argv[2] || path.join('marketing', 'google-ads', 'card-shows-2026-h2')
fs.mkdirSync(OUT, { recursive: true })
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const TODAY = new Date('2026-08-25T12:00:00Z')
const LEAD_DAYS = 10
const BUDGET = '8.00'
const CPC_CAP = '1.00'
const TRACKING = '{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={adgroupid}&utm_term={keyword}'

const STATE: Record<string, string> = { AL: 'Alabama', AZ: 'Arizona', CA: 'California', CO: 'Colorado', CT: 'Connecticut', FL: 'Florida', GA: 'Georgia', IL: 'Illinois', IN: 'Indiana', KY: 'Kentucky', MA: 'Massachusetts', MD: 'Maryland', ME: 'Maine', MI: 'Michigan', MN: 'Minnesota', MO: 'Missouri', NC: 'North Carolina', NJ: 'New Jersey', NV: 'Nevada', NY: 'New York', OH: 'Ohio', PA: 'Pennsylvania', TN: 'Tennessee', TX: 'Texas', VA: 'Virginia', WA: 'Washington', WI: 'Wisconsin' }
// Metro name people actually search when the venue sits in a suburb
const METRO: Record<string, string> = { Oaks: 'Philadelphia', Duluth: 'Atlanta', Rosemont: 'Chicago', Allen: 'Dallas', Chantilly: 'Washington DC', Hempstead: 'Long Island', Fishers: 'Indianapolis', Edison: 'New Jersey', Quincy: 'Boston', Apopka: 'Orlando', Mississauga: 'Toronto' }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_FULL = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

const BANNED = [/pre[- ]?grad/i, /pre[- ]?check/i, /second opinion/i, /know before you go/i, /guarantee/i, /more accurate/i, /\bPSA\b|\bBGS\b|\bSGC\b|\bCGC\b/, /Dynamic Collectibles/i]
const chk = (t: string, max: number, w: string) => { if (t.length > max) throw new Error(`${w}: "${t}" ${t.length}>${max}`); for (const rx of BANNED) if (rx.test(t)) throw new Error(`${w}: "${t}" banned ${rx}`) }
const csvCell = (v: any) => { const x = String(v ?? ''); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x }
function writeCsv(name: string, cols: string[], data: Record<string, any>[]) { fs.writeFileSync(path.join(OUT, name), '﻿' + [cols.join(','), ...data.map(r => cols.map(c => csvCell(r[c])).join(','))].join('\r\n'), 'utf8'); console.log(`wrote ${name}: ${data.length} rows`) }
const fmtDate = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)
const clip = (t: string, n: number) => t.length <= n ? t : t.slice(0, n - 1).replace(/[\s,·-]+$/, '') + '…'
/** Fit a headline: try candidates in order, first ≤30 wins. */
const fit = (...c: string[]) => { for (const x of c) if (x.length <= 30) return x; return clip(c[c.length - 1], 30) }

type Show = { slug: string; name: string; short_name: string; city: string; state: string; country: string; venue_name: string; start_date: string; end_date: string; show_type: string; scope: string; is_active: boolean; special_offer?: string; offer_code?: string }

async function main() {
  const { data, error } = await s.from('card_shows').select('*').gte('end_date', fmtDate(TODAY)).order('start_date')
  if (error) throw error
  const shows = (data as Show[]).filter(x => x.is_active !== false && !/-removed$/.test(x.slug) && (x.country || 'USA') === 'USA')
  console.log(`shows: ${shows.length} (of ${data!.length} upcoming; skipped inactive/removed/non-US)`)

  const camps: any[] = [], locs: any[] = [], negs: any[] = [], links: any[] = [], callouts: any[] = [], groups: any[] = [], kws: any[] = [], ads: any[] = []
  const addKw = (camp: string, group: string, kw: string, types: string[] = ['Exact', 'Phrase']) => { for (const t of types) kws.push({ Campaign: camp, 'Ad Group': group, Keyword: kw.toLowerCase().replace(/[^a-z0-9 '&-]/g, ' ').replace(/\s+/g, ' ').trim(), 'Criterion Type': t, Status: 'Enabled' }) }

  for (const sh of shows) {
    const start = new Date(sh.start_date + 'T12:00:00Z'), end = new Date(sh.end_date + 'T12:00:00Z')
    const runFrom = addDays(start, -LEAD_DAYS) < TODAY ? TODAY : addDays(start, -LEAD_DAYS)
    const short = (sh.short_name || sh.name).replace(/\s*\(.*?\)\s*/g, ' ').trim()
    const metro = METRO[sh.city] || sh.city
    const stateName = STATE[sh.state] || sh.state
    const year = sh.start_date.slice(0, 4), monthIdx = start.getUTCMonth()
    const dateRange = start.getUTCMonth() === end.getUTCMonth() ? `${MON[monthIdx]} ${start.getUTCDate()}-${end.getUTCDate()}` : `${MON[monthIdx]} ${start.getUTCDate()} - ${MON[end.getUTCMonth()]} ${end.getUTCDate()}`
    const camp = `Show - ${short}${new RegExp(metro.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(short) || short.includes(sh.city) ? '' : ` ${metro}`} ${MON[monthIdx]} ${year}`
    const url = `https://www.dcmgrading.com/card-shows/${sh.slug}`
    const isTcg = /TCG|Pokemon|Magic/i.test(sh.show_type + ' ' + sh.name), isSports = /Sports/i.test(sh.show_type + ' ' + sh.name), isMulti = !isTcg && !isSports || /Multi/i.test(sh.show_type)
    const venue = (sh.venue_name || '').trim()

    camps.push({ Campaign: camp, 'Campaign Type': 'Search', Networks: 'Google search', Budget: BUDGET, 'Budget type': 'Daily', 'Bid Strategy Type': 'Maximize clicks', 'Maximum CPC bid limit': CPC_CAP, 'Start Date': fmtDate(runFrom), 'End Date': fmtDate(end), Languages: 'en', 'Tracking template': TRACKING, 'Campaign Status': 'Enabled', 'Ad rotation': 'Optimize for clicks' })
    locs.push({ Campaign: camp, Location: `${sh.city}, ${stateName}, United States` })
    if (metro !== sh.city) locs.push({ Campaign: camp, Location: `${metro.replace(' DC', ', District of Columbia')}${/District/.test(metro) ? '' : `, ${stateName}`}, United States` })
    locs.push({ Campaign: camp, Location: `${stateName}, United States` })
    for (const n of ['jobs', 'hiring', 'salary', 'vendor application', 'booth application', 'results', 'standings', 'decklists', 'pairings', 'stream', 'live stream', 'hotel', 'parking', 'flights', 'psa', 'bgs', 'sgc']) negs.push({ Campaign: camp, Keyword: n, 'Criterion Type': 'Campaign Negative Phrase', Status: 'Enabled' })

    // sitelinks + callouts (campaign level)
    for (const [t, d1, d2, u] of [
      ['Show Dates & Venue', `${dateRange} in ${sh.city}`, 'Hours, venue and highlights', url],
      ['Card Show Offer', '10% off first credits', 'Code CARDSHOW at checkout', url + '#offer'],
      ['Grade Your First Card', 'Two free grades to start', 'Results in about a minute', 'https://www.dcmgrading.com/grade-your-first-card'],
      ['All Card Shows', 'Upcoming shows near you', 'Sports, Pokémon, TCG', 'https://www.dcmgrading.com/card-shows'],
    ]) { chk(t, 25, 'sitelink'); chk(clip(d1, 35), 35, 'sl d1'); chk(d2, 35, 'sl d2'); links.push({ Campaign: camp, 'Link Text': t, 'Description Line 1': clip(d1, 35), 'Description Line 2': d2, 'Final URL': u }) }
    for (const c of ['Grade Cards From A Photo', 'Check Centering First', 'No Mailing Required', '10% Off With CARDSHOW', 'Real Sold-Listing Pricing']) { chk(c, 25, 'callout'); callouts.push({ Campaign: camp, 'Callout text': c }) }

    // ---- ad group 1: show name
    const g1 = `${short} - Show Name`
    groups.push({ Campaign: camp, 'Ad Group': g1, 'Max CPC': '0.80', 'Ad Group Type': 'Standard', 'Ad Group Status': 'Enabled' })
    const nameVariants = new Set([sh.name.replace(/\s*\(.*?\)\s*/g, ' ').trim(), short, `${short} ${year}`, `${short} ${metro}`, `${short} card show`, `${short} tickets`, `${short} dates`, `${short} schedule`, `${short} hours`, `${short} vendors`, `${short} ${MONTH_FULL[monthIdx]}`])
    for (const v of nameVariants) addKw(camp, g1, v)
    // ---- ad group 2: city card show
    const g2 = `${short} - ${metro} Card Show`
    groups.push({ Campaign: camp, 'Ad Group': g2, 'Max CPC': '0.90', 'Ad Group Type': 'Standard', 'Ad Group Status': 'Enabled' })
    const cityKw = [`card show ${metro}`, `${metro} card show`, `${metro} card show ${MONTH_FULL[monthIdx]}`, `card show ${metro} this weekend`, `card show near ${metro}`, `trading card show ${metro}`, `${metro} card convention`, `card shows in ${stateName}`, `${stateName} card show ${year}`]
    if (isSports || isMulti) cityKw.push(`${metro} sports card show`, `sports card show ${metro}`, `baseball card show ${metro}`, `football card show ${metro}`)
    if (isTcg || isMulti) cityKw.push(`${metro} pokemon card show`, `pokemon card show ${metro}`, `${metro} tcg show`, `pokemon event ${metro}`)
    if (/Pokemon/i.test(sh.name)) cityKw.push(`pokemon regional ${metro}`, `pokemon championship ${metro}`, `pokemon tournament ${metro} ${year}`)
    if (/Magic/i.test(sh.name)) cityKw.push(`magiccon ${metro}`, `mtg event ${metro}`, `magic the gathering convention ${metro}`)
    for (const v of cityKw) addKw(camp, g2, v)
    // ---- ad group 3: venue
    if (venue) {
      const g3 = `${short} - Venue`
      groups.push({ Campaign: camp, 'Ad Group': g3, 'Max CPC': '0.70', 'Ad Group Type': 'Standard', 'Ad Group Status': 'Enabled' })
      const v0 = venue.split('&')[0].trim()
      for (const v of [`${v0} card show`, `${v0} ${MONTH_FULL[monthIdx]} ${year}`, `${v0} events ${MONTH_FULL[monthIdx]}`, `what is at ${v0} this weekend`]) addKw(camp, g3, v)
    }

    // ---- RSAs
    const H_show = fit(`${short} ${year}`, short)
    const H_dates = fit(`${dateRange} · ${sh.city}, ${sh.state}`, `${dateRange} in ${sh.city}`, dateRange)
    const H_city = fit(`Card Show In ${metro}, ${sh.state}`, `${metro} Card Show`)
    const H_venue = venue ? fit(`At ${venue.split('&')[0].trim()}`, `${sh.city} Venue Details`) : `${sh.city} Venue Details`
    const common = ['Dates, Venue & Highlights', 'Grade Cards From A Photo', 'Check Centering Before Buying', 'Get 2 Free Card Grades', '10% Off Credits: CARDSHOW', 'Graded In About A Minute', 'Real Sold-Listing Pricing', 'No Mailing Required', 'Verify A Slab By QR', 'Subgrades & Centering Report']
    const D = [
      [`${short}: ${dateRange} at ${venue}, ${sh.city}, ${sh.state}. Dates, hours and highlights.`, `${short}: ${dateRange} at ${venue}. Dates, hours and highlights.`, `${short}: ${dateRange} in ${sh.city}, ${sh.state}. Dates, hours and highlights.`, `${short}: ${dateRange} in ${sh.city}. Dates and highlights.`].find(x => x.length <= 90 && !(x.includes(' at ,') || x.includes(' at .'))) || clip(`${short}: ${dateRange} in ${sh.city}.`, 90),
      `Heading to the show? Grade your pulls from a photo in about a minute. Two free grades.`,
      `Check centering and condition before you buy at the table. 10% off credits with CARDSHOW.`,
      `Real sold-listing pricing and a scannable grade report for every card. No mailing needed.`,
    ]
    const mk = (group: string, lead: string[], pins: Record<number, string>) => {
      const H = [...lead, ...common].slice(0, 15); H.forEach(h => chk(h, 30, `${camp} H`)); D.forEach(d => chk(d, 90, `${camp} D`))
      const row: any = { Campaign: camp, 'Ad Group': group, 'Ad type': 'Responsive search ad', 'Final URL': url, Status: 'Enabled' }
      H.forEach((h, i) => { row[`Headline ${i + 1}`] = h; if (pins[i + 1]) row[`Headline ${i + 1} position`] = pins[i + 1] }); D.forEach((d, i) => row[`Description ${i + 1}`] = d)
      ads.push(row)
    }
    mk(g1, [H_show, H_dates, H_city, H_venue], { 1: '1', 2: '2' })
    mk(g2, [H_city, H_show, H_dates, H_venue], { 1: '1', 2: '2' })
    if (venue) mk(`${short} - Venue`, [H_venue, H_show, H_dates, H_city], { 1: '1', 2: '2' })
  }

  writeCsv('01-campaigns.csv', ['Campaign', 'Campaign Type', 'Networks', 'Budget', 'Budget type', 'Bid Strategy Type', 'Maximum CPC bid limit', 'Start Date', 'End Date', 'Languages', 'Tracking template', 'Ad rotation', 'Campaign Status'], camps)
  writeCsv('01b-locations.csv', ['Campaign', 'Location'], locs)
  writeCsv('02-negatives.csv', ['Campaign', 'Keyword', 'Criterion Type', 'Status'], negs)
  writeCsv('03a-sitelinks.csv', ['Campaign', 'Link Text', 'Description Line 1', 'Description Line 2', 'Final URL'], links)
  writeCsv('03b-callouts.csv', ['Campaign', 'Callout text'], callouts)
  writeCsv('04-ad-groups.csv', ['Campaign', 'Ad Group', 'Max CPC', 'Ad Group Type', 'Ad Group Status'], groups)
  writeCsv('05-keywords.csv', ['Campaign', 'Ad Group', 'Keyword', 'Criterion Type', 'Status'], kws)
  const adCols = ['Campaign', 'Ad Group', 'Ad type', 'Final URL', 'Status', ...Array.from({ length: 15 }, (_, i) => `Headline ${i + 1}`), ...Array.from({ length: 15 }, (_, i) => `Headline ${i + 1} position`), ...Array.from({ length: 4 }, (_, i) => `Description ${i + 1}`)]
  writeCsv('06-responsive-search-ads.csv', adCols, ads)
  const sched = camps.map(c => `${c['Start Date']} → ${c['End Date']}  ${c.Campaign}`).join('\n')
  fs.writeFileSync(path.join(OUT, '_schedule.txt'), sched)
  console.log(`\ncampaigns ${camps.length} | ad groups ${groups.length} | keywords ${kws.length} | ads ${ads.length}\n${sched}`)
}
main().catch(e => { console.error(e); process.exit(1) })
