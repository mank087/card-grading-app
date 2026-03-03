interface TopicOption {
  id: string
  label: string
  emoji?: string
}

interface Props {
  topics: TopicOption[]
  onSelect: (id: string) => void
  variant: 'category' | 'subtopic'
}

export default function HelpBotTopicButtons({ topics, onSelect, variant }: Props) {
  if (variant === 'category') {
    return (
      <div className="grid grid-cols-2 gap-2 my-2">
        {topics.map((topic) => (
          <button
            key={topic.id}
            onClick={() => onSelect(topic.id)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50 text-left text-sm text-gray-700 transition-colors"
          >
            {topic.emoji && <span className="text-base">{topic.emoji}</span>}
            <span className="leading-tight">{topic.label}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 my-2">
      {topics.map((topic) => (
        <button
          key={topic.id}
          onClick={() => onSelect(topic.id)}
          className="text-left px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50 text-sm text-gray-700 transition-colors"
        >
          {topic.label}
        </button>
      ))}
    </div>
  )
}
