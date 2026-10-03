import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
const webRequire = createRequire(resolve('package.json'));
const React = webRequire('react');
const { act, create } = webRequire('react-test-renderer');

function loadCamera() {
  const exports: any = {};
  const js = ts.transpileModule(readFileSync('src/hooks/useCamera.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'exports', js)((name: string) => {
    if (name === 'react') return React;
    if (name.startsWith('@/utils/')) return {};
    throw new Error(`Unexpected dependency ${name}`);
  }, exports);
  return exports.useCamera;
}
const fakeStream = () => {
  const track = { stop: vi.fn(), getSettings: () => ({ width: 2160, height: 3840 }) };
  return { track, getTracks: () => [track], getVideoTracks: () => [track] };
};
let tree: any;
afterEach(async () => {
  if (tree) await act(() => tree.unmount());
  tree = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function mount(getUserMedia: ReturnType<typeof vi.fn>) {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('navigator', { userAgent: 'Android', mediaDevices: { getUserMedia } });
  vi.stubGlobal('window', { innerWidth: 390, innerHeight: 844 });
  const useCamera = loadCamera();
  let current: any;
  function Host() { current = useCamera(); return null; }
  await act(() => { tree = create(React.createElement(Host)); });
  return () => current;
}

describe('browser camera session lifecycle', () => {
  it('does not retry permission denial as if it were a resolution problem', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }));
    const current = await mount(getUserMedia);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await act(async () => {
        const starting = current().startCamera();
        await vi.advanceTimersByTimeAsync(100);
        await starting;
      });
      expect(getUserMedia).toHaveBeenCalledOnce();
      expect(current().error).toContain('Camera permission denied');
    } finally { log.mockRestore(); }
  });
  it('requests portrait resolution and refuses an unready video capture', async () => {
    const stream = fakeStream(), getUserMedia = vi.fn().mockResolvedValue(stream);
    const current = await mount(getUserMedia);
    await act(async () => {
      const starting = current().startCamera();
      await vi.advanceTimersByTimeAsync(100);
      await starting;
    });
    expect(getUserMedia.mock.calls[0][0].video).toMatchObject({ width: { ideal: 2160 }, height: { ideal: 3840 } });
    expect(await current().captureImage()).toBeNull();
    await act(() => current().stopCamera());
    expect(stream.track.stop).toHaveBeenCalledOnce();
  });
  it('stops a camera request that resolves after the user leaves', async () => {
    let resolveStream!: (value: any) => void;
    const stream = fakeStream();
    const current = await mount(vi.fn(() => new Promise(resolve => { resolveStream = resolve; })));
    let starting!: Promise<void>;
    await act(async () => { starting = current().startCamera(); await vi.advanceTimersByTimeAsync(100); });
    await act(() => current().stopCamera());
    await act(async () => { resolveStream(stream); await starting; });
    expect(current().stream).toBeNull();
    expect(stream.track.stop).toHaveBeenCalledOnce();
  });
  it('keeps the latest camera when overlapping requests resolve out of order', async () => {
    const pending: Array<(value: any) => void> = [];
    const current = await mount(vi.fn(() => new Promise(resolve => pending.push(resolve))));
    let rear!: Promise<void>, front!: Promise<void>;
    await act(async () => { rear = current().startCamera('environment'); await vi.advanceTimersByTimeAsync(100); });
    await act(async () => { front = current().startCamera('user'); await vi.advanceTimersByTimeAsync(100); });
    const latest = fakeStream(), stale = fakeStream();
    await act(async () => { pending[1](latest); await front; pending[0](stale); await rear; });
    expect(current().stream).toBe(latest);
    expect(stale.track.stop).toHaveBeenCalledOnce();
    expect(latest.track.stop).not.toHaveBeenCalled();
  });
});
