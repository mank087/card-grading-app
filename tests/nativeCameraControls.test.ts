import { afterEach, describe, expect, it, vi } from 'vitest';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load the real adapter with a fake native bridge. No Expo runtime or device is needed.
function adapter(version?: number) {
  const exports: Record<string, any> = {};
  const source = readFileSync(resolve('dcm-mobile/lib/cameraControls.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  new Function('require', 'exports', compiled.outputText)(
    (name: string) => {
      if (name !== 'expo-camera/build/ExpoCameraManager') throw new Error(`Unexpected dependency: ${name}`);
      return { default: { dcmCaptureControlsVersion: version } };
    }, exports,
  );
  return exports;
}
const camera = (view: object) => ({ _cameraRef: { current: view } });
afterEach(() => vi.useRealTimers());

describe('native point focus adapter', () => {
  it('keeps older binaries on their supported continuous autofocus path', async () => {
    const controls = adapter();
    const dcmFocusAtPoint = vi.fn();
    expect(controls.hasCaptureControls()).toBe(false);
    expect(await controls.focusCamera(camera({ dcmFocusAtPoint }), 0.2, 0.8)).toEqual({ status: 'unsupported' });
    expect(dcmFocusAtPoint).not.toHaveBeenCalled();
  });
  it('passes normalized tap coordinates and the real focus result through', async () => {
    const dcmFocusAtPoint = vi.fn().mockResolvedValue({ status: 'unfocused' });
    const controls = adapter(1);
    expect(await controls.focusCamera(camera({ dcmFocusAtPoint }), 0.25, 0.75)).toEqual({ status: 'unfocused' });
    expect(dcmFocusAtPoint).toHaveBeenCalledWith(0.25, 0.75);
    await controls.focusCamera(camera({ dcmFocusAtPoint }), -0.1, 1.2);
    expect(dcmFocusAtPoint).toHaveBeenLastCalledWith(0, 1);
  });
  it('handles unavailable views, bad coordinates, and rejected native requests', async () => {
    const controls = adapter(1);
    expect((await controls.focusCamera(null, 0.5, 0.5)).status).toBe('unavailable');
    expect((await controls.focusCamera(null, NaN, 0.5)).status).toBe('unsupported');
    expect((await controls.focusCamera(camera({ dcmFocusAtPoint: vi.fn().mockRejectedValue(new Error('unmounted')) }), 0.5, 0.5)).status).toBe('unavailable');
  });
  it('bounds a stuck native request and releases the focus lock', async () => {
    vi.useFakeTimers();
    const dcmCancelFocus = vi.fn().mockResolvedValue(undefined);
    const pending = adapter(1).focusCamera(camera({ dcmFocusAtPoint: () => new Promise(() => {}), dcmCancelFocus }), 0.5, 0.5);
    await vi.advanceTimersByTimeAsync(3500);
    expect(await pending).toEqual({ status: 'timeout' });
    expect(dcmCancelFocus).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('clears the safety timer after a successful focus', async () => {
    vi.useFakeTimers();
    expect(await adapter(1).focusCamera(camera({ dcmFocusAtPoint: async () => ({ status: 'settled' }) }), 0.5, 0.5)).toEqual({ status: 'settled' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
