import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi, afterAll } from 'vitest'
import { GradingWaitFeatures } from './GradingWaitFeatures'
import PersistentStatusBar from '../PersistentStatusBar'
// The repository's Node test runner uses classic JSX; Next uses automatic JSX.
vi.hoisted(async () => { vi.stubGlobal('React', await import('react')) })
afterAll(() => vi.unstubAllGlobals())
const mocks = vi.hoisted(() => ({ queue: [] as any[] }))
vi.mock('@/contexts/GradingQueueContext', () => ({ useGradingQueue: () => ({ queue: mocks.queue, removeFromQueue: vi.fn(), clearCompleted: vi.fn() }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('grading waiting experience', () => {
  it('preserves the persistent notification for an active grading entry', () => {
    mocks.queue = [{ id: 'test', cardId: 'test', status: 'processing', stage: 'grading', progress: 42, uploadedAt: Date.now(), cardName: 'Test card' }]
    const html = renderToStaticMarkup(React.createElement(PersistentStatusBar))
    expect(html).toContain('DCM Optic')
    expect(html).toContain('width:42%')
    mocks.queue = []
    expect(renderToStaticMarkup(React.createElement(PersistentStatusBar))).toBe('')
  })
  it('provides four selectable inspection areas without claiming completion', () => {
    const html = renderToStaticMarkup(React.createElement(GradingWaitFeatures, { mode: 'inspection', active: true }, React.createElement('img', { alt: 'Submitted card' })))
    for (const label of ['Centering', 'Corners', 'Edges', 'Surface']) expect(html).toContain(label)
    expect(html).toContain('dcm-inspection-cycle__overlay')
    expect(html).not.toContain('Completed')
  })
  it('stops the inspection overlay when no longer processing', () => {
    const html = renderToStaticMarkup(React.createElement(GradingWaitFeatures, { mode: 'inspection', active: false }))
    expect(html).not.toContain('dcm-inspection-cycle__overlay')
  })
  it('keeps benefit navigation out of an inactive upload state', () => {
    const html = renderToStaticMarkup(React.createElement(GradingWaitFeatures, { mode: 'benefits', active: false }))
    expect(html).toContain('Understand the condition')
    expect(html).toContain('Prepare an eBay listing')
    expect(html).not.toContain('href=')
  })
})
