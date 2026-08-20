/**
 * Label Wizard — Step 1: choose 1-10 cards.
 *
 * Recently graded first, search to reach the rest of the collection, and a
 * persistent tray so the user can keep browsing without losing picks. The cap
 * matches one slab print sheet (2 × 5), stated on screen so it reads as a
 * feature, not a limit.
 */
'use client'

import React, { useMemo, useState } from 'react'
import { MAX_WIZARD_CARDS } from './wizardTypes'

const RECENT_COUNT = 12
const SEARCH_DISPLAY_CAP = 24

interface StepCardsProps {
  cards: any[]
  selected: any[]
  onToggle: (card: any) => void
  onRemove: (cardId: string) => void
  isAuthenticated: boolean
}

function gradeBadge(card: any): string | null {
  const g = card.conversational_whole_grade ?? card.conversational_decimal_grade
  if (g === null || g === undefined) return null
  return String(Math.round(Number(g)))
}

export function StepCards({ cards, selected, onToggle, onRemove, isAuthenticated }: StepCardsProps) {
  const [query, setQuery] = useState('')

  const selectedIds = useMemo(() => new Set(selected.map((c) => c.id)), [selected])

  const { shown, totalMatches, searching } = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return { shown: cards.slice(0, RECENT_COUNT), totalMatches: cards.length, searching: false }
    }
    const matches = cards.filter((c) => {
      const name = (c.card_name || c.conversational_card_info?.card_name || '').toLowerCase()
      const serial = String(c.serial || '').toLowerCase()
      const featured = (c.featured || c.pokemon_featured || '').toLowerCase()
      return name.includes(q) || serial.includes(q) || featured.includes(q)
    })
    return { shown: matches.slice(0, SEARCH_DISPLAY_CAP), totalMatches: matches.length, searching: true }
  }, [cards, query])

  const atCap = selected.length >= MAX_WIZARD_CARDS

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Choose your cards</h2>
          <p className="text-sm text-gray-500">
            Pick up to {MAX_WIZARD_CARDS} — up to two printed label sheets.
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or serial…"
          className="w-full sm:w-72 px-3.5 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          aria-label="Search your cards"
        />
      </div>

      {!isAuthenticated && (
        <div className="mb-4 px-4 py-2.5 bg-purple-50 border border-purple-100 rounded-lg text-sm text-purple-800">
          You&apos;re browsing sample cards. Sign in to design labels for your own graded cards.
        </div>
      )}

      {cards.length === 0 ? (
        <div className="py-12 text-center text-gray-500 text-sm">
          No graded cards yet. Grade a card first, then come back to design its label.
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            {searching
              ? `${totalMatches} match${totalMatches === 1 ? '' : 'es'}${totalMatches > shown.length ? ` — showing ${shown.length}, refine your search` : ''}`
              : 'Recently graded'}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {shown.map((card) => {
              const isSelected = selectedIds.has(card.id)
              const order = isSelected ? selected.findIndex((c) => c.id === card.id) + 1 : null
              const disabled = !isSelected && atCap
              const grade = gradeBadge(card)
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onToggle(card)}
                  disabled={disabled}
                  aria-pressed={isSelected}
                  className={`relative rounded-lg border-2 p-1.5 text-left transition-all ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50 shadow-sm'
                      : disabled
                        ? 'border-gray-200 opacity-40 cursor-not-allowed'
                        : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="aspect-[3/4] bg-gray-100 rounded overflow-hidden mb-1.5">
                    {card.front_url ? (
                      <img src={card.front_url} alt={card.card_name || 'Card'} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No image</div>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-gray-800 truncate">
                    {card.card_name || card.conversational_card_info?.card_name || 'Card'}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">#{card.serial}</p>
                  {grade && (
                    <span className="absolute top-2.5 right-2.5 min-w-[1.35rem] h-[1.35rem] px-1 rounded bg-purple-600 text-white text-[11px] font-bold flex items-center justify-center">
                      {grade}
                    </span>
                  )}
                  {order !== null && (
                    <span className="absolute top-2.5 left-2.5 w-[1.35rem] h-[1.35rem] rounded-full bg-white border-2 border-purple-600 text-purple-700 text-[11px] font-bold flex items-center justify-center">
                      {order}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {!searching && cards.length > RECENT_COUNT && (
            <p className="text-xs text-gray-400 mt-3">
              Showing your {RECENT_COUNT} most recent cards — search to reach the other {cards.length - RECENT_COUNT}.
            </p>
          )}
        </>
      )}

      {/* Selection tray */}
      {selected.length > 0 && (
        <div className="mt-5 p-3 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">
              {selected.length} of {MAX_WIZARD_CARDS} selected
              {atCap && <span className="ml-2 text-xs font-normal text-amber-600">Sheet is full</span>}
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {selected.map((card, i) => (
              <div key={card.id} className="relative shrink-0 w-12">
                <div className="aspect-[3/4] bg-gray-200 rounded overflow-hidden">
                  {card.front_url && (
                    <img src={card.front_url} alt={card.card_name || `Card ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(card.id)}
                  aria-label={`Remove ${card.card_name || 'card'}`}
                  className="absolute -top-1.5 -right-1.5 min-w-[20px] min-h-[20px] rounded-full bg-gray-700 text-white text-[10px] leading-none flex items-center justify-center hover:bg-red-600 after:content-[''] after:absolute after:-inset-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default StepCards
