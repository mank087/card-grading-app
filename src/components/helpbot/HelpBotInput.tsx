'use client'

import { useState } from 'react'

interface Props {
  onSend: (message: string) => void
}

export default function HelpBotInput({ onSend }: Props) {
  const [value, setValue] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 border-t border-gray-200">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type your question..."
        className="flex-1 px-3 py-2 text-sm rounded-full border border-gray-300 focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none bg-white"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-purple-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors shrink-0"
        aria-label="Send message"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </form>
  )
}
