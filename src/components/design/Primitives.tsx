import Link from 'next/link'
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'text'
export function ActionLink({ variant = 'primary', className = '', ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`dcm-button dcm-button--${variant} ${className}`} {...props} />
}

export function ActionButton({ variant = 'primary', className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={`dcm-button dcm-button--${variant} ${className}`} {...props} />
}

export function SectionHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return <div className="dcm-section-heading">
    {eyebrow && <p className="dcm-eyebrow">{eyebrow}</p>}
    <h2>{title}</h2>
    {children && <div className="dcm-lead">{children}</div>}
  </div>
}

export type IconName = 'arrow' | 'camera' | 'scan' | 'report' | 'collection' | 'chart' | 'label' | 'sell' | 'check' | 'shield'
const paths: Record<IconName, ReactNode> = {
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  camera: <><path d="M8 5 6 8H3v12h18V8h-3l-2-3Z" /><circle cx="12" cy="13" r="3" /></>,
  scan: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M2 12h20" /><path d="M8 7h8v10H8z" /></>,
  report: <><path d="M14 3H5v18h14V8Zm0 0v5h5M8 12h8m-8 4h6" /></>,
  collection: <><rect x="7" y="3" width="13" height="17" rx="2" /><path d="M4 6H3v16h13" /></>,
  chart: <><path d="M4 3v17h17M8 15l4-5 4 2 5-7" /></>,
  label: <><path d="M3 3h8l10 10-8 8L3 11Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
  sell: <><path d="M4 7h16l-1 14H5ZM8 7V5a4 4 0 0 1 8 0v2m-7 7h6m-3-3v6" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  shield: <><path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z" /><path d="m8 12 3 3 5-6" /></>,
}
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`dcm-icon ${className}`} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'error' | 'success' }) {
  return <div className={`dcm-notice dcm-notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}
