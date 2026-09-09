'use client'
import { createContext, useContext, type ReactNode } from 'react'
import type { ShowcaseCard } from './featuredCard'
const ShowcaseContext = createContext<Record<string, ShowcaseCard[]>>({})
export function ShowcaseProvider({ selection, cards, children }: { selection: string; cards: ShowcaseCard[]; children: ReactNode }) {
  return <ShowcaseContext.Provider value={{[selection]: cards}}>{children}</ShowcaseContext.Provider>
}
export function useServerShowcase(selection: string) { return useContext(ShowcaseContext)[selection] }
