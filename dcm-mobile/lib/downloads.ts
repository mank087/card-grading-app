import { Alert, Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

/**
 * Persist a base64 file to a working location for preview/sharing. On iOS the
 * preview file lives in cacheDirectory (OS-managed, invisible to the user) —
 * the user-facing save happens later via saveToDocuments() when they tap
 * Download.
 */
export async function persistBase64ToCache(name: string, base64: string): Promise<string> {
  const dir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory
  const path = `${dir}${name}`
  await FileSystem.writeAsStringAsync(path, base64, { encoding: 'base64' as any })
  return path
}

/**
 * Copy a previously-persisted file into the app's Documents folder. On iOS,
 * UIFileSharingEnabled + LSSupportsOpeningDocumentsInPlace (set in app.json)
 * expose this folder to the Files app under "On My iPhone → DCM Grading", so
 * users can find downloaded labels and reports there.
 */
export async function saveToDocuments(name: string, sourcePath: string): Promise<string> {
  const docDir = (FileSystem as any).documentDirectory as string | null
  if (!docDir) return sourcePath
  const destPath = `${docDir}${name}`
  try { await FileSystem.deleteAsync(destPath, { idempotent: true }) } catch {}
  await FileSystem.copyAsync({ from: sourcePath, to: destPath })
  return destPath
}

type SaveSuccessOpts = {
  fileName: string
  filePath: string
  mime: string
  onShareError?: (err: unknown) => void
}

/**
 * Show a cross-platform "saved" confirmation with optional Share button. On
 * iOS the message points the user to the Files app location; on Android we
 * also offer Share since the system browser handled the actual save earlier.
 */
export function presentSaveSuccess(opts: SaveSuccessOpts) {
  const { fileName, filePath, mime, onShareError } = opts
  const message = Platform.OS === 'ios'
    ? `${fileName}\n\nFind it in the Files app:\nOn My iPhone → DCM Grading`
    : `${fileName} saved.`
  Alert.alert('Saved', message, [
    { text: 'OK', style: 'default' },
    {
      text: 'Share…',
      onPress: async () => {
        try {
          if (!(await Sharing.isAvailableAsync())) return
          await Sharing.shareAsync(filePath, {
            mimeType: mime,
            dialogTitle: fileName,
            UTI: mime === 'application/pdf' ? 'com.adobe.pdf' : undefined,
          })
        } catch (err) {
          onShareError?.(err)
        }
      },
    },
  ])
}
