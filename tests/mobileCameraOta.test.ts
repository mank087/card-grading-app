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

async function mount(platform = 'android', granted = true, nativeControls = false) {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let appStateChanged: (state: string) => void = () => {};
  const takePictureAsync = vi.fn().mockResolvedValue({ uri: 'file://capture.jpg', width: 3000, height: 4000, release: vi.fn() });
  const photo = { uri: 'file://processed.jpg', width: 2000, height: 2800, fileSize: 840000 };
  const processCardCapture = vi.fn().mockResolvedValue(photo);
  const compressImage = vi.fn().mockResolvedValue(photo);
  const launchCameraAsync = vi.fn().mockResolvedValue({ canceled: true });
  const requestCameraPermissionsAsync = vi.fn().mockResolvedValue({ granted: true });
  const focusCamera = vi.fn().mockResolvedValue({ status: platform === 'android' ? 'focused' : 'settled' });
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
    'expo-haptics': { impactAsync: vi.fn(), selectionAsync: vi.fn().mockResolvedValue(undefined), ImpactFeedbackStyle: { Medium: 'medium' } },
    'expo-image-picker': { launchCameraAsync, requestCameraPermissionsAsync, CameraType: { back: 'back' } },
    'expo-image-manipulator': {}, 'expo-status-bar': { StatusBar: 'StatusBar' },
    '@/lib/constants': { Colors: new Proxy({}, { get: () => shades }) },
    '@/assets/images/dcm-logo.png': 1,
    '@/lib/imageUtils': {
      processCardCapture, compressImage, assessQuality: () => ({ score: 90, resolutionLabel: '2000 × 2800', width: 2000, height: 2800, suggestions: [] }),
      hashImage: async () => 'hash', computeGuideWidthFraction: () => 0.7,
    },
    '@/lib/blurCheck': { measureSharpness: async () => null },
    '@/components/ui/Button': { default: 'Button' },
    '@/components/PhotoTipsModal': { default: 'PhotoTips', shouldShowPhotoTips: async () => false },
    '@/lib/uploadTelemetry': { reportUploadEvent, beginCaptureAttempt: vi.fn() },
    '@/hooks/useResponsive': { useResponsive: () => ({ isTablet: false }) },
    '@/lib/cameraControls': { hasCaptureControls: () => nativeControls, focusCamera, cancelCameraFocus: vi.fn() },
  }).default;
  await act(() => { tree = create(React.createElement(Screen)); });
  return {
    takePictureAsync, processCardCapture, compressImage, focusCamera, reportUploadEvent, launchCameraAsync, requestCameraPermissionsAsync,
    appState: (state: string) => appStateChanged(state),
    shutter: () => tree.root.findByProps({ accessibilityLabel: 'Capture front photo' }),
    tap: () => tree.root.findByProps({ accessibilityLabel: nativeControls ? 'Tap the card to focus' : 'Tap to refocus' }),
    phoneCamera: () => tree.root.findByProps({ accessibilityLabel: 'Use Phone Camera' }),
    ready: async () => { await act(() => tree.root.findByType('CameraView').props.onCameraReady()); },
  };
}

describe('camera OTA on existing native binaries', () => {
  it.each(['ios', 'android'])('preserves a successful native tap until capture on %s, even after the reticle disappears', async platform => {
    const app = await mount(platform, true, true);
    await act(() => tree.root.findAllByType('View').find((view: any) => view.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 400, height: 600 } } }));
    await app.ready();
    await act(() => app.tap().props.onPress({ nativeEvent: { locationX: 100, locationY: 450 } }));
    expect(app.focusCamera).toHaveBeenCalledWith(expect.anything(), 0.25, 0.75);
    await act(() => vi.advanceTimersByTimeAsync(7000));
    expect(JSON.stringify(tree.toJSON())).toContain(platform === 'android' ? 'Focus held.' : 'Focus set.');
    await act(async () => { app.shutter().props.onPress(); await vi.advanceTimersByTimeAsync(1); });
    expect(app.focusCamera).toHaveBeenCalledOnce();
    expect(app.takePictureAsync).toHaveBeenCalledWith({ pictureRef: true, shutterSound: false });
  });

  it.each(['ios', 'android'])('restores tap-to-refocus on %s and returns to continuous AF without claiming a focus result', async platform => {
    const app = await mount(platform);
    expect(app.tap().props.disabled).toBe(true);
    await app.ready();
    await act(() => app.tap().props.onPress({ nativeEvent: { locationX: 120, locationY: 200 } }));
    expect(tree.root.findByType('CameraView').props.autofocus).toBe('on');
    expect(app.shutter().props.disabled).toBe(true);
    // Same-render taps cannot bypass the shutter's refocus guard.
    await act(() => app.shutter().props.onPress());
    await act(() => vi.advanceTimersByTimeAsync(150));
    expect(tree.root.findByType('CameraView').props.autofocus).toBe('off');
    expect(app.shutter().props.disabled).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(550));
    expect(app.shutter().props.disabled).toBe(false);
    expect(app.focusCamera).not.toHaveBeenCalled();
    expect(app.takePictureAsync).not.toHaveBeenCalled();
    expect(app.reportUploadEvent).not.toHaveBeenCalled();
  });

  it('resets a pending tap-refocus when the app backgrounds', async () => {
    const app = await mount();
    await app.ready();
    await act(() => app.tap().props.onPress({ nativeEvent: { locationX: 100, locationY: 100 } }));
    await act(() => app.appState('background'));
    expect(vi.getTimerCount()).toBe(0);
    await act(() => app.appState('active'));
    expect(tree.root.findByType('CameraView').props.autofocus).toBe('off');
    await app.ready();
    expect(app.shutter().props.disabled).toBe(false);
  });

  it('releases the embedded camera and preserves the full system-camera composition', async () => {
    const app = await mount();
    app.launchCameraAsync.mockImplementation(async () => {
      expect(tree.root.findAllByType('CameraView')).toHaveLength(0);
      return { canceled: false, assets: [{ uri: 'file://phone.jpg', width: 4000, height: 3000 }] };
    });
    await act(() => { app.phoneCamera().props.onPress(); });
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(app.launchCameraAsync).toHaveBeenCalledWith({ mediaTypes: ['images'], cameraType: 'back', allowsEditing: false, quality: 1, exif: false });
    expect(app.compressImage).toHaveBeenCalledWith('file://phone.jpg', { width: 4000, height: 3000 });
    expect(app.processCardCapture).not.toHaveBeenCalled();
    expect(app.reportUploadEvent).toHaveBeenCalledWith(expect.objectContaining({ capture_source: 'camera', capture_method: 'native_system_camera' }));
    expect(JSON.stringify(tree.toJSON())).toContain('Front');
  });

  it.each(['cancelled', 'denied', 'failed'])('recovers the embedded camera after a %s system camera attempt', async outcome => {
    const app = await mount();
    if (outcome === 'denied') app.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
    if (outcome === 'failed') app.launchCameraAsync.mockRejectedValue(new Error('Camera unavailable'));
    await act(() => app.phoneCamera().props.onPress());
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(tree.root.findAllByType('CameraView')).toHaveLength(1);
    expect(app.shutter().props.disabled).toBe(true);
    await app.ready();
    expect(app.shutter().props.disabled).toBe(false);
    expect(app.compressImage).not.toHaveBeenCalled();
    if (outcome === 'denied') expect(app.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('does not process a system-camera result after leaving the screen', async () => {
    const app = await mount();
    let finish: (value: any) => void = () => {};
    app.launchCameraAsync.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await act(() => app.phoneCamera().props.onPress());
    await act(() => vi.advanceTimersByTimeAsync(1));
    await act(() => tree.unmount());
    tree = undefined;
    await act(() => finish({ canceled: false, assets: [{ uri: 'file://stale.jpg', width: 4000, height: 3000 }] }));
    expect(app.compressImage).not.toHaveBeenCalled();
    expect(app.reportUploadEvent).not.toHaveBeenCalled();
  });

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
