/**
 * Isolate the green-background bug: which combination of 3-stop gradient,
 * rgba glow overlay rect, and id naming breaks the modern slab background?
 *   npx tsx scripts/test-gradient-isolation.tsx
 */
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from '@react-pdf/renderer'
import fs from 'fs'

const W = 201.6
const H = 57.6

function Case({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 7, marginBottom: 2 }}>{label}</Text>
      <View style={{ width: W, height: H, position: 'relative' }}>{children}</View>
    </View>
  )
}

function Grad({
  id,
  stops,
  glow,
}: {
  id: string
  stops: { offset: string; color: string }[]
  glow?: string
}) {
  return (
    <Svg style={{ position: 'absolute', top: 0, left: 0, width: W, height: H }} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          {stops.map(s => (
            <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={W} height={H} fill={`url(#${id})`} />
      {glow ? <Rect x={0} y={0} width={W} height={H} fill={glow} /> : null}
    </Svg>
  )
}

async function main() {
  const doc = (
    <Document>
      <Page size="LETTER" style={{ padding: 36 }}>
        <Case label="1: 2 stops, no glow">
          <Grad id="g1" stops={[{ offset: '0%', color: '#1a1625' }, { offset: '100%', color: '#2d1f47' }]} />
        </Case>
        <Case label="2: 3 stops, no glow">
          <Grad
            id="g2"
            stops={[
              { offset: '0%', color: '#1a1625' },
              { offset: '50%', color: '#2d1f47' },
              { offset: '100%', color: '#1a1625' },
            ]}
          />
        </Case>
        <Case label="3: 2 stops + rgba glow rect">
          <Grad
            id="g3"
            stops={[{ offset: '0%', color: '#1a1625' }, { offset: '100%', color: '#2d1f47' }]}
            glow="rgba(139, 92, 246, 0.1)"
          />
        </Case>
        <Case label="4: 3 stops + rgba glow rect (= production LabelBackground)">
          <Grad
            id="g4"
            stops={[
              { offset: '0%', color: '#1a1625' },
              { offset: '50%', color: '#2d1f47' },
              { offset: '100%', color: '#1a1625' },
            ]}
            glow="rgba(139, 92, 246, 0.1)"
          />
        </Case>
        <Case label="5: 3 stops + glow, numeric offsets 0/0.5/1">
          <Grad
            id="g5"
            stops={[
              { offset: '0', color: '#1a1625' },
              { offset: '0.5', color: '#2d1f47' },
              { offset: '1', color: '#1a1625' },
            ]}
            glow="rgba(139,92,246,0.1)"
          />
        </Case>
        <Case label="6: FIX — 3 stops + glow rect via hex fill + fillOpacity">
          <Svg style={{ position: 'absolute', top: 0, left: 0, width: W, height: H }} viewBox={`0 0 ${W} ${H}`}>
            <Defs>
              <LinearGradient id="g6" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#1a1625" />
                <Stop offset="50%" stopColor="#2d1f47" />
                <Stop offset="100%" stopColor="#1a1625" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={W} height={H} fill="url(#g6)" />
            <Rect x={0} y={0} width={W} height={H} fill="#8b5cf6" fillOpacity={0.1} />
          </Svg>
        </Case>
      </Page>
    </Document>
  )
  const buf = await renderToBuffer(doc as any)
  fs.writeFileSync('output/test-gradient-isolation.pdf', buf)
  console.log(`OK — ${buf.length} bytes -> output/test-gradient-isolation.pdf`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
