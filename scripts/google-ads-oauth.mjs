// One-time helper: mint a Google Ads API refresh token for the server-side
// conversion upload. Usage:
//   GOOGLE_ADS_OAUTH_CLIENT_ID=... GOOGLE_ADS_OAUTH_CLIENT_SECRET=... node scripts/google-ads-oauth.mjs
// Open the printed URL as admin@dcmgrading.com, approve, paste the code back.
import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const clientId = process.env.GOOGLE_ADS_OAUTH_CLIENT_ID
const clientSecret = process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET
if (!clientId || !clientSecret) { console.error('Set GOOGLE_ADS_OAUTH_CLIENT_ID and GOOGLE_ADS_OAUTH_CLIENT_SECRET'); process.exit(1) }

const redirect = 'urn:ietf:wg:oauth:2.0:oob'
const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: clientId, redirect_uri: redirect, response_type: 'code', access_type: 'offline', prompt: 'consent',
  scope: 'https://www.googleapis.com/auth/adwords',
})
console.log('\nOpen this URL, approve as admin@dcmgrading.com, then paste the code:\n\n' + url + '\n')
const rl = readline.createInterface({ input: stdin, output: stdout })
const code = (await rl.question('Code: ')).trim()
rl.close()
const res = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: 'authorization_code' }),
})
const json = await res.json()
if (!json.refresh_token) { console.error('No refresh token returned:', json); process.exit(1) }
console.log('\nGOOGLE_ADS_OAUTH_REFRESH_TOKEN=' + json.refresh_token + '\n')
