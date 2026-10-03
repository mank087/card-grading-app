import type { CameraView } from 'expo-camera'
import CameraManager from 'expo-camera/build/ExpoCameraManager'

export type FocusStatus = 'focused' | 'settled' | 'unfocused' | 'unsupported' | 'timeout' | 'cancelled' | 'unavailable'
export interface FocusResult { status: FocusStatus }
interface NativeCaptureView {
  dcmFocusAtPoint?: (x: number, y: number) => Promise<FocusResult>
  dcmCancelFocus?: () => Promise<void>
}

/** Native capability, not appVersion: an OTA must remain safe on older binaries. */
export function hasCaptureControls(): boolean {
  return Number(CameraManager.dcmCaptureControlsVersion) >= 1
}

function nativeView(camera: CameraView | null): NativeCaptureView | null {
  return (camera?._cameraRef.current as unknown as NativeCaptureView) ?? null
}

export async function focusCamera(camera: CameraView | null, x: number, y: number): Promise<FocusResult> {
  if (!hasCaptureControls() || !Number.isFinite(x) || !Number.isFinite(y)) return { status: 'unsupported' }
  const view = nativeView(camera)
  if (!view?.dcmFocusAtPoint) return { status: 'unavailable' }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      view.dcmFocusAtPoint(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))),
      new Promise<FocusResult>(resolve => { timer = setTimeout(() => {
        void view.dcmCancelFocus?.().catch(() => {})
        resolve({ status: 'timeout' })
      }, 3500) }),
    ])
  } catch { return { status: 'unavailable' } }
  finally { clearTimeout(timer) }
}

export function cancelCameraFocus(camera: CameraView | null): void {
  if (hasCaptureControls()) void nativeView(camera)?.dcmCancelFocus?.().catch(() => {})
}
