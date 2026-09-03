/**
 * Per-row editor for a bulk batch: title & price, description, item specifics,
 * photos.
 *
 * Web twin: src/app/instalist-marketplace/bulk/[batchId]/BulkItemDrawer.tsx.
 * Same four panes, same field rules — one sheet rather than three, because all
 * of it is "open this row and fix it" and a seller working down a 100-card list
 * should not have to learn several panels.
 *
 * The eBay content rules are enforced on the DRAFT, not only at publish time,
 * so the checks below are the client half of what the item PATCH does: a title
 * naming a rival grading company or carrying a web address is refused there
 * with a 400, and refused here before the round trip. The server stays the
 * authority — anything this misses comes back as the server's own sentence,
 * rendered inline.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, Modal, ScrollView, TextInput, TouchableOpacity, Image,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Colors } from '@/lib/constants'
import { findBlockedGrader } from '@/lib/ebayGradingCompanyBlocklist'
import { containsLinkOrUrl } from '@/lib/ebayListingLinks'
import {
  updateItem, deleteItem, regenerateItem, recheckItem,
  type BulkItemPatch,
} from '@/lib/ebayBulkApi'
import {
  EBAY_TITLE_MAX,
  type BulkItem, type BulkItemSpecific, type BulkCard,
} from '@/lib/ebayBulkTypes'

type Tab = 'details' | 'description' | 'specifics' | 'images'

const TABS: { id: Tab; label: string }[] = [
  { id: 'details', label: 'Title & price' },
  { id: 'description', label: 'Description' },
  { id: 'specifics', label: 'Specifics' },
  { id: 'images', label: 'Photos' },
]

interface Props {
  visible: boolean
  batchId: string
  item: BulkItem
  card: BulkCard | undefined
  /**
   * Draft batch → true for every row. Otherwise the server only accepts edits
   * to rows the drain has finished with, so this mirrors its rule and keeps the
   * fields read-only rather than letting the seller type into a 409.
   */
  editable: boolean
  /**
   * Photos are fixed once a batch has run: re-rendering slab art belongs to the
   * review step, and the drain publishes whatever URLs the row already carries.
   * Web parity with the drawer's `repair` mode.
   */
  photosEditable: boolean
  onClose: () => void
  /** A server-returned row — merge it into the list without a refetch. */
  onItemChanged: (item: BulkItem) => void
  onItemRemoved: (itemId: string) => void
  /** Hand this row to the photo pass (after a retry or a successful re-check). */
  onEnqueuePhotos: (itemId: string) => void
  /**
   * Repair mode only: put this row back in the publish queue. Resolves to a
   * sentence to show the seller, or null when the row really was re-queued —
   * the caller owns the retry route because it also has to apply the batch it
   * can return (a retry reopens a finished batch).
   */
  onRetry?: () => Promise<string | null>
}

/** Postgres numeric arrives as a string often enough to normalise both. */
function priceToInput(price: BulkItem['price']): string {
  if (price == null || price === '') return ''
  const n = typeof price === 'string' ? Number(price) : price
  return Number.isFinite(n) ? String(n) : ''
}

function sameSpecifics(a: BulkItemSpecific[], b: BulkItemSpecific[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export default function BulkItemSheet({
  visible, batchId, item, card, editable, photosEditable,
  onClose, onItemChanged, onItemRemoved, onEnqueuePhotos, onRetry,
}: Props) {
  const insets = useSafeAreaInsets()

  const [tab, setTab] = useState<Tab>('details')
  const [title, setTitle] = useState(item.title ?? '')
  const [price, setPrice] = useState(priceToInput(item.price))
  const [html, setHtml] = useState(item.description_html ?? '')
  const [specifics, setSpecifics] = useState<BulkItemSpecific[]>(item.item_specifics ?? [])
  const [urls, setUrls] = useState<string[]>(item.image_urls ?? [])
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<null | 'regenerate' | 'recheck' | 'remove' | 'photos' | 'retry'>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (visible) { setTab('details'); setError(null); setNote(null) }
  }, [visible, item.id])

  /* ---------------------------------------------------------- validity -- */

  const trimmedTitle = title.trim()
  const blockedGrader = useMemo(() => findBlockedGrader(trimmedTitle), [trimmedTitle])
  const titleHasLink = useMemo(() => containsLinkOrUrl(trimmedTitle), [trimmedTitle])
  const titleError =
    trimmedTitle.length === 0
      ? 'A listing needs a title.'
      : trimmedTitle.length > EBAY_TITLE_MAX
        ? `Titles are limited to ${EBAY_TITLE_MAX} characters (yours is ${trimmedTitle.length}).`
        : blockedGrader
          ? `eBay listings can't name another grading company. Remove "${blockedGrader}" — a graded-card title naming a rival grader reads as a grade-equivalence claim and eBay pulls the listing.`
          : titleHasLink
            ? "Titles can't contain a web address, link or email address."
            : null

  /* ------------------------------------------------------------- patch -- */

  /** Only what actually changed — every field sent sets its `*_edited` flag. */
  const patch = useMemo((): BulkItemPatch => {
    const out: BulkItemPatch = {}
    if (trimmedTitle !== (item.title ?? '').trim()) out.title = trimmedTitle
    const currentPrice = priceToInput(item.price)
    if (price.trim() !== currentPrice) out.price = price.trim() === '' ? null : price.trim()
    if (html !== (item.description_html ?? '')) out.description_html = html
    if (!sameSpecifics(specifics, item.item_specifics ?? [])) out.item_specifics = specifics
    if (JSON.stringify(urls) !== JSON.stringify(item.image_urls ?? [])) out.image_urls = urls
    return out
  }, [trimmedTitle, price, html, specifics, urls, item])

  const dirty = Object.keys(patch).length > 0

  /**
   * An empty (or otherwise refused) title must not lock the seller out of
   * saving a price or a specific they came in to fix — only a title they
   * actually touched can block the button.
   */
  const titleBlocksSave = !!titleError && patch.title !== undefined

  const patchRef = useRef(patch)
  useEffect(() => { patchRef.current = patch }, [patch])

  /**
   * Re-seed when the sheet is pointed at another row, when it opens, and when
   * the row comes back from the server (a regenerate, a re-check, the photo
   * pass finishing). Keyed on `updated_at` rather than the field values: the
   * review screen re-reads the batch every 3 s, and depending on the values
   * meant every poll wiped whatever was half-typed.
   */
  const seededIdRef = useRef<string | null>(null)
  useEffect(() => {
    const sameRow = seededIdRef.current === item.id
    seededIdRef.current = item.id
    if (sameRow && Object.keys(patchRef.current).length > 0) {
      // Mid-edit: the photo pass finishing THIS row still has to land, but the
      // typed fields are the seller's. A reordered photo list is an edit too,
      // so that is left alone as well.
      if (!patchRef.current.image_urls) setUrls(item.image_urls ?? [])
      return
    }
    setTitle(item.title ?? '')
    setPrice(priceToInput(item.price))
    setHtml(item.description_html ?? '')
    setSpecifics(item.item_specifics ?? [])
    setUrls(item.image_urls ?? [])
  }, [item.id, item.updated_at, visible]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    if (!editable || !dirty || titleBlocksSave || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await updateItem(batchId, item.id, patch)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      onItemChanged(res.item)
      onClose()
    } catch (err) {
      // 400s and 409s here are server-authored seller copy (a too-long title, a
      // blocked grader, "this batch is no longer editable") — shown verbatim.
      setError(err instanceof Error ? err.message : 'Could not save that change.')
    } finally {
      setSaving(false)
    }
  }, [editable, dirty, titleBlocksSave, saving, batchId, item.id, patch, onItemChanged, onClose])

  /* ----------------------------------------------------------- actions -- */

  const handleRegenerate = useCallback(() => {
    Alert.alert(
      'Rebuild this listing?',
      'The title, price, description and item specifics go back to what DCM generated. Anything you typed on this row is lost. Photos are untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rebuild',
          style: 'destructive',
          onPress: async () => {
            setBusy('regenerate')
            setError(null)
            try {
              const res = await regenerateItem(batchId, item.id)
              onItemChanged(res.item)
              setNote('Listing rebuilt from the card.')
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not rebuild this row.')
            } finally {
              setBusy(null)
            }
          },
        },
      ],
    )
  }, [batchId, item.id, onItemChanged])

  const handleRemove = useCallback(() => {
    Alert.alert(
      'Remove from batch?',
      'This card is taken out of the batch. The card itself and its grade are untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusy('remove')
            setError(null)
            try {
              await deleteItem(batchId, item.id)
              onItemRemoved(item.id)
              onClose()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not remove this card.')
              setBusy(null)
            }
          },
        },
      ],
    )
  }, [batchId, item.id, onItemRemoved, onClose])

  /**
   * A skipped card can stop being blocked while the seller is still reviewing
   * (they ended the eBay listing, or an abandoned claim aged out). The server
   * re-runs the publish path's own conflict check; a row that comes back still
   * needs its photos, which were never rendered.
   */
  const handleRecheck = useCallback(async () => {
    setBusy('recheck')
    setError(null)
    setNote(null)
    try {
      const res = await recheckItem(batchId, item.id)
      onItemChanged(res.item)
      if (res.stillListed) {
        setNote('Still listed on eBay.')
      } else if (res.changed) {
        setNote('This card is free to list again.')
        if (res.item.image_status === 'pending') onEnqueuePhotos(item.id)
      } else {
        setNote('Nothing changed for this card.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not re-check this card.')
    } finally {
      setBusy(null)
    }
  }, [batchId, item.id, onItemChanged, onEnqueuePhotos])

  /**
   * A row whose photo render failed is otherwise a dead end: the pass only
   * picks up `pending` rows. Flip it back and hand it to the pass.
   */
  const handleRetryPhotos = useCallback(async () => {
    setBusy('photos')
    setError(null)
    try {
      const res = await updateItem(batchId, item.id, { image_status: 'pending' })
      onItemChanged(res.item)
      onEnqueuePhotos(item.id)
      setNote('Preparing this card’s photos again…')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not retry the photos.')
    } finally {
      setBusy(null)
    }
  }, [batchId, item.id, onItemChanged, onEnqueuePhotos])

  /**
   * Repair mode: hand the row back to the drain. Saving is a separate button on
   * purpose — the drain publishes what is stored, so a seller who typed a fix
   * and pressed Retry without saving would publish the old row. The note below
   * says which happened either way.
   */
  const handleRetryRow = useCallback(async () => {
    if (!onRetry) return
    setBusy('retry')
    setError(null)
    setNote(null)
    try {
      const message = await onRetry()
      if (message) setError(message)
      else setNote('Back in the queue — publishing picks it up from here.')
    } finally {
      setBusy(null)
    }
  }, [onRetry])

  const moveUrl = useCallback((index: number, delta: -1 | 1) => {
    setUrls(prev => {
      const target = index + delta
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }, [])

  const busyAny = saving || busy !== null

  /**
   * Retry only where a retry can do anything: once a batch has run the photos
   * are fixed, so the button would 409. A `ready` row with no photos left on it
   * (the seller deleted every tile) is the other dead end — same route out,
   * since the pass picks up any row flipped back to `pending`.
   */
  const photosRetryable = photosEditable && (
    item.image_status === 'failed' ||
    (item.image_status === 'ready' && (item.image_urls ?? []).length === 0)
  )

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {card?.card_name || 'Card'}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>{item.title || 'Untitled'}</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close row editor"
          >
            <Ionicons name="close" size={24} color={Colors.gray[600]} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tab, tab === t.id && styles.tabActive]}
              onPress={() => setTab(t.id)}
              accessibilityRole="button"
            >
              <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!editable && (
          <View style={styles.infoBanner}>
            <Ionicons name="lock-closed-outline" size={14} color={Colors.gray[600]} />
            <Text style={styles.infoBannerText}>
              This row can no longer be changed — it is being published, or is already on eBay.
            </Text>
          </View>
        )}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={14} color={Colors.red[600]} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}
        {note && (
          <View style={styles.noteBanner}>
            <Text style={styles.noteBannerText}>{note}</Text>
          </View>
        )}

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          {/* ── Title & price ───────────────────────────────────────────── */}
          {tab === 'details' && (
            <View>
              {/* Server-authored; names the exact eBay problem for this card. */}
              {!!item.error_message && (
                <View style={styles.serverMsgBox}>
                  <Text style={styles.serverMsgLabel}>eBay said</Text>
                  <Text style={styles.serverMsgText}>{item.error_message}</Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={[styles.input, styles.titleInput, !!titleError && styles.inputError]}
                value={title}
                editable={editable}
                onChangeText={t => setTitle(t)}
                maxLength={EBAY_TITLE_MAX}
                multiline
              />
              <Text
                style={[
                  styles.charCount,
                  trimmedTitle.length >= EBAY_TITLE_MAX && { color: Colors.amber[600], fontWeight: '700' },
                ]}
              >
                {trimmedTitle.length}/{EBAY_TITLE_MAX}
              </Text>
              {!!titleError && (
                <View style={styles.titleErrorBox}>
                  <Ionicons name="alert-circle" size={14} color={Colors.red[600]} />
                  <Text style={styles.titleErrorText}>{titleError}</Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>Price ($)</Text>
              <TextInput
                style={styles.input}
                value={price}
                editable={editable}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholder="Leave blank to fill in later"
                placeholderTextColor={Colors.gray[400]}
              />

              {(item.readiness?.length ?? 0) > 0 && (
                <Text style={styles.readinessLine}>
                  Still needed: {item.readiness!.map(r => r.label).join(', ')}
                </Text>
              )}
            </View>
          )}

          {/* ── Description ─────────────────────────────────────────────── */}
          {tab === 'description' && (
            <View>
              <Text style={styles.fieldLabel}>Listing description (HTML)</Text>
              <TextInput
                style={[styles.input, styles.htmlInput]}
                value={html}
                editable={editable}
                onChangeText={setHtml}
                multiline
                placeholder="Description will appear here once the row is drafted."
                placeholderTextColor={Colors.gray[400]}
              />
              <Text style={styles.helperText}>
                Links and web addresses are removed automatically — eBay&apos;s listing policy forbids
                them, even non-clickable ones.
              </Text>
            </View>
          )}

          {/* ── Item specifics ──────────────────────────────────────────── */}
          {tab === 'specifics' && (
            <View>
              {specifics.length === 0 && (
                <Text style={styles.mutedText}>No item specifics on this row yet.</Text>
              )}
              {specifics.map((spec, index) => {
                // eBay's MULTI-cardinality aspects (Player/Athlete, Features,
                // Character…) arrive as arrays and must go back as arrays —
                // flattening one to a single string makes it one nonsense value
                // in eBay's filters. Edited as a comma-separated line, re-split
                // on the way out.
                const isMulti = Array.isArray(spec.value)
                const rowEditable = editable && spec.editable !== false
                return (
                  <View key={`${spec.name}-${index}`} style={{ marginBottom: 10 }}>
                    <View style={styles.specHeader}>
                      <Text style={styles.fieldLabel}>
                        {spec.name}
                        {spec.required && <Text style={{ color: Colors.red[600] }}> *</Text>}
                      </Text>
                      {spec.editable === false && <Text style={styles.lockedText}>locked</Text>}
                    </View>
                    <TextInput
                      style={[styles.input, !rowEditable && styles.inputDisabled]}
                      value={isMulti ? (spec.value as string[]).join(', ') : (spec.value as string)}
                      editable={rowEditable}
                      onChangeText={raw => {
                        setSpecifics(prev => {
                          const next = [...prev]
                          next[index] = {
                            ...spec,
                            value: isMulti
                              ? raw.split(',').map(v => v.trim()).filter(Boolean)
                              : raw,
                          }
                          return next
                        })
                      }}
                      placeholder={spec.required ? `${spec.name} (required)` : 'Optional'}
                      placeholderTextColor={Colors.gray[400]}
                    />
                  </View>
                )
              })}
              <Text style={styles.helperText}>
                * required by eBay for this category. Leave a field blank rather than typing
                &quot;N/A&quot; — eBay treats a filled-in placeholder as answered. Fields that accept
                several values are comma-separated.
              </Text>
            </View>
          )}

          {/* ── Photos ──────────────────────────────────────────────────── */}
          {tab === 'images' && (
            <View>
              {item.image_status !== 'ready' && (
                <Text style={styles.mutedText}>
                  {item.image_status === 'failed'
                    ? 'Photos failed to prepare for this card.'
                    : 'Photos are still being prepared…'}
                </Text>
              )}
              {photosRetryable && (
                <TouchableOpacity
                  style={[styles.secondaryBtn, busyAny && styles.btnDisabled]}
                  onPress={handleRetryPhotos}
                  disabled={busyAny}
                  accessibilityRole="button"
                >
                  {busy === 'photos'
                    ? <ActivityIndicator size="small" color={Colors.purple[700]} />
                    : <Ionicons name="refresh" size={14} color={Colors.purple[700]} />}
                  <Text style={styles.secondaryBtnText}>Retry photos</Text>
                </TouchableOpacity>
              )}
              {urls.length === 0 && item.image_status === 'ready' && (
                <Text style={styles.mutedText}>No photos on this row — it cannot publish.</Text>
              )}

              <View style={styles.photoGrid}>
                {urls.map((url, index) => (
                  <View key={url} style={styles.photoTile}>
                    {index === 0 && (
                      <View style={styles.mainBadge}><Text style={styles.mainBadgeText}>MAIN</Text></View>
                    )}
                    <Image source={{ uri: url }} style={styles.photoThumb} resizeMode="cover" />
                    {photosEditable && editable && (
                      <View style={styles.photoActions}>
                        <TouchableOpacity
                          disabled={index === 0}
                          onPress={() => moveUrl(index, -1)}
                          style={[styles.photoBtn, index === 0 && styles.photoBtnDisabled]}
                          accessibilityLabel="Move photo earlier"
                        >
                          <Ionicons name="arrow-back" size={12} color={index === 0 ? Colors.gray[300] : Colors.purple[600]} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          disabled={index === urls.length - 1}
                          onPress={() => moveUrl(index, 1)}
                          style={[styles.photoBtn, index === urls.length - 1 && styles.photoBtnDisabled]}
                          accessibilityLabel="Move photo later"
                        >
                          <Ionicons name="arrow-forward" size={12} color={index === urls.length - 1 ? Colors.gray[300] : Colors.purple[600]} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setUrls(prev => prev.filter((_, i) => i !== index))}
                          style={styles.photoBtn}
                          accessibilityLabel="Remove photo"
                        >
                          <Ionicons name="close" size={12} color={Colors.red[600]} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              <Text style={styles.helperText}>
                {photosEditable && editable
                  ? 'The first photo is the one eBay shows in search results. Bulk listings use the generated slab photos — add your own from the single-card flow.'
                  : 'Photos are fixed once a batch has run — start a new batch to change them.'}
              </Text>
            </View>
          )}

          {/* ── Row actions ─────────────────────────────────────────────── */}
          {editable && (
            <View style={styles.actionsBlock}>
              {/* Repair mode. Re-check below is the draft-batch route (it 409s
                  once a batch has run), so a row that can retry shows only
                  this — the retry route does the same conflict check itself. */}
              {onRetry && (
                <TouchableOpacity
                  style={[styles.retryBtn, busyAny && styles.btnDisabled]}
                  onPress={handleRetryRow}
                  disabled={busyAny}
                  accessibilityRole="button"
                  accessibilityLabel={item.status === 'skipped' ? 'Re-check this card' : 'Retry this card'}
                >
                  {busy === 'retry'
                    ? <ActivityIndicator size="small" color={Colors.white} />
                    : <Ionicons name="refresh" size={14} color={Colors.white} />}
                  <Text style={styles.retryBtnText}>
                    {item.status === 'skipped' ? 'Re-check this card' : 'Retry this card'}
                  </Text>
                </TouchableOpacity>
              )}
              {item.status === 'skipped' && !onRetry && (
                <TouchableOpacity
                  style={[styles.secondaryBtn, busyAny && styles.btnDisabled]}
                  onPress={handleRecheck}
                  disabled={busyAny}
                  accessibilityRole="button"
                >
                  {busy === 'recheck'
                    ? <ActivityIndicator size="small" color={Colors.purple[700]} />
                    : <Ionicons name="search" size={14} color={Colors.purple[700]} />}
                  <Text style={styles.secondaryBtnText}>Re-check this card</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.secondaryBtn, busyAny && styles.btnDisabled]}
                onPress={handleRegenerate}
                disabled={busyAny}
                accessibilityRole="button"
              >
                {busy === 'regenerate'
                  ? <ActivityIndicator size="small" color={Colors.purple[700]} />
                  : <Ionicons name="sparkles-outline" size={14} color={Colors.purple[700]} />}
                <Text style={styles.secondaryBtnText}>Rebuild from the card</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ghostBtn, busyAny && styles.btnDisabled]}
                onPress={handleRemove}
                disabled={busyAny}
                accessibilityRole="button"
              >
                <Ionicons name="trash-outline" size={14} color={Colors.red[600]} />
                <Text style={styles.ghostBtnText}>Remove from batch</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: 12 + Math.max(insets.bottom, 4) }]}>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn} accessibilityRole="button">
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, (!editable || !dirty || titleBlocksSave || busyAny) && styles.btnDisabled]}
            onPress={handleSave}
            disabled={!editable || !dirty || titleBlocksSave || busyAny}
            accessibilityRole="button"
            accessibilityLabel="Save row"
          >
            {saving
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray[50] },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[200],
  },
  headerTitle: { fontSize: 15, fontWeight: '800', color: Colors.gray[900] },
  headerSub: { fontSize: 11, color: Colors.gray[500], marginTop: 2 },

  tabRow: {
    flexDirection: 'row', backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[200],
    paddingHorizontal: 8,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.purple[600] },
  tabText: { fontSize: 11, fontWeight: '600', color: Colors.gray[500] },
  tabTextActive: { color: Colors.purple[700] },

  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  fieldLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray[500], marginBottom: 4, marginTop: 8 },
  helperText: { fontSize: 10, color: Colors.gray[500], marginTop: 6, lineHeight: 14 },
  mutedText: { fontSize: 12, color: Colors.gray[500], marginTop: 6, marginBottom: 6 },
  input: {
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray[200],
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.gray[900],
  },
  inputError: { borderColor: Colors.red[500] },
  inputDisabled: { backgroundColor: Colors.gray[100], color: Colors.gray[600] },
  titleInput: { minHeight: 68, textAlignVertical: 'top' },
  htmlInput: { minHeight: 260, textAlignVertical: 'top', fontSize: 11, fontFamily: 'SpaceMono' },
  charCount: { fontSize: 10, color: Colors.gray[400], textAlign: 'right', marginTop: 2 },
  titleErrorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: Colors.red[50], borderRadius: 8,
    borderWidth: 1, borderColor: Colors.red[500],
  },
  titleErrorText: { fontSize: 11, color: Colors.red[600], flex: 1, lineHeight: 15 },
  readinessLine: { fontSize: 11, color: Colors.amber[700], marginTop: 12, lineHeight: 15 },
  specHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lockedText: { fontSize: 9, fontStyle: 'italic', color: Colors.gray[400] },

  serverMsgBox: {
    backgroundColor: Colors.red[50], borderWidth: 1, borderColor: Colors.red[200],
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 4,
  },
  serverMsgLabel: { fontSize: 10, fontWeight: '800', color: Colors.red[700], marginBottom: 2 },
  serverMsgText: { fontSize: 11, color: Colors.red[700], lineHeight: 15 },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.gray[100],
  },
  infoBannerText: { flex: 1, fontSize: 11, color: Colors.gray[600], lineHeight: 15 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.red[50],
  },
  errorBannerText: { flex: 1, fontSize: 11, color: Colors.red[700], lineHeight: 15 },
  noteBanner: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.purple[50] },
  noteBannerText: { fontSize: 11, color: Colors.purple[700] },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  photoTile: {
    width: '31%', borderRadius: 8, borderWidth: 1, borderColor: Colors.gray[200],
    backgroundColor: Colors.white, overflow: 'hidden',
  },
  photoThumb: { width: '100%', aspectRatio: 0.75, backgroundColor: Colors.gray[100] },
  photoActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingVertical: 3, backgroundColor: Colors.purple[50],
    borderTopWidth: 1, borderTopColor: Colors.gray[200],
  },
  photoBtn: {
    paddingHorizontal: 5, paddingVertical: 3, borderRadius: 4,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.purple[200],
  },
  photoBtnDisabled: { borderColor: Colors.gray[200], backgroundColor: Colors.gray[50] },
  mainBadge: {
    position: 'absolute', top: 2, left: 2, zIndex: 10,
    backgroundColor: Colors.purple[600], paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  mainBadgeText: { color: Colors.white, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },

  actionsBlock: { marginTop: 24, gap: 8 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.purple[200], backgroundColor: Colors.purple[50],
    marginTop: 8,
  },
  secondaryBtnText: { fontSize: 12, fontWeight: '700', color: Colors.purple[700] },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 8, backgroundColor: Colors.purple[600],
  },
  retryBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.gray[200],
  },
  ghostBtnText: { fontSize: 12, fontWeight: '700', color: Colors.red[600] },
  btnDisabled: { opacity: 0.4 },

  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.gray[200],
  },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Colors.gray[600] },
  saveBtn: {
    flex: 1, backgroundColor: Colors.purple[600], borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
})
