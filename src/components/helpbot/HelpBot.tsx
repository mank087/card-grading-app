'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import HelpBotPanel from './HelpBotPanel'
import { type HelpBotMessageData } from './HelpBotMessage'
import {
  categories,
  knowledgeBase,
  getEntriesByCategory,
  getEntryById,
  getRelatedEntries,
  type Category,
} from './helpBotKnowledge'
import { searchKnowledge } from '@/lib/helpBotSearch'
import { nextScrollAwayHidden, scrollAwayMovementCounts } from '@/lib/helpBotScrollAway'

type ContextState =
  | { type: 'home' }
  | { type: 'category'; category: Category }
  | { type: 'answer' }

const STORAGE_KEY_EXPANDED = 'dcm_helpbot_expanded'
const STORAGE_KEY_FIRST_VISIT = 'dcm_helpbot_first_visit'
const SESSION_KEY_CONVERSATION = 'dcm_helpbot_conversation'

let nextId = 1
function genId() {
  return `msg-${nextId++}`
}

function buildWelcomeMessage(): HelpBotMessageData {
  return {
    id: genId(),
    role: 'bot',
    text: "Hi! I'm the DCM HelpBot. I can answer questions about grading, pricing, photo tips, and more. Pick a topic below or type your question.",
  }
}

function buildEscalationMessage(): HelpBotMessageData {
  return {
    id: genId(),
    role: 'bot',
    text: "I couldn't find a match for that. You can try rephrasing your question, or reach out to our team directly at admin@dcmgrading.com.",
    links: [{ label: 'Contact support', href: '/contact' }],
  }
}


/** Phones: where the bubble steps aside while scrolling. Matches the card page's phone layout. */
const PHONE_QUERY = '(max-width: 760px)'
/** How long after the reader stops scrolling before the bubble comes back. */
const REST_DELAY_MS = 700

/**
 * On a phone the bubble sat on top of whatever the reader was looking at
 * (mobile review, Sept 23). It now steps aside while they scroll down, comes
 * back when they scroll up or stop, and is always shown near the top of the
 * page. Desktop never hides it. The rule itself is `nextScrollAwayHidden`.
 */
function useScrollAwayOnPhones(): boolean {
  const [hidden, setHidden] = useState(false)
  const hiddenRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(PHONE_QUERY)
    let lastY = window.scrollY
    let rest: ReturnType<typeof setTimeout> | undefined

    // Decided synchronously against a ref, not inside a state updater, so the
    // comparison uses the position of THIS scroll event.
    const apply = (next: boolean) => {
      if (hiddenRef.current === next) return
      hiddenRef.current = next
      setHidden(next)
    }

    const onScroll = () => {
      if (!mq.matches) return
      const y = window.scrollY
      apply(nextScrollAwayHidden(hiddenRef.current, lastY, y))
      if (scrollAwayMovementCounts(lastY, y)) lastY = y
      if (rest) clearTimeout(rest)
      rest = setTimeout(() => apply(false), REST_DELAY_MS)
    }
    const onViewportChange = () => {
      if (!mq.matches) apply(false)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    mq.addEventListener?.('change', onViewportChange)
    return () => {
      window.removeEventListener('scroll', onScroll)
      mq.removeEventListener?.('change', onViewportChange)
      if (rest) clearTimeout(rest)
    }
  }, [])

  return hidden
}

export default function HelpBot() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState<HelpBotMessageData[]>([])
  const [currentContext, setCurrentContext] = useState<ContextState>({ type: 'home' })
  const [categoryQuestions, setCategoryQuestions] = useState<{ id: string; label: string }[]>([])
  const [showPulse, setShowPulse] = useState(false)
  const bubbleAway = useScrollAwayOnPhones()

  // Load state on mount
  useEffect(() => {
    // Check first visit for pulse animation
    try {
      const visited = localStorage.getItem(STORAGE_KEY_FIRST_VISIT)
      if (!visited) {
        setShowPulse(true)
        localStorage.setItem(STORAGE_KEY_FIRST_VISIT, 'true')
      }
    } catch {}

    // Restore conversation from session
    try {
      const saved = sessionStorage.getItem(SESSION_KEY_CONVERSATION)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.messages?.length) {
          setMessages(parsed.messages)
          setCurrentContext(parsed.context || { type: 'home' })
          setCategoryQuestions(parsed.categoryQuestions || [])
          // Ensure nextId is higher than any restored message
          for (const msg of parsed.messages) {
            const num = parseInt(msg.id.replace('msg-', ''), 10)
            if (!isNaN(num) && num >= nextId) nextId = num + 1
          }
        }
      }
    } catch {}

    // Restore expanded preference
    try {
      const expanded = localStorage.getItem(STORAGE_KEY_EXPANDED)
      if (expanded === 'true') {
        setIsExpanded(true)
      }
    } catch {}
  }, [])

  // Save conversation to session storage
  useEffect(() => {
    if (messages.length === 0) return
    try {
      sessionStorage.setItem(
        SESSION_KEY_CONVERSATION,
        JSON.stringify({ messages, context: currentContext, categoryQuestions })
      )
    } catch {}
  }, [messages, currentContext, categoryQuestions])

  // Save expanded preference
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EXPANDED, String(isExpanded))
    } catch {}
  }, [isExpanded])

  function toggleExpanded() {
    setIsExpanded((prev) => {
      const next = !prev
      if (next && messages.length === 0) {
        setMessages([buildWelcomeMessage()])
        setCurrentContext({ type: 'home' })
      }
      return next
    })
    setShowPulse(false)
  }

  const handleCategorySelect = useCallback((category: Category) => {
    const cat = categories.find((c) => c.id === category)
    const entries = getEntriesByCategory(category)
    const questions = entries.map((e) => ({ id: e.id, label: e.question }))

    setMessages((prev) => [
      ...prev,
      {
        id: genId(),
        role: 'user',
        text: `${cat?.emoji || ''} ${cat?.label || category}`,
      },
      {
        id: genId(),
        role: 'bot',
        text: `Here are common questions about ${cat?.label || category}:`,
      },
    ])
    setCategoryQuestions(questions)
    setCurrentContext({ type: 'category', category })
  }, [])

  const handleQuestionSelect = useCallback((questionId: string) => {
    const entry = getEntryById(questionId)
    if (!entry) return

    const related = getRelatedEntries(entry)
    const relatedButtons = related.slice(0, 3).map((r) => ({
      id: r.id,
      label: r.question,
    }))

    setMessages((prev) => [
      ...prev,
      {
        id: genId(),
        role: 'user',
        text: entry.question,
      },
      {
        id: genId(),
        role: 'bot',
        text: entry.answer,
        links: entry.links,
        topicButtons: relatedButtons.length > 0 ? relatedButtons : undefined,
        showFeedback: true,
        feedbackGiven: null,
      },
    ])
    setCategoryQuestions([])
    setCurrentContext({ type: 'answer' })
  }, [])

  const handleSend = useCallback((text: string) => {
    const userMsg: HelpBotMessageData = {
      id: genId(),
      role: 'user',
      text,
    }

    const results = searchKnowledge(text, knowledgeBase, 3)

    if (results.length > 0 && results[0].score >= 3) {
      const best = results[0].entry
      const related = getRelatedEntries(best)
      const otherResults = results.slice(1).map((r) => ({
        id: r.entry.id,
        label: r.entry.question,
      }))
      const relatedButtons = [
        ...otherResults,
        ...related.slice(0, 2).map((r) => ({ id: r.id, label: r.question })),
      ].slice(0, 3)

      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: genId(),
          role: 'bot',
          text: best.answer,
          links: best.links,
          topicButtons: relatedButtons.length > 0 ? relatedButtons : undefined,
          showFeedback: true,
          feedbackGiven: null,
        },
      ])
    } else {
      setMessages((prev) => [...prev, userMsg, buildEscalationMessage()])
    }

    setCategoryQuestions([])
    setCurrentContext({ type: 'answer' })
  }, [])

  const handleStartOver = useCallback(() => {
    setMessages([buildWelcomeMessage()])
    setCategoryQuestions([])
    setCurrentContext({ type: 'home' })
  }, [])

  const handleFeedback = useCallback((messageId: string, helpful: boolean) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, feedbackGiven: helpful ? 'yes' : 'no' }
          : msg
      )
    )

    if (!helpful) {
      setMessages((prev) => [
        ...prev,
        {
          id: genId(),
          role: 'bot',
          text: "Sorry about that. Try rephrasing your question, browse the topics above, or contact our support team for help.",
          links: [
            { label: 'Contact support', href: '/contact' },
            { label: 'View full FAQ', href: '/faq' },
          ],
        },
      ])
    }
  }, [])

  return (
    <>
      {/* Floating bubble */}
      {!isExpanded && (
        <button
          data-site-chrome="floating"
          data-helpbot="bubble"
          onClick={toggleExpanded}
          // Phones: 44px instead of 56px and 16px from the edge. While the
          // reader scrolls down it slides away and stops taking taps; keyboard
          // focus always brings it back. The pulse is suppressed while away,
          // because its opacity keyframes would otherwise flash it back in.
          className={`fixed bottom-6 right-6 w-14 h-14 max-[760px]:right-4 max-[760px]:w-11 max-[760px]:h-11 rounded-full bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 motion-reduce:transition-none z-40 flex items-center justify-center ${
            bubbleAway
              ? 'opacity-0 translate-y-3 pointer-events-none motion-reduce:translate-y-0 focus-visible:opacity-100 focus-visible:translate-y-0 focus-visible:pointer-events-auto'
              : ''
          } ${showPulse && !bubbleAway ? 'animate-pulse' : ''}`}
          aria-label="Open help chat"
        >
          <svg className="w-6 h-6 max-[760px]:w-5 max-[760px]:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      )}

      {/* Panel */}
      {isExpanded && (
        <HelpBotPanel
          messages={messages}
          currentContext={currentContext}
          onClose={toggleExpanded}
          onStartOver={handleStartOver}
          onCategorySelect={handleCategorySelect}
          onQuestionSelect={handleQuestionSelect}
          onSend={handleSend}
          onFeedback={handleFeedback}
          categoryQuestions={categoryQuestions}
        />
      )}
    </>
  )
}
