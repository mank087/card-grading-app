import crypto from 'crypto';
import fs from 'fs';

const TEAM_ID = '2V543N5YNF';
const KEY_ID = 'KKCUUS8D8T';
const SERVICES_ID = 'com.dcmgrading.web';
const KEY_PATH = 'C:\\Users\\benja\\OneDrive\\Documents\\DCM\\.apple-keys\\AuthKey_KKCUUS8D8T.p8';

const LIFETIME_DAYS = 180;

const privateKey = fs.readFileSync(KEY_PATH, 'utf8');

const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + LIFETIME_DAYS * 24 * 60 * 60,
  aud: 'https://appleid.apple.com',
  sub: SERVICES_ID,
};

const b64url = (input: string | Buffer) =>
  Buffer.from(input).toString('base64url');

const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;

const signature = crypto.sign('sha256', Buffer.from(signingInput), {
  key: privateKey,
  dsaEncoding: 'ieee-p1363',
});

const jwt = `${signingInput}.${b64url(signature)}`;

const expiresAt = new Date(payload.exp * 1000).toISOString();
console.log('\nApple Sign In client secret JWT');
console.log('================================');
console.log(`Services ID:  ${SERVICES_ID}`);
console.log(`Key ID:       ${KEY_ID}`);
console.log(`Team ID:      ${TEAM_ID}`);
console.log(`Expires at:   ${expiresAt}`);
console.log('\nJWT (paste into Supabase "Secret Key (for OAuth)"):\n');
console.log(jwt);
console.log('');
