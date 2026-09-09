'use client'

import { useEffect, useRef, useState } from 'react'
const sections = [ ['tour-card-images','Card photos'], ['tour-grade-score','Grade'], ['tour-subgrades','Subgrades'], ['tour-condition-summary','Condition'], ['tour-download-buttons','Reports & labels'], ['tour-card-info','Card details'], ['tour-live-market-pricing','Market pricing'] ] as const
export default function ReportSectionNav() {
  const ref = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState<string[]>([])
  useEffect(() => {
    const root = ref.current?.parentElement
    if (!root) return
    const update = () => { const next = sections.filter(([id]) => root.querySelector(`#${id}`)).map(([id]) => id); setAvailable(previous => previous.join() === next.join() ? previous : next) }
    update()
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new MutationObserver(mutations => {
      if (!mutations.some(m => [...m.addedNodes, ...m.removedNodes].some(n => n.nodeType === 1))) return
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(update, 120)
    })
    observer.observe(root, { childList: true, subtree: true })
    return () => { observer.disconnect(); if (timer !== undefined) clearTimeout(timer) }
  }, [])
  return <div role="navigation" ref={ref} className="dcm-report-nav" aria-label="Card report sections"><span>Card grade & condition report</span><div>{sections.filter(([id]) => available.includes(id)).map(([id,label]) => <a href={`#${id}`} key={id}>{label}</a>)}</div></div>
}
