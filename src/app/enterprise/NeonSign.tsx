'use client'

/**
 * Animated storefront neon sign — "GRADE YOUR CARDS HERE".
 * Pure CSS: layered text-shadows for the neon tube glow, a slow breathing
 * pulse, a one-word flicker, and a green OPEN sign. Honors
 * prefers-reduced-motion (animations off, glow stays).
 */
export default function NeonSign() {
  return (
    <div className="neon-storefront" aria-label="Neon storefront sign reading Grade Your Cards Here">
      {/* Awning */}
      <div className="neon-awning" />
      {/* Window */}
      <div className="neon-window">
        <div className="neon-line neon-purple neon-pulse">GRADE YOUR</div>
        <div className="neon-line neon-pink neon-pulse neon-flicker">CARDS&nbsp;HERE</div>
        <div className="neon-open neon-pulse">● OPEN ●</div>
      </div>
      <style>{`
        .neon-storefront {
          border-radius: 1.5rem;
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(0,0,0,0.35);
          user-select: none;
        }
        .neon-awning {
          height: 34px;
          background: repeating-linear-gradient(
            90deg,
            #7C3AED 0px, #7C3AED 34px,
            #EDE9FE 34px, #EDE9FE 68px
          );
          border-bottom: 4px solid #4C1D95;
        }
        .neon-window {
          background:
            radial-gradient(ellipse at 50% 30%, rgba(124,58,237,0.16), transparent 65%),
            linear-gradient(180deg, #0B0B10 0%, #14101E 100%);
          padding: 3rem 2rem 2.5rem;
          text-align: center;
          border: 10px solid #1F1B2E;
          border-top: none;
          border-bottom-left-radius: 1.5rem;
          border-bottom-right-radius: 1.5rem;
        }
        .neon-line {
          font-weight: 800;
          font-size: clamp(1.6rem, 4.5vw, 2.6rem);
          letter-spacing: 0.14em;
          line-height: 1.35;
          color: #FFF7FF;
        }
        .neon-purple {
          text-shadow:
            0 0 4px #fff,
            0 0 10px #C4B5FD,
            0 0 21px #A78BFA,
            0 0 42px #7C3AED,
            0 0 82px #7C3AED;
        }
        .neon-pink {
          text-shadow:
            0 0 4px #fff,
            0 0 10px #FBCFE8,
            0 0 21px #F472B6,
            0 0 42px #EC4899,
            0 0 82px #EC4899;
        }
        .neon-open {
          margin-top: 1.4rem;
          font-weight: 700;
          font-size: clamp(0.8rem, 1.8vw, 1rem);
          letter-spacing: 0.5em;
          padding-left: 0.5em; /* re-center the tracked text */
          color: #ECFDF5;
          text-shadow:
            0 0 4px #fff,
            0 0 10px #6EE7B7,
            0 0 20px #10B981,
            0 0 40px #10B981;
        }
        @keyframes neonPulse {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.18); }
        }
        @keyframes neonFlicker {
          0%, 6.5%, 8%, 100% { opacity: 1; }
          7% { opacity: 0.4; }
          7.5% { opacity: 0.9; }
          44%, 45.5% { opacity: 1; }
          45% { opacity: 0.55; }
        }
        .neon-pulse { animation: neonPulse 3.2s ease-in-out infinite; }
        .neon-flicker { animation: neonPulse 3.2s ease-in-out infinite, neonFlicker 6s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .neon-pulse, .neon-flicker { animation: none; }
        }
      `}</style>
    </div>
  )
}
