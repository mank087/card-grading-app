import Link from 'next/link'

export interface HelpBotMessageData {
  id: string
  role: 'bot' | 'user'
  text: string
  links?: { label: string; href: string }[]
  topicButtons?: { id: string; label: string }[]
  showFeedback?: boolean
  feedbackGiven?: 'yes' | 'no' | null
}

interface Props {
  message: HelpBotMessageData
  onTopicSelect?: (id: string) => void
  onFeedback?: (messageId: string, helpful: boolean) => void
}

export default function HelpBotMessage({ message, onTopicSelect, onFeedback }: Props) {
  const isBot = message.role === 'bot'

  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isBot
            ? 'bg-gray-100 text-gray-800 rounded-bl-md'
            : 'bg-purple-600 text-white rounded-br-md'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.text}</p>

        {message.links && message.links.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-purple-600 underline hover:text-purple-800"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}

        {message.topicButtons && message.topicButtons.length > 0 && onTopicSelect && (
          <div className="mt-2.5 flex flex-col gap-1.5">
            {message.topicButtons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => onTopicSelect(btn.id)}
                className="text-left text-xs text-purple-600 hover:text-purple-800 hover:underline py-0.5"
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}

        {message.showFeedback && !message.feedbackGiven && onFeedback && (
          <div className="mt-2.5 pt-2 border-t border-gray-200 flex items-center gap-3">
            <span className="text-xs text-gray-500">Was this helpful?</span>
            <button
              onClick={() => onFeedback(message.id, true)}
              className="text-xs px-2 py-0.5 rounded-full border border-gray-300 hover:border-green-400 hover:bg-green-50 text-gray-600 hover:text-green-700 transition-colors"
            >
              Yes
            </button>
            <button
              onClick={() => onFeedback(message.id, false)}
              className="text-xs px-2 py-0.5 rounded-full border border-gray-300 hover:border-red-400 hover:bg-red-50 text-gray-600 hover:text-red-700 transition-colors"
            >
              No
            </button>
          </div>
        )}

        {message.feedbackGiven === 'yes' && (
          <div className="mt-2 text-xs text-green-600">Thanks for the feedback!</div>
        )}
        {message.feedbackGiven === 'no' && (
          <div className="mt-2 text-xs text-gray-500">
            Sorry that wasn&apos;t helpful. Try rephrasing your question or{' '}
            <Link href="/contact" className="text-purple-600 underline hover:text-purple-800">
              contact our team
            </Link>
            .
          </div>
        )}
      </div>
    </div>
  )
}
