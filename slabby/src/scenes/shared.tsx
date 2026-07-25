import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';

/** Brand backdrop: deep DCM purple with a soft glow behind the character. */
export const Backdrop: React.FC<{ transparent?: boolean; children: React.ReactNode }> = ({
  transparent,
  children,
}) => {
  if (transparent) {
    return <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>{children}</AbsoluteFill>;
  }
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(160deg, #1a1625 0%, #2d1f47 60%, #1a1625 100%)',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <AbsoluteFill
        style={{
          background: 'radial-gradient(circle at 50% 45%, rgba(124,58,237,0.35) 0%, rgba(124,58,237,0) 55%)',
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

/** Character size that fits any aspect ratio: ~92% of the short edge. */
export const useSlabbyScale = (): number => {
  const { width, height } = useVideoConfig();
  return (Math.min(width, height) * 0.92) / 1000;
};

/** Big rounded caption in brand style, bottom-anchored. */
export const Caption: React.FC<{ text: string; opacity?: number; y?: number }> = ({ text, opacity = 1, y = 0 }) => {
  const { width, height } = useVideoConfig();
  const fontSize = Math.min(width, height) * 0.062;
  return (
    <div
      style={{
        position: 'absolute',
        bottom: height * 0.06 - y,
        width: '100%',
        textAlign: 'center',
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontWeight: 900,
        fontSize,
        color: '#ffffff',
        textShadow: '0 4px 24px rgba(0,0,0,0.6)',
        letterSpacing: 1,
        opacity,
      }}
    >
      {text}
    </div>
  );
};
