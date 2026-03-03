'use client'

import { useEffect, useRef } from 'react'
import HelpBotMessage, { type HelpBotMessageData } from './HelpBotMessage'
import HelpBotTopicButtons from './HelpBotTopicButtons'
import HelpBotInput from './HelpBotInput'
import { categories } from './helpBotKnowledge'
import type { Category } from './helpBotKnowledge'

interface Props {
  messages: HelpBotMessageData[]
  currentContext: { type: 'home' } | { type: 'category'; category: Category } | { type: 'answer' }
  onClose: () => void
  onStartOver: () => void
  onCategorySelect: (category: Category) => void
  onQuestionSelect: (questionId: string) => void
  onSend: (message: string) => void
  onFeedback: (messageId: string, helpful: boolean) => void
  categoryQuestions: { id: string; label: string }[]
}

export default function HelpBotPanel({
  messages,
  currentContext,
  onClose,
  onStartOver,
  onCategorySelect,
  onQuestionSelect,
  onSend,
  onFeedback,
  categoryQuestions,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const topicOptions = categories.map((c) => ({
    id: c.id,
    label: c.label,
    emoji: c.emoji,
  }))

  return (
    <div className="fixed bottom-6 right-6 w-[380px] max-h-[min(600px,80vh)] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 z-40 animate-fadeIn max-[640px]:bottom-0 max-[640px]:left-0 max-[640px]:right-0 max-[640px]:w-full max-[640px]:max-h-[85vh] max-[640px]:rounded-b-none max-[640px]:rounded-t-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 rounded-t-2xl shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">DCM HelpBot</h3>
            <p className="text-purple-200 text-xs">Instant answers</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {currentContext.type !== 'home' && (
            <button
              onClick={onStartOver}
              className="px-2.5 py-1 text-xs text-purple-200 hover:text-white hover:bg-white/20 rounded-full transition-colors"
            >
              Start over
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 text-white transition-colors"
            aria-label="Close help panel"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        {messages.map((msg) => (
          <HelpBotMessage
            key={msg.id}
            message={msg}
            onTopicSelect={onQuestionSelect}
            onFeedback={onFeedback}
          />
        ))}

        {/* Context-dependent buttons below messages */}
        {currentContext.type === 'home' && (
          <HelpBotTopicButtons
            topics={topicOptions}
            onSelect={(id) => onCategorySelect(id as Category)}
            variant="category"
          />
        )}

        {currentContext.type === 'category' && categoryQuestions.length > 0 && (
          <HelpBotTopicButtons
            topics={categoryQuestions}
            onSelect={onQuestionSelect}
            variant="subtopic"
          />
        )}
      </div>

      {/* Input */}
      <HelpBotInput onSend={onSend} />
    </div>
  )
}
