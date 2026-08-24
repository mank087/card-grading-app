'use client'

/**
 * Dev-only harness for the enterprise Label Designer — exercises the editor
 * with sample logos and no org account. Not linked from anywhere; returns
 * 404 in production like the other /dev pages.
 */
import { useState } from 'react'
import { notFound } from 'next/navigation'
import LabelDesigner from '@/components/enterprise/LabelDesigner'
import { defaultOrgLabelDesign, type OrgLabelDesign } from '@/lib/labels/orgLabelDesign'

export default function LabelDesignerDevPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  const [design, setDesign] = useState<OrgLabelDesign>(defaultOrgLabelDesign())
  const [saved, setSaved] = useState<string>('')
  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Label Designer — dev harness</h1>
        <div className="bg-white rounded-2xl shadow-md p-6">
          <LabelDesigner
            design={design}
            onChange={setDesign}
            onCommit={d => setSaved(new Date().toLocaleTimeString() + ' ' + JSON.stringify(d))}
            orgName="Kings Kards"
            serialPrefix="KK"
            brandColors={['#4851d2', '#770804', '#7d6943', '#773b1c', '#948f75']}
            logos={{ color: '/DCM-logo.png', white: '/DCM Logo white.png', black: '/DCM-logo-black.png' }}
          />
        </div>
        <pre className="text-[11px] bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto" data-testid="design-json">{JSON.stringify(design, null, 2)}</pre>
        <p className="text-[11px] text-gray-400" data-testid="last-commit">{saved}</p>
      </div>
    </main>
  )
}
