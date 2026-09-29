'use client'

import { useState } from 'react'
import { useNotesProfiles } from '@/hooks/useNotesProfiles'
import { NOTES_PROFILE_NAME_MAX } from '@/lib/notesProfiles'
import { CARD_NOTES_MAX_LENGTH } from '@/lib/userConditionFields'
import type { RunNotesLock } from '@/lib/gradingRun'

interface CardNotesFieldProps {
  value: string
  onChange: (text: string) => void
  /** The run's locked notes, if any (pre-fills every card). */
  lockedNotes: RunNotesLock | null
  onLock: (notes: RunNotesLock) => void
  onUnlock: () => void
  label?: string
  hint?: string
  disabled?: boolean
}

/**
 * Card notes textarea + saved notes profiles + "use for every card" lock.
 * Used by the single-upload condition step and the bulk intake page, so a
 * profile saved in one shows up in the other.
 */
export default function CardNotesField({
  value,
  onChange,
  lockedNotes,
  onLock,
  onUnlock,
  label = 'Card notes',
  hint = 'Describe unique art styles, textures, serial numbering, or features that could be mistaken for defects.',
  disabled = false,
}: CardNotesFieldProps) {
  const { profiles, available, saveProfile, deleteProfile } = useNotesProfiles()
  const [selectedId, setSelectedId] = useState<string>(lockedNotes?.profileId ?? '')
  const [naming, setNaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null)

  const selected = profiles.find(p => p.id === selectedId) || null

  const applyProfile = (id: string) => {
    setSelectedId(id)
    setMessage(null)
    const profile = profiles.find(p => p.id === id)
    if (profile) onChange(profile.text.slice(0, CARD_NOTES_MAX_LENGTH))
  }

  const handleSave = async () => {
    setBusy(true)
    const result = await saveProfile({ name: newName, text: value })
    setBusy(false)
    if (result.error || !result.saved) {
      setMessage({ tone: 'error', text: result.error || 'Could not save the profile.' })
      return
    }
    setSelectedId(result.saved.id)
    setNaming(false)
    setNewName('')
    setMessage({ tone: 'ok', text: `Saved “${result.saved.name}”.` })
  }

  const handleDelete = async () => {
    if (!selected) return
    setBusy(true)
    const result = await deleteProfile(selected.id)
    setBusy(false)
    if (result.error) {
      setMessage({ tone: 'error', text: result.error })
      return
    }
    setMessage({ tone: 'ok', text: `Deleted “${selected.name}”.` })
    setSelectedId('')
  }

  const handleLock = () => {
    const text = value.trim()
    if (!text) return
    // Name the lock after the profile only when the text is still that profile's.
    const fromProfile = selected && selected.text.trim() === text ? selected : null
    onLock({
      profileId: fromProfile?.id ?? null,
      name: fromProfile?.name ?? 'Custom notes',
      text,
    })
  }

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <label htmlFor="card-notes" className="text-sm font-semibold text-gray-800">{label}</label>
        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded-full uppercase">Optional</span>
      </div>
      <p className="text-xs text-gray-500 mb-2">{hint}</p>

      {/* Saved profiles */}
      {available && (profiles.length > 0 || value.trim()) && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {profiles.length > 0 && (
            <select
              value={selectedId}
              onChange={(e) => applyProfile(e.target.value)}
              disabled={disabled}
              aria-label="Saved notes profile"
              className="flex-1 min-w-[10rem] px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
            >
              <option value="">Use a saved notes profile…</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {!naming && value.trim() && (
            <button
              type="button"
              onClick={() => { setNaming(true); setNewName(selected?.name ?? ''); setMessage(null) }}
              disabled={disabled || busy}
              className="px-3 py-2 text-xs font-semibold border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Save as profile
            </button>
          )}
          {selected && !naming && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={disabled || busy}
              className="px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      )}

      {naming && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value.slice(0, NOTES_PROFILE_NAME_MAX))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
            placeholder="Profile name, e.g. Topps Chrome Refractor"
            autoFocus
            className="flex-1 min-w-[10rem] px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !newName.trim()}
            className="px-3 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => { setNaming(false); setNewName('') }}
            className="px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      )}

      <textarea
        id="card-notes"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, CARD_NOTES_MAX_LENGTH))}
        disabled={disabled}
        placeholder="e.g., &quot;Refractor finish with a rainbow sheen — not surface damage&quot; or &quot;Serial numbered /99 on the back&quot;"
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 bg-white placeholder-gray-400 resize-none"
        rows={3}
        maxLength={CARD_NOTES_MAX_LENGTH}
      />
      <div className="flex items-center justify-between gap-2 mt-1 flex-wrap">
        {lockedNotes ? (
          <span className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-xs font-semibold">
            <span aria-hidden="true">🔒</span>
            Notes locked: {lockedNotes.name}
            <button
              type="button"
              onClick={onUnlock}
              aria-label="Unlock notes"
              className="ml-1 text-indigo-600 hover:text-indigo-900"
            >
              ✕
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={handleLock}
            disabled={disabled || !value.trim()}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            🔒 Use these notes for every card
          </button>
        )}
        <span className={`text-xs ${value.length > 450 ? 'text-amber-600' : 'text-gray-400'}`}>
          {value.length}/{CARD_NOTES_MAX_LENGTH}
        </span>
      </div>
      {message && (
        <p className={`text-xs mt-1 ${message.tone === 'error' ? 'text-red-700' : 'text-green-700'}`}>{message.text}</p>
      )}
    </div>
  )
}
