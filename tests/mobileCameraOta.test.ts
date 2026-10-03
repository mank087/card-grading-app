import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const localRequire = createRequire(resolve('package.json'));
const React = localRequire('react');
const { act, create } = localRequire('react-test-renderer');

function load(file: string, dependencies: Record<string, any> = {}) {
  const exports: any = {};
  const js = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'exports', js)((name: string) => {
    if (name in dependencies) return dependencies[name];
    if (name === 'react' || name === 'react/jsx-runtime') return localRequire(name);
    throw new Error(`Unexpected dependency: ${name}`);
  }, exports);
  return exports;
}

let tree: any;
afterEach(async () => {
  if (tree) await act(() => tree.unmount());
  tree = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function mount(platform = 'android', granted = true) {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let appStateChanged: (state: string) => void = () => {};
  const takePictureAsync = vi.fn().mockResolvedValue({ uri: 'file://capture.jpg', width: 3000, height: 4000 });
  const photo = { uri: 'file://processed.jpg', width: 2000, height: 2800, fileSize: 840000 };
  const processCardCapture = vi.fn().mockResolvedValue(photo);
  const focusCamera = vi.fn();
  const reportUploadEvent = vi.fn();
  const CameraView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ takePictureAsync }));
    return React.createElement('CameraView', props);
  });
  const shades = new Proxy({}, { get: () => '#888888' });
  const Screen = load('dcm-mobile/app/grade/capture.tsx', {
    'react-native': {
      View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', Pressable: 'Pressable',
      Image: 'Image', ScrollView: 'ScrollView', Alert: { alert: vi.fn() },
      StyleSheet: { create: (styles: any) => styles, absoluteFill: {} },
      Platform: { OS: platform }, useWindowDimensions: () => ({ width: 390, height: 844 }),
      AppState: { currentState: 'active', addEventListener: (_: string, cb: typeof appStateChanged) => {
        appStateChanged = cb; return { remove: vi.fn() };
      } },
    },
    'expo-camera': { CameraView, useCameraPermissions: () => [{ granted }, vi.fn()] },
    'expo-router': { useRouter: () => ({}), useLocalSearchParams: () => ({ category: 'sports', tipsAcked: '1' }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-haptics': { impactAsync: vi.fn(), ImpactFeedbackStyle: { Medium: 'medium' } },
    'expo-image-picker': {}, 'expo-image-manipulator': {}, 'expo-status-bar': { StatusBar: 'StatusBar' },
    '@/lib/constants': { Colors: new Proxy({}, { get: () => shades }) },
    '@/assets/images/dcm-logo.png': 1,
    '@/lib/imageUtils': {
      processCardCapture, assessQuality: () => ({ score: 90, resolutionLabel: '2000 × 2800', width: 2000, height: 2800, suggestions: [] }),
      hashImage: async () => 'hash', computeGuideWidthFraction: () => 0.7,
    },
    '@/lib/blurCheck': { measureSharpness: async () => null },
    '@/components/ui/Button': { default: 'Button' },
    '@/components/PhotoTipsModal': { default: 'PhotoTips', shouldShowPhotoTips: async () => false },
    '@/lib/uploadTelemetry': { reportUploadEvent, beginCaptureAttempt: vi.fn() },
    '@/hooks/useResponsive': { useResponsive: () => ({ isTablet: false }) },
    '@/lib/cameraControls': { hasCaptureControls: () => false, focusCamera, cancelCameraFocus: vi.fn() },
  }).default;
  await act(() => { tree = create(React.createElement(Screen)); });
  return {
    takePictureAsync, processCardCapture, focusCamera, reportUploadEvent,
    appState: (state: string) => appStateChanged(state),
    shutter: () => tree.root.findByProps({ accessibilityLabel: 'Capture front photo' }),
    ready: async () => { await act(() => tree.root.findByType('CameraView').props.onCameraReady()); },
  };
}

describe('camera OTA on existing native binaries', () => {
  it.each(['ios', 'android'])('captures on %s using only the supported file API and guards duplicate taps', async platform => {
    const app = await mount(platform);
    expect(app.shutter().props.disabled).toBe(true);
    expect(tree.root.findByType('CameraView').props.autofocus).toBe('off');
    expect(tree.root.findByType('CameraView').props.pictureSize).toBe(platform === 'ios' ? 'Photo' : undefined);
    await app.ready();
    await act(() => { app.shutter().props.onPress(); app.shutter().props.onPress(); });
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(app.takePictureAsync).toHaveBeenCalledOnce();
    expect(app.takePictureAsync).toHaveBeenCalledWith({ quality: 1, shutterSound: false });
    expect(app.focusCamera).not.toHaveBeenCalled();
    expect(app.processCardCapture.mock.calls[0][0]).toBe('file://capture.jpg');
    expect(app.reportUploadEvent).toHaveBeenCalledWith(expect.objectContaining({
      capture_method: 'native_camera_file', metadata: expect.objectContaining({ native_controls: false, sharpness_status: 'unknown' }),
    }));
    expect(JSON.stringify(tree.toJSON())).toContain('Focus could not be checked.');
  });

  it('cancels a pending shutter on backgrounding and waits for camera readiness on resume', async () => {
    const app = await mount();
    await app.ready();
    await act(() => app.shutter().props.onPress());
    await act(() => app.appState('background'));
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(app.takePictureAsync).not.toHaveBeenCalled();
    expect(tree.root.findAllByType('CameraView')).toHaveLength(0);
    await act(() => app.appState('active'));
    expect(app.shutter().props.disabled).toBe(true);
    await app.ready();
    expect(app.shutter().props.disabled).toBe(false);
  });

  it('offers Gallery when camera access is denied', async () => {
    await mount('android', false);
    await act(() => tree.root.findByProps({ title: 'Use Gallery' }).props.onPress());
    expect(tree.root.findAllByProps({ title: 'Grant Camera Access' })).toHaveLength(0);
    expect(tree.root.findAllByType('CameraView')).toHaveLength(0);
  });

  it('processes old-binary file captures in one pass without any image-reference API', async () => {
    const manipulateAsync = vi.fn().mockResolvedValue({ uri: 'file://result.jpg', width: 2143, height: 3000 });
    const imageUtils = load('dcm-mobile/lib/imageUtils.ts', {
      'expo-image-manipulator': { manipulateAsync, SaveFormat: { JPEG: 'jpeg' } },
      'expo-crypto': {}, './captureGeometry': {},
    });
    const result = await imageUtils.processCardCapture('file://input.jpg', 'portrait', { width: 4000, height: 6000 });
    expect(manipulateAsync).toHaveBeenCalledOnce();
    const [uri, actions, options] = manipulateAsync.mock.calls[0];
    expect(uri).toBe('file://input.jpg');
    expect(actions).toHaveLength(2);
    expect(actions[0].crop.width).toBeGreaterThan(3000);
    expect(actions[1]).toEqual({ resize: { height: 3000 } });
    expect(options).toEqual({ compress: 0.92, format: 'jpeg' });
    expect(result.uri).toBe('file://result.jpg');
  });
});
