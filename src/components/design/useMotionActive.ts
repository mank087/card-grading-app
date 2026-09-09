'use client'
import { useEffect, useState } from 'react'
/** Suspend decorative motion in hidden tabs and for reduced-motion preferences. */
export function useMotionActive() {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setActive(!document.hidden && !query.matches)
    sync()
    query.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    return () => { query.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync) }
  }, [])
  return active
}
