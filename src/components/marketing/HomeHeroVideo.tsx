'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import styles from './HomeHeroVideo.module.css'

const MEDIA = '/videos/homepage'

export function HomeHeroVideo({ open, onClose }: { open: boolean; onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const loop = useRef<HTMLVideoElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const film = useRef<HTMLVideoElement>(null)
  const [filmMuted, setFilmMuted] = useState(false)
  const [allowMotion, setAllowMotion] = useState(false)
  const [inView, setInView] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  const [userPaused, setUserPaused] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const [compactFilm, setCompactFilm] = useState(true)

  useEffect(() => {
    const desktop = matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)')
    const smallScreen = matchMedia('(max-width: 767px)')
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    const update = () => {
      setAllowMotion(desktop.matches && !reduced.matches && !connection?.saveData)
      setCompactFilm(smallScreen.matches || !desktop.matches || Boolean(connection?.saveData))
    }
    const visibility = () => setPageVisible(!document.hidden)
    update(); visibility()
    desktop.addEventListener('change', update); reduced.addEventListener('change', update)
    smallScreen.addEventListener('change', update)
    document.addEventListener('visibilitychange', visibility)
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.15 })
    if (host.current) observer.observe(host.current)
    return () => {
      observer.disconnect(); desktop.removeEventListener('change', update); reduced.removeEventListener('change', update)
      smallScreen.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])

  useEffect(() => {
    const video = loop.current
    if (!video) return
    if (allowMotion && inView && pageVisible && !userPaused && !open && !failed) {
      void video.play().catch(() => setPlaying(false))
    } else video.pause()
  }, [allowMotion, inView, pageVisible, userPaused, open, failed])

  useEffect(() => {
    if (!pageVisible) film.current?.pause()
  }, [pageVisible])

  useEffect(() => {
    const node = dialog.current
    if (!open || !node) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    node.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      node.close()
      document.body.style.overflow = overflow
      previous?.focus({ preventScroll: true })
    }
  }, [open])

  const toggle = () => {
    if (playing) { setUserPaused(true); loop.current?.pause() }
    else { setUserPaused(false); void loop.current?.play().catch(() => setPlaying(false)) }
  }

  return <>
    <div ref={host} className={styles.panel}>
      <Image src={`${MEDIA}/poster.webp`} alt="Pokémon, baseball, One Piece, Lorcana and Magic cards with DCM Heritage labels" fill priority unoptimized sizes="(min-width: 1000px) 65vw, 100vw" className={styles.poster} />
      {allowMotion && !failed && <video ref={loop} className={styles.loop} src={`${MEDIA}/loop-720p.mp4`} poster={`${MEDIA}/poster.webp`} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setFailed(true); setPlaying(false) }} />}
      {allowMotion && !failed && <button type="button" className={styles.pause} onClick={toggle} aria-label={playing ? 'Pause homepage animation' : 'Play homepage animation'} title={playing ? 'Pause animation' : 'Play animation'}><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">{playing ? <><rect x="4" y="3" width="2.5" height="10" rx="0.7" /><rect x="9.5" y="3" width="2.5" height="10" rx="0.7" /></> : <path d="M5 3 13 8 5 13Z" />}</svg></button>}
    </div>
    {open && <dialog ref={dialog} className={styles.dialog} aria-labelledby="dcm-film-title" aria-describedby="dcm-film-description" onCancel={onClose} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className={styles.dialogHeader}><h2 id="dcm-film-title">DCM in action</h2><div className={styles.filmActions}><button type="button" onClick={() => { if (film.current) film.current.muted = !film.current.muted }} aria-label={filmMuted ? 'Unmute video' : 'Mute video'}>{filmMuted ? 'Sound off' : 'Sound on'}</button><button type="button" onClick={onClose} autoFocus aria-label="Close video">Close <span aria-hidden="true">×</span></button></div></div>
      <video ref={film} className={styles.film} controls autoPlay muted={filmMuted} onVolumeChange={event => setFilmMuted(event.currentTarget.muted)} playsInline preload="metadata" poster={`${MEDIA}/poster.webp`} aria-label="DCM service benefits, 44 seconds, with music">
        <source src={`${MEDIA}/benefits-rock-${compactFilm ? '720p' : '1080p'}.mp4`} type="video/mp4" />
        <a href={`${MEDIA}/benefits-rock-1080p.mp4`}>Download the DCM film</a>
      </video>
      <p id="dcm-film-description" className={styles.description}>Collect. Grade. Value. Slab. Sell. A 44-second film with music. All key information is also shown on screen.</p>
      <details className={styles.transcript}><summary>Read the video summary</summary><p>Upload front and back photos to grade from home. Explore centering, corners, edges, surface and image confidence. Create a Heritage label for your holder, with a QR code linking to the public grading report. Explore sold-market pricing, organize cards in binders and prepare an eBay listing with InstaList. The film ends with 30 real cards, each with a Heritage label.</p></details>
    </dialog>}
  </>
}
