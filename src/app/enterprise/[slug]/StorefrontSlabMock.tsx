'use client';

import { HeritageLabelPreview } from '@/components/labels/HeritageLabelPreview';
import { ModernFrontLabel } from '@/components/labels/ModernFrontLabel';

/**
 * Live slab mockup for the storefront: the org's label design (house style ×
 * pattern + colors + logo) inside the standard slab case art — same overlay
 * geometry as Label Studio (label 4.5%/13.5%/73%, window 20%/10.7%/78.6%/73.9%).
 * The window shows a real sample card (Aaron Judge, serial 355168) and the
 * label carries the org's serial prefix so the example reads as theirs.
 */
export default function StorefrontSlabMock({
  orgName,
  logoHref,
  pattern,
  bandColors,
  labelStyle = 'heritage',
  serialPrefix = 'ORG',
}: {
  orgName: string;
  logoHref: string | null;
  pattern: string;
  bandColors: string[];
  labelStyle?: 'modern' | 'heritage';
  serialPrefix?: string;
}) {
  const sampleSerial = `${serialPrefix}442921`;
  const data: any = {
    primaryName: 'Aaron Judge',
    contextLine: 'Bowman Chrome • #99 • 2023',
    features: [],
    featuresLine: null,
    serial: sampleSerial,
    grade: 9,
    gradeFormatted: '9',
    condition: 'Mint',
    subScores: null,
    qrCodeDataUrl: null,
  };

  return (
    <div className="relative w-full max-w-xs mx-auto select-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/labels/graded-card-slab.png" alt="" className="w-full h-auto" />
      <div className="absolute overflow-hidden" style={{ top: '4.5%', left: '13.5%', width: '73%' }}>
        {labelStyle === 'heritage' || !logoHref ? (
          /* Modern's logo slot falls back to the DCM mark when no org logo
             exists, so a logo-less org gets the heritage render (which can
             suppress images entirely) regardless of house style. */
          <HeritageLabelPreview
            data={data}
            side="front"
            pattern={pattern as any}
            bandColors={bandColors}
            blackLogoHref={logoHref ?? undefined}
            colorLogoHref={logoHref ?? undefined}
            suppressImages={!logoHref}
          />
        ) : (
          <ModernFrontLabel
            displayName="Aaron Judge"
            setLineText="#99 Bowman Chrome"
            serial={sampleSerial}
            grade={9}
            condition="MINT"
            size="sm"
            colorOverrides={{
              gradientStart: bandColors[0],
              gradientEnd: bandColors[1] ?? bandColors[0],
            } as any}
            logoWhiteSrc={logoHref}
            logoColorSrc={logoHref}
          />
        )}
      </div>
      <div
        className="absolute flex items-center justify-center"
        style={{ top: '20%', left: '10.7%', width: '78.6%', height: '73.9%' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/enterprise/judge-front.jpg"
          alt="Sample graded card"
          className="w-[86%] h-[92%] object-cover rounded-lg border border-gray-300/60"
        />
      </div>
    </div>
  );
}
