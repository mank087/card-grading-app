import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const admin = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock('@/lib/admin/adminAuth', () => ({ verifyAdminSession: admin.verify }));
import { forceRegradeAllowed } from './forceRegradeAuth';

const req = (headers: Record<string, string> = {}, cookies: Record<string, string> = {}) => ({
  headers: { get: (k: string) => headers[k] ?? headers[k.toLowerCase()] ?? null },
  cookies: { get: (k: string) => (cookies[k] ? { value: cookies[k] } : undefined) },
}) as any;

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('CRON_SECRET', 'top-secret'); });
afterEach(() => vi.unstubAllEnvs());

describe('forceRegradeAllowed', () => {
  it('refuses an anonymous caller, even one who knows the owner id', async () => {
    expect(await forceRegradeAllowed(req())).toBe(false);
    expect(admin.verify).not.toHaveBeenCalled();
  });
  it('allows a server caller with the cron secret', async () => {
    expect(await forceRegradeAllowed(req({ authorization: 'Bearer top-secret' }))).toBe(true);
    expect(await forceRegradeAllowed(req({ authorization: 'Bearer wrong' }))).toBe(false);
  });
  it('allows a valid admin session cookie only', async () => {
    admin.verify.mockResolvedValueOnce({ id: 'admin' });
    expect(await forceRegradeAllowed(req({}, { admin_token: 'tok' }))).toBe(true);
    admin.verify.mockResolvedValueOnce(null);
    expect(await forceRegradeAllowed(req({}, { admin_token: 'stale' }))).toBe(false);
    admin.verify.mockRejectedValueOnce(new Error('db down'));
    expect(await forceRegradeAllowed(req({}, { admin_token: 'tok' }))).toBe(false);
  });
  it('does not treat a missing secret as a wildcard', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect(await forceRegradeAllowed(req({ authorization: 'Bearer ' }))).toBe(false);
  });
});
