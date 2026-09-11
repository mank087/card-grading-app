// One-time helper: mint a Microsoft Advertising API refresh token for the
// server-side conversion upload. Usage:
//   MS_ADS_OAUTH_CLIENT_ID=... [MS_ADS_OAUTH_CLIENT_SECRET=...] node scripts/microsoft-ads-oauth.mjs
// Open the printed URL as admin@dcmgrading.com, approve, paste the full
// redirected URL (or just the code) back.
import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const clientId = process.env.MS_ADS_OAUTH_CLIENT_ID
const clientSecret = process.env.MS_ADS_OAUTH_CLIENT_SECRET
if (!clientId) { console.error('Set MS_ADS_OAUTH_CLIENT_ID (and MS_ADS_OAUTH_CLIENT_SECRET for a confidential client)'); process.exit(1) }

const redirect = 'https://login.microsoftonline.com/common/oauth2/nativeclient'
const scope = 'https://ads.microsoft.com/msads.manage offline_access'
const url = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' + new URLSearchParams({
  client_id: clientId, response_type: 'code', redirect_uri: redirect, response_mode: 'query', scope, prompt: 'consent',
})
console.log('\nOpen this URL, approve as admin@dcmgrading.com, then paste the redirected URL or code:\n\n' + url + '\n')
const rl = readline.createInterface({ input: stdin, output: stdout })
let code = (await rl.question('Code or URL: ')).trim()
rl.close()
if (code.includes('code=')) code = new URL(code).searchParams.get('code') || code
const body = new URLSearchParams({ client_id: clientId, code, redirect_uri: redirect, grant_type: 'authorization_code', scope })
if (clientSecret) body.set('client_secret', clientSecret)
const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
})
const json = await res.json()
if (!json.refresh_token) { console.error('No refresh token returned:', json); process.exit(1) }
console.log('\nMS_ADS_OAUTH_REFRESH_TOKEN=' + json.refresh_token + '\n')
