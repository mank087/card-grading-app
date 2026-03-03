import type { KnowledgeEntry } from '@/components/helpbot/helpBotKnowledge'

export interface SearchResult {
  entry: KnowledgeEntry
  score: number
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'it', 'in', 'on', 'at', 'to', 'of', 'for',
  'and', 'or', 'but', 'not', 'with', 'from', 'by', 'as', 'be', 'was',
  'are', 'do', 'does', 'did', 'can', 'could', 'will', 'would', 'should',
  'has', 'have', 'had', 'this', 'that', 'these', 'those', 'i', 'me', 'my',
  'we', 'you', 'your', 'they', 'them', 'their', 'what', 'which', 'who',
  'how', 'when', 'where', 'why', 'if', 'so', 'just', 'about', 'also',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

export function searchKnowledge(
  query: string,
  entries: KnowledgeEntry[],
  maxResults = 5
): SearchResult[] {
  const queryLower = query.toLowerCase().trim()
  if (!queryLower) return []

  const queryTokens = tokenize(query)

  const results: SearchResult[] = entries.map((entry) => {
    let score = 0
    const questionLower = entry.question.toLowerCase()
    const answerLower = entry.answer.toLowerCase()

    // Exact phrase match in question (highest weight)
    if (questionLower.includes(queryLower)) {
      score += 10
    }

    // Exact phrase match in answer
    if (answerLower.includes(queryLower)) {
      score += 4
    }

    // Keyword matches (3pts each)
    for (const keyword of entry.keywords) {
      if (queryLower.includes(keyword) || keyword.includes(queryLower)) {
        score += 3
      }
    }

    // Token overlap (1pt each)
    const questionTokens = tokenize(entry.question)
    const answerTokens = tokenize(entry.answer)
    const keywordTokens = entry.keywords.flatMap((k) => k.split(/\s+/))
    const allEntryTokens = new Set([...questionTokens, ...answerTokens, ...keywordTokens])

    for (const token of queryTokens) {
      for (const entryToken of allEntryTokens) {
        if (entryToken.includes(token) || token.includes(entryToken)) {
          score += 1
          break
        }
      }
    }

    return { entry, score }
  })

  return results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
}
