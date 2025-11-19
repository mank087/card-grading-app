'use client'

export default function AdminMonitoringPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">System Monitoring</h1>
        <p className="text-gray-600 mt-1">Track API usage, costs, errors, and performance</p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-start">
          <svg className="w-6 h-6 text-green-600 mr-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-green-900 mb-2">Feature Coming Soon</h3>
            <p className="text-green-800 mb-4">
              The system monitoring dashboard is currently under development. This section will include:
            </p>
            <ul className="list-disc list-inside text-green-700 space-y-1 text-sm">
              <li>OpenAI API usage and cost tracking</li>
              <li>Daily/weekly/monthly usage charts</li>
              <li>Error logs and exception tracking</li>
              <li>Performance metrics (avg grading time, upload success rate)</li>
              <li>Storage usage analytics</li>
              <li>Real-time system health status</li>
            </ul>
            <p className="text-sm text-green-600 mt-4">
              Expected: Phase 1 implementation (Week 3)
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Integration Required</h2>
        <p className="text-sm text-gray-600 mb-3">
          To enable full monitoring, you need to integrate API usage logging into your grading functions:
        </p>
        <div className="bg-gray-50 p-4 rounded font-mono text-xs">
          <code className="text-gray-800">
            import &#123; log_api_usage &#125; from '@/lib/admin/adminAuth'<br/><br/>
            // After OpenAI API call:<br/>
            await log_api_usage(&#123;<br/>
            &nbsp;&nbsp;service: 'openai',<br/>
            &nbsp;&nbsp;operation: 'grade_card',<br/>
            &nbsp;&nbsp;user_id: userId,<br/>
            &nbsp;&nbsp;card_id: cardId,<br/>
            &nbsp;&nbsp;input_tokens: usage.prompt_tokens,<br/>
            &nbsp;&nbsp;output_tokens: usage.completion_tokens,<br/>
            &nbsp;&nbsp;cost_usd: calculateCost(usage),<br/>
            &nbsp;&nbsp;status: 'success'<br/>
            &#125;)
          </code>
        </div>
      </div>
    </div>
  )
}
