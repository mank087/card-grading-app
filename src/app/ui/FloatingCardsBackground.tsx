'use client';

/**
 * FloatingCardsBackground
 *
 * A subtle animated background component featuring floating trading card shapes.
 * Cards slowly rotate at different speeds for visual interest without distracting
 * from page content.
 *
 * Uses z-index: 0 to stay visible but behind content with higher z-index.
 * Content that should appear above (footer, forms) should use z-10 or higher.
 */
export default function FloatingCardsBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      {/* Card 1 - Large, top right */}
      <div
        className="absolute w-32 h-44 rounded-lg bg-purple-600/[0.06] blur-[1px]"
        style={{
          top: '10%',
          right: '10%',
          animation: 'floatRotate1 25s ease-in-out infinite',
        }}
      />

      {/* Card 2 - Medium, left side */}
      <div
        className="absolute w-24 h-33 rounded-lg bg-purple-600/[0.05]"
        style={{
          top: '30%',
          left: '5%',
          animation: 'floatRotate2 30s ease-in-out infinite',
        }}
      />

      {/* Card 3 - Small, bottom right */}
      <div
        className="absolute w-16 h-22 rounded-md bg-purple-600/[0.07] blur-[0.5px]"
        style={{
          bottom: '20%',
          right: '15%',
          animation: 'floatRotate3 20s ease-in-out infinite',
        }}
      />

      {/* Card 4 - Large, bottom left */}
      <div
        className="absolute w-28 h-39 rounded-lg bg-purple-600/[0.04] blur-[1px]"
        style={{
          bottom: '15%',
          left: '12%',
          animation: 'floatRotate1 35s ease-in-out infinite reverse',
        }}
      />

      {/* Card 5 - Medium, top left */}
      <div
        className="absolute w-20 h-28 rounded-lg bg-purple-600/[0.05]"
        style={{
          top: '15%',
          left: '20%',
          animation: 'floatRotate2 28s ease-in-out infinite',
        }}
      />

      {/* Card 6 - Small, center right */}
      <div
        className="absolute w-14 h-19 rounded-md bg-purple-600/[0.06]"
        style={{
          top: '50%',
          right: '8%',
          animation: 'floatRotate3 22s ease-in-out infinite reverse',
        }}
      />

      <style jsx>{`
        @keyframes floatRotate1 {
          0%, 100% {
            transform: rotate(-8deg) translateY(0px);
          }
          25% {
            transform: rotate(4deg) translateY(-15px);
          }
          50% {
            transform: rotate(12deg) translateY(5px);
          }
          75% {
            transform: rotate(-4deg) translateY(-10px);
          }
        }

        @keyframes floatRotate2 {
          0%, 100% {
            transform: rotate(10deg) translateY(0px);
          }
          33% {
            transform: rotate(-6deg) translateY(-20px);
          }
          66% {
            transform: rotate(5deg) translateY(10px);
          }
        }

        @keyframes floatRotate3 {
          0%, 100% {
            transform: rotate(-5deg) translateX(0px);
          }
          50% {
            transform: rotate(8deg) translateX(15px);
          }
        }
      `}</style>
    </div>
  );
}
