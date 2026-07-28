'use client';

// Shared slab-preview card used by the marketing pages (/why-dcm and the
// category landing pages). Extracted from why-dcm so the category pages do
// not become another copy of it.

export interface FeaturedCard {
  id: string
  serial?: string | null
  card_name?: string | null
  category?: string | null
  front_url?: string | null
  conversational_whole_grade?: number | null
  dcm_grade_whole?: number | null
  conversational_condition_label?: string | null
  conversational_weighted_sub_scores?: any
  conversational_sub_scores?: any
}

export default function FeaturedCardSlab({ card }: { card: FeaturedCard }) {
  const grade = card.conversational_whole_grade ?? card.dcm_grade_whole ?? null
  const condition = card.conversational_condition_label || 'Graded'
  const name = card.card_name || 'Card'
  const serial = card.serial || ''
  const displayName = name.length > 20 ? name.slice(0, 18) + '…' : name

  // Get sub-scores
  const ws = card.conversational_weighted_sub_scores || {}
  const ss = card.conversational_sub_scores || {}
  const centering = ws.centering ?? ss.centering?.weighted ?? null
  const corners = ws.corners ?? ss.corners?.weighted ?? null
  const edges = ws.edges ?? ss.edges?.weighted ?? null
  const surface = ws.surface ?? ss.surface?.weighted ?? null

  return (
    <div className="relative w-full max-w-[200px] mx-auto" style={{ aspectRatio: '280 / 460' }}>
      {/* Slab case photo background */}
      <img src="/labels/graded-card-slab.png" alt="" className="absolute inset-0 w-full h-full object-contain" loading="lazy" />

      {/* Modern dark label in the label slot */}
      <div className="absolute overflow-hidden" style={{ top: '4.5%', left: '13.5%', width: '73%' }}>
        <div
          className="w-full flex items-stretch"
          style={{
            aspectRatio: '3.5 / 1',
            background: 'linear-gradient(135deg, #1a1625 0%, #2d1f47 50%, #1a1625 100%)',
            borderBottom: '1px solid rgba(139,92,246,0.3)',
          }}
        >
          {/* Left: DCM logo column */}
          <div className="flex flex-col items-center justify-center px-[4%]" style={{ width: '15%' }}>
            <img src="/DCM Logo white.png" alt="" className="w-[14px] h-auto opacity-90" />
          </div>

          {/* Center: Card info */}
          <div className="flex-1 flex flex-col justify-center min-w-0 py-[2%]">
            <div className="text-white font-bold leading-tight truncate" style={{ fontSize: '6.5px' }}>
              {displayName}
            </div>
            {serial && (
              <div className="font-mono truncate" style={{ fontSize: '4px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' }}>
                {serial}
              </div>
            )}
            {/* Sub-scores row */}
            {centering !== null && (
              <div className="flex gap-[2px] mt-[2px]">
                {[
                  { label: 'C', val: centering },
                  { label: 'Co', val: corners },
                  { label: 'E', val: edges },
                  { label: 'S', val: surface },
                ].map((s) => (
                  <div key={s.label} className="text-center" style={{ fontSize: '4px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
                    <div style={{ color: s.val != null && s.val >= 10 ? 'rgba(34,197,94,0.9)' : 'rgba(255,255,255,0.7)' }} className="font-bold">{s.val ?? '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Grade with glow */}
          {grade !== null && (
            <div className="flex flex-col items-center justify-center px-[4%]" style={{ width: '22%' }}>
              <div
                className="font-bold text-white leading-none"
                style={{
                  fontSize: '14px',
                  textShadow: grade >= 9
                    ? '0 0 8px rgba(34,197,94,0.6), 0 0 16px rgba(34,197,94,0.3)'
                    : '0 0 8px rgba(139,92,246,0.5), 0 0 16px rgba(139,92,246,0.25)',
                }}
              >
                {grade}
              </div>
              <div className="uppercase font-semibold text-center leading-tight" style={{ fontSize: '3.5px', color: 'rgba(255,255,255,0.6)', marginTop: '1px', letterSpacing: '0.05em' }}>
                {condition}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card image */}
      <div className="absolute overflow-hidden" style={{ top: '20%', left: '10.7%', width: '78.6%', height: '73.9%' }}>
        {card.front_url ? (
          <img src={card.front_url} alt={name} className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gray-800" />
        )}
      </div>

      {/* Gloss overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.03) 100%)' }} />
    </div>
  )
}
