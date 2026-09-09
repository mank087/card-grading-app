import { cachedShowcase } from '@/lib/cards/publicShowcase'
import { ShowcaseProvider } from '@/components/design/ShowcaseProvider'
import type { ShowcaseCard } from '@/components/design/featuredCard'
export async function MarketingShowcaseBoundary({ selection, children }: { selection: string; children: React.ReactNode }) {
  let cards: ShowcaseCard[] = []
  try { cards = (await cachedShowcase(selection === '1' ? 5 : 3, null, selection)).cards as ShowcaseCard[] } catch { /* Client fallback preserves page availability during a data outage. */ }
  return <ShowcaseProvider selection={selection} cards={cards}>{children}</ShowcaseProvider>
}
