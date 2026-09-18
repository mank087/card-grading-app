import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAPTURE_AUDIT_ENABLED_KEY, CAPTURE_AUDIT_KEY, recordLocalCaptureAudit } from './localCaptureAudit';

const event = { captureId: 'fixture', stage: 'shutter', side: 'front', orientation: 'portrait' } as const;
function storage() {
  const values = new Map<string, string>();
  const sessionStorage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); } };
  vi.stubGlobal('window', { sessionStorage });
  vi.stubEnv('NODE_ENV', 'development');
  return sessionStorage;
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('local camera diagnostic isolation', () => {
  it('requires opt-in and is disabled even with opt-in in production', () => {
    const store = storage();
    recordLocalCaptureAudit(event);
    expect(store.getItem(CAPTURE_AUDIT_KEY)).toBeNull();
    store.setItem(CAPTURE_AUDIT_ENABLED_KEY, '1');
    vi.stubEnv('NODE_ENV', 'production');
    recordLocalCaptureAudit(event);
    expect(store.getItem(CAPTURE_AUDIT_KEY)).toBeNull();
  });
  it('bounds storage and retains the last capture event', () => {
    const store = storage();
    store.setItem(CAPTURE_AUDIT_ENABLED_KEY, '1');
    for (let i = 0; i < 105; i++) recordLocalCaptureAudit({ ...event, captureId: String(i) });
    const events = JSON.parse(store.getItem(CAPTURE_AUDIT_KEY)!);
    expect(events).toHaveLength(100);
    expect(events[0].captureId).toBe('5');
    expect(events[99]).toMatchObject({ ...event, captureId: '104', schemaVersion: 1 });
  });
  it('does not throw when storage is blocked or malformed', () => {
    const store = storage();
    store.setItem(CAPTURE_AUDIT_ENABLED_KEY, '1');
    store.setItem(CAPTURE_AUDIT_KEY, '{broken');
    expect(() => recordLocalCaptureAudit(event)).not.toThrow();
    vi.stubGlobal('window', { get sessionStorage() { throw new Error('denied'); } });
    expect(() => recordLocalCaptureAudit(event)).not.toThrow();
  });
});
