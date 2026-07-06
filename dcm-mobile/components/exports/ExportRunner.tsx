import { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, Image, Modal, Pressable, TouchableOpacity, ActivityIndicator, Alert, Platform, StyleSheet, Linking } from 'react-native'
import { WebView } from 'react-native-webview'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'
import { persistBase64ToCache, saveToDocuments, presentSaveSuccess } from '@/lib/downloads'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Optional native print — `npx expo install expo-print expo-intent-launcher` lights it up.
let Print: any = null
let IntentLauncher: any = null
try { Print = require('expo-print') } catch {}
try { IntentLauncher = require('expo-intent-launcher') } catch {}

type ExportFile = { name: string; mime: string; dataUrl: string; localPath: string }

export type ExportSource = {
  /** Fully-qualified URL to load in the hidden WebView. MUST NOT include `download=1` — the page detects RN WebView and posts files back instead. */
  url: string
  /** Title shown in the preview modal header */
  title: string
}

type Props = {
  source: ExportSource | null
  onClose: () => void
}

/**
 * Self-contained "load a web export page, receive files, preview and save"
 * runner. Used by the card detail, collection batch, and label studio flows
 * for iOS — where data-URL anchor downloads from SFSafariViewController don't
 * trigger save UI. The page (e.g. /label-export/batch) detects the
 * ReactNativeWebView bridge and posts files as base64 via postMessage; we
 * persist them locally for preview, and on Download tap copy into Documents
 * (visible in Files app under "On My iPhone → DCM Grading").
 */
export default function ExportRunner({ source, onClose }: Props) {
  const insets = useSafeAreaInsets()
  const [files, setFiles] = useState<ExportFile[]>([])
  const [previewIdx, setPreviewIdx] = useState(0)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState<string | null>(null)

  const reset = useCallback(() => {
    setFiles([])
    setPreviewIdx(0)
    setStatus('')
    setError(null)
    setActionBusy(null)
  }, [])

  const close = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  // Generation watchdog. Cleared as soon as the page posts files (or an
  // error) back — otherwise a successful generation would flip to
  // "Generation timed out" if the user sat on the preview sheet past 90s.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearGenerationTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!source) return
    reset()
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      setError('Generation timed out after 90 seconds. The label generator may have failed silently or the page is still deploying. Try again in a minute.')
    }, 90_000)
    return clearGenerationTimeout
  }, [source, reset, clearGenerationTimeout])

  if (!source) return null

  const cur = files[previewIdx]

  const onDownload = async () => {
    if (!cur) return
    setActionBusy('download')
    try {
      const savedPath = await saveToDocuments(cur.name, cur.localPath)
      const mime = cur.mime
      const name = cur.name
      if (Platform.OS === 'ios') {
        close()
        setTimeout(() => {
          presentSaveSuccess({
            fileName: name,
            filePath: savedPath,
            mime,
            onShareError: (err: any) => Alert.alert('Share failed', err?.message || 'Could not open share sheet'),
          })
        }, 350)
        return
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(savedPath, {
          mimeType: mime,
          dialogTitle: name,
          UTI: mime === 'application/pdf' ? 'com.adobe.pdf' : undefined,
        })
      } else {
        Alert.alert('Saved', `File saved at ${savedPath}`)
      }
    } catch (err: any) {
      Alert.alert('Download failed', err?.message || 'Could not save file')
    } finally {
      setActionBusy(null)
    }
  }

  const onPrint = async () => {
    if (!cur) return
    setActionBusy('print')
    try {
      if (Print && typeof Print.printAsync === 'function') {
        if (Platform.OS === 'ios') {
          const localPath = cur.localPath
          close()
          setTimeout(async () => {
            try { await Print.printAsync({ uri: localPath }) }
            catch (err: any) { Alert.alert('Print failed', err?.message || 'Could not open print dialog') }
          }, 350)
          return
        }
        await Print.printAsync({ uri: cur.localPath })
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(cur.localPath, {
          mimeType: cur.mime,
          dialogTitle: 'Print ' + cur.name,
          UTI: cur.mime === 'application/pdf' ? 'com.adobe.pdf' : undefined,
        })
      }
    } catch (err: any) {
      Alert.alert('Print failed', err?.message || 'Could not open print dialog')
    } finally {
      setActionBusy(null)
    }
  }

  return (
    <Modal visible={!!source} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={s.backdrop} onPress={close}>
        <Pressable style={[s.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={e => e.stopPropagation()}>
          <View style={s.handle} />
          {error ? (
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Ionicons name="warning" size={36} color={Colors.red[600]} style={{ marginBottom: 8 }} />
              <Text style={s.title}>Export Failed</Text>
              <Text style={[s.subtitle, { textAlign: 'center', marginBottom: 12 }]}>{error}</Text>
              <TouchableOpacity onPress={close} style={s.btnCancel}>
                <Text style={s.btnCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : files.length > 0 && cur ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={s.title} numberOfLines={1}>{source.title}</Text>
                <TouchableOpacity onPress={close} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Ionicons name="close" size={22} color={Colors.gray[500]} />
                </TouchableOpacity>
              </View>
              {files.length > 1 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <TouchableOpacity disabled={previewIdx === 0} onPress={() => setPreviewIdx(i => Math.max(0, i - 1))} style={[s.pagerBtn, previewIdx === 0 && { opacity: 0.4 }]}>
                    <Ionicons name="chevron-back" size={16} color={Colors.purple[600]} />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 11, color: Colors.gray[600], fontWeight: '600' }} numberOfLines={1}>
                    {previewIdx + 1} of {files.length} · {cur.name}
                  </Text>
                  <TouchableOpacity disabled={previewIdx === files.length - 1} onPress={() => setPreviewIdx(i => Math.min(files.length - 1, i + 1))} style={[s.pagerBtn, previewIdx === files.length - 1 && { opacity: 0.4 }]}>
                    <Ionicons name="chevron-forward" size={16} color={Colors.purple[600]} />
                  </TouchableOpacity>
                </View>
              )}
              <View style={s.previewBox}>
                {cur.mime?.startsWith('image/') ? (
                  // file:// path beats data: URL — RN's Image bridge spikes
                  // memory on multi-MB base64 strings and the app can crash
                  // silently on iOS.
                  <Image source={{ uri: cur.localPath }} style={{ width: '100%', height: 360 }} resizeMode="contain" />
                ) : Platform.OS === 'ios' ? (
                  // WKWebView can blow past its memory budget on multi-MB
                  // data: URIs and bring the host app down; streaming from
                  // the on-disk file is safe.
                  <WebView
                    originWhitelist={['*']}
                    source={{ uri: cur.localPath }}
                    style={{ width: '100%', height: 380, backgroundColor: '#fff' }}
                    allowFileAccess
                    allowFileAccessFromFileURLs
                    allowUniversalAccessFromFileURLs
                  />
                ) : (
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 8 }}>
                    <Ionicons name="document-text" size={64} color={Colors.purple[600]} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.gray[800] }}>PDF Ready</Text>
                    <Text style={{ fontSize: 11, color: Colors.gray[500], textAlign: 'center', paddingHorizontal: 12 }} numberOfLines={2}>{cur.name}</Text>
                    <TouchableOpacity
                      style={s.pdfOpenBtn}
                      onPress={async () => {
                        try {
                          if (Platform.OS === 'android' && IntentLauncher?.startActivityAsync) {
                            const contentUri = await FileSystem.getContentUriAsync(cur.localPath)
                            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: contentUri, flags: 1, type: cur.mime })
                          } else {
                            await Linking.openURL(cur.localPath)
                          }
                        } catch {
                          if (await Sharing.isAvailableAsync()) {
                            await Sharing.shareAsync(cur.localPath, { mimeType: cur.mime, dialogTitle: 'Open with…' })
                          }
                        }
                      }}
                    >
                      <Ionicons name="eye-outline" size={12} color={Colors.purple[700]} />
                      <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.purple[700] }}>Open in PDF viewer</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity style={s.btnSave} disabled={actionBusy === 'download'} onPress={onDownload}>
                  {actionBusy === 'download'
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <><Ionicons name="download-outline" size={16} color="#fff" /><Text style={s.btnSaveText}>Download</Text></>}
                </TouchableOpacity>
                <TouchableOpacity style={s.btnCancelRow} disabled={actionBusy === 'print'} onPress={onPrint}>
                  {actionBusy === 'print'
                    ? <ActivityIndicator color={Colors.gray[700]} size="small" />
                    : <><Ionicons name="print-outline" size={16} color={Colors.gray[800]} /><Text style={s.btnCancelText}>Print</Text></>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <ActivityIndicator size="large" color={Colors.purple[600]} />
              <Text style={[s.title, { marginTop: 12 }]}>Generating…</Text>
              <Text style={[s.subtitle, { textAlign: 'center' }]}>{status || 'Building your file on the web — preview will appear here when ready.'}</Text>
            </View>
          )}
          {/* Hidden WebView that drives generation */}
          {source && !error && files.length === 0 && (
            <View pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden', top: -10000, left: -10000 }}>
              <WebView
                source={{ uri: source.url }}
                originWhitelist={['*']}
                javaScriptEnabled
                onLoadStart={() => setStatus('Loading export page…')}
                onMessage={async (e) => {
                  try {
                    const msg = JSON.parse(e.nativeEvent.data)
                    if (msg.type === 'status' && msg.message) {
                      setStatus(msg.message)
                      return
                    }
                    if (msg.type === 'label-export-ready' && Array.isArray(msg.files)) {
                      // Files have arrived — stop the watchdog immediately so
                      // a slow local persist / long preview dwell can't flip
                      // a successful export into "Generation timed out".
                      clearGenerationTimeout()
                      setStatus('Preparing preview…')
                      const ready: ExportFile[] = []
                      let firstError: string | null = null
                      for (const f of msg.files) {
                        const base64 = (f.dataUrl || '').split(',')[1] || ''
                        if (!base64) continue
                        try {
                          const localPath = await persistBase64ToCache(f.name, base64)
                          ready.push({ name: f.name, mime: f.mime, dataUrl: f.dataUrl, localPath })
                        } catch (err: any) {
                          if (!firstError) firstError = err?.message || 'Failed to save file locally'
                        }
                      }
                      setStatus('')
                      if (ready.length === 0) {
                        setError(firstError || 'No files generated')
                      } else {
                        setFiles(ready)
                        setPreviewIdx(0)
                      }
                    } else if (msg.type === 'error') {
                      clearGenerationTimeout()
                      setError(msg.message || 'Failed to generate label')
                    }
                  } catch (err: any) {
                    clearGenerationTimeout()
                    setError(err?.message || 'Failed to process file')
                  }
                }}
                onError={(syntheticEvent) => {
                  clearGenerationTimeout()
                  setError(syntheticEvent.nativeEvent?.description || 'WebView load error')
                }}
              />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 16 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.gray[300], alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  subtitle: { fontSize: 12, color: Colors.gray[600], marginTop: 4 },
  pagerBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.purple[50] },
  previewBox: { borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 10, overflow: 'hidden', backgroundColor: Colors.gray[50] },
  btnSave: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.purple[600] },
  btnSaveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnCancelRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.gray[100], borderWidth: 1, borderColor: Colors.gray[200] },
  btnCancel: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.gray[100], borderWidth: 1, borderColor: Colors.gray[200] },
  btnCancelText: { color: Colors.gray[800], fontSize: 14, fontWeight: '700' },
  pdfOpenBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: Colors.purple[50], borderRadius: 6, borderWidth: 1, borderColor: Colors.purple[200] },
})
