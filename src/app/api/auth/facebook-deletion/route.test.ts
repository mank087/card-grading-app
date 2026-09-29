/**
 * Facebook Data Deletion Callback: the signed_request must be verified with
 * the app secret before any account is touched. A forged request used to be
 * enough to delete a user's account and cards.
 */
import { createHmac } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseFacebookSignedRequest } from '@/lib/auth/facebookSignedRequest';

const SECRET = 'test-app-secret';

const listUsers = vi.fn();
const deleteUser = vi.fn();
const from = vi.fn();

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    auth: { admin: { listUsers: (...a: any[]) => listUsers(...a), deleteUser: (...a: any[]) => deleteUser(...a) } },
    from: (...a: any[]) => from(...a),
  },
}));

const { POST } = await import('./route');

const b64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function sign(payload: Record<string, unknown>, secret = SECRET): string {
  const encoded = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac('sha256', secret).update(encoded).digest());
  return `${sig}.${encoded}`;
}

const GOOD = { algorithm: 'HMAC-SHA256', user_id: '1234567890', issued_at: 1_700_000_000 };

function postRequest(signedRequest: string | null) {
  const fd = new FormData();
  if (signedRequest !== null) fd.set('signed_request', signedRequest);
  return { formData: async () => fd } as any;
}

function chain() {
  const c: any = { delete: () => c, eq: async () => ({ error: null }) };
  return c;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  process.env.FACEBOOK_APP_SECRET = SECRET;
  listUsers.mockResolvedValue({ data: { users: [] }, error: null });
  deleteUser.mockResolvedValue({ error: null });
  from.mockImplementation(() => chain());
});

describe('parseFacebookSignedRequest', () => {
  it('accepts a correctly signed request', () => {
    const r = parseFacebookSignedRequest(sign(GOOD), SECRET);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.user_id).toBe('1234567890');
  });

  it('rejects a tampered payload', () => {
    const [sig] = sign(GOOD).split('.');
    const forged = b64url(Buffer.from(JSON.stringify({ ...GOOD, user_id: '999' })));
    expect(parseFacebookSignedRequest(`${sig}.${forged}`, SECRET)).toEqual({ ok: false, reason: 'bad signature' });
  });

  it('rejects a tampered signature', () => {
    const [, payload] = sign(GOOD).split('.');
    const badSig = b64url(createHmac('sha256', 'wrong-secret').update(payload).digest());
    expect(parseFacebookSignedRequest(`${badSig}.${payload}`, SECRET).ok).toBe(false);
    expect(parseFacebookSignedRequest(`AAAA.${payload}`, SECRET).ok).toBe(false);
  });

  it('rejects a request with no or the wrong algorithm, even when correctly signed', () => {
    expect(parseFacebookSignedRequest(sign({ ...GOOD, algorithm: 'none' }), SECRET)).toEqual({ ok: false, reason: 'unsupported algorithm' });
    const { algorithm: _a, ...noAlg } = GOOD;
    expect(parseFacebookSignedRequest(sign(noAlg), SECRET).ok).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(parseFacebookSignedRequest('onlyonepart', SECRET).ok).toBe(false);
    expect(parseFacebookSignedRequest('a.b.c', SECRET).ok).toBe(false);
    expect(parseFacebookSignedRequest(sign(GOOD), '').ok).toBe(false);
  });
});

describe('POST /api/auth/facebook-deletion', () => {
  it('processes a valid request and returns { url, confirmation_code }', async () => {
    listUsers.mockResolvedValue({
      data: { users: [{ id: 'u-1', app_metadata: { provider: 'facebook' }, user_metadata: { provider_id: '1234567890' } }] },
      error: null,
    });
    const res = await POST(postRequest(sign(GOOD)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.url).toBe('string');
    expect(typeof body.confirmation_code).toBe('string');
    expect(deleteUser).toHaveBeenCalledWith('u-1');
  });

  it.each([
    ['tampered payload', () => { const [s] = sign(GOOD).split('.'); return `${s}.${b64url(Buffer.from(JSON.stringify({ ...GOOD, user_id: '42' })))}`; }, 403],
    ['tampered signature', () => `${b64url(Buffer.alloc(32, 7))}.${sign(GOOD).split('.')[1]}`, 403],
    ['wrong algorithm', () => sign({ ...GOOD, algorithm: 'HMAC-SHA1' }), 400],
    ['unsigned (legacy forgery shape)', () => `x.${b64url(Buffer.from(JSON.stringify(GOOD)))}`, 403],
  ])('rejects a %s without touching the DB', async (_label, make, status) => {
    const res = await POST(postRequest(make()));
    expect(res.status).toBe(status);
    expect(listUsers).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('rejects a missing signed_request without touching the DB', async () => {
    const res = await POST(postRequest(null));
    expect(res.status).toBe(400);
    expect(listUsers).not.toHaveBeenCalled();
  });

  it('fails closed with 500 when FACEBOOK_APP_SECRET is not set', async () => {
    delete process.env.FACEBOOK_APP_SECRET;
    const res = await POST(postRequest(sign(GOOD)));
    expect(res.status).toBe(500);
    expect(listUsers).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
