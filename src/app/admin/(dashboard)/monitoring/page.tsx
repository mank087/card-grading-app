'use client'

import { useState, useEffect } from 'react'
import AdminAuthGuard from '@/components/admin/AdminAuthGuard'

interface ErrorLog {
  id: string
  error_type: string | null
  error_message: string
  stack_trace: string | null
  severity: string
  user_id: string | null
  user_email: string | null
  card_id: string | null
  created_at: string
}

interface ApiLog {
  id: string
  service: string
  operation: string
  user_id: string | null
  user_email: string | null
  card_id: string | null
  input_tokens: number | null
  output_tokens: number | null
  cost_usd: number | null
  status: string
  created_at: string
}

interface PaginationData {
  page: number
  limit: number
  total: number
  total_pages: number
}

export default function AdminMonitoringPage() {
  return (
    <AdminAuthGuard>
      {(admin) => <MonitoringContent />}
    </AdminAuthGuard>
  )
}

function MonitoringContent() {
  const [activeTab, setActiveTab] = useState<'errors' | 'api-usage'>('errors')
  const [errors, setErrors] = useState<ErrorLog[]>([])
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([])
  const [errorPagination, setErrorPagination] = useState<PaginationData>({
    page: 1,
    limit: 50,
    total: 0,
    total_pages: 0
  })
  const [apiPagination, setApiPagination] = useState<PaginationData>({
    page: 1,
    limit: 50,
    total: 0,
    total_pages: 0
  })
  const [errorStats, setErrorStats] = useState<any>(null)
  const [apiStats, setApiStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [serviceFilter, setServiceFilter] = useState('all')

  useEffect(() => {
    if (activeTab === 'errors') {
      fetchErrors()
    } else {
      fetchApiLogs()
    }
  }, [activeTab, errorPagination.page, apiPagination.page, severityFilter, serviceFilter])

  const fetchErrors = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: errorPagination.page.toString(),
        limit: errorPagination.limit.toString(),
        severity: severityFilter
      })

      const response = await fetch(`/api/admin/monitoring/errors?${params}`)
      const data = await response.json()

      if (response.ok) {
        setErrors(data.errors)
        setErrorPagination(data.pagination)
        setErrorStats(data.statistics)
      }
    } catch (error) {
      console.error('Error fetching error logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchApiLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: apiPagination.page.toString(),
        limit: apiPagination.limit.toString(),
        service: serviceFilter
      })

      const response = await fetch(`/api/admin/monitoring/api-usage?${params}`)
      const data = await response.json()

      if (response.ok) {
        setApiLogs(data.logs)
        setApiPagination(data.pagination)
        setApiStats(data.statistics)
      }
    } catch (error) {
      console.error('Error fetching API logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'error':
        return 'bg-red-100 text-red-800'
      case 'warning':
        return 'bg-orange-100 text-orange-800'
      case 'info':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'success':
        return 'bg-green-100 text-green-800'
      case 'error':
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">System Monitoring</h1>
        <p className="text-gray-600">Track API usage, costs, and system errors</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('errors')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'errors'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Error Logs
          </button>
          <button
            onClick={() => setActiveTab('api-usage')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'api-usage'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            API Usage
          </button>
        </div>
      </div>

      {/* Error Logs Tab */}
      {activeTab === 'errors' && (
        <div className="space-y-6">
          {/* Error Stats */}
          {errorStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-600 mb-2">Errors (Last 24h)</div>
                <div className="text-3xl font-bold text-red-600">
                  {errorStats.errors_last_24h}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-600 mb-2">Most Common Error</div>
                <div className="text-lg font-bold text-gray-900">
                  {errorStats.by_type[0]?.type || 'None'}
                </div>
                <div className="text-sm text-gray-500">
                  {errorStats.by_type[0]?.count || 0} occurrences
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
                <select
                  value={severityFilter}
                  onChange={(e) => {
                    setSeverityFilter(e.target.value)
                    setErrorPagination(prev => ({ ...prev, page: 1 }))
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Severities</option>
                  <option value="error">Error</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
              </div>
            </div>
          </div>

          {/* Error Logs Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading error logs...</div>
            ) : errors.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No errors found</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Message
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Severity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {errors.map((error) => (
                        <tr key={error.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {error.error_type || 'Unknown'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 max-w-md truncate">
                              {error.error_message}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(error.severity)}`}>
                              {error.severity}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {error.user_email || 'System'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {new Date(error.created_at).toLocaleString()}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                  <div className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(errorPagination.page - 1) * errorPagination.limit + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(errorPagination.page * errorPagination.limit, errorPagination.total)}
                    </span>{' '}
                    of <span className="font-medium">{errorPagination.total}</span> errors
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setErrorPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={errorPagination.page === 1}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setErrorPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={errorPagination.page >= errorPagination.total_pages}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* API Usage Tab */}
      {activeTab === 'api-usage' && (
        <div className="space-y-6">
          {/* API Stats */}
          {apiStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-600 mb-2">API Calls (Last 24h)</div>
                <div className="text-3xl font-bold text-blue-600">
                  {apiStats.calls_last_24h}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-600 mb-2">Cost (Last 24h)</div>
                <div className="text-3xl font-bold text-green-600">
                  ${apiStats.cost_last_24h.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* Usage by Service */}
          {apiStats && apiStats.by_service.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Usage by Service</h3>
              <div className="space-y-3">
                {apiStats.by_service.map((service: any) => (
                  <div key={service.service} className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{service.service}</div>
                      <div className="text-sm text-gray-500">{service.calls} calls</div>
                    </div>
                    <div className="text-lg font-bold text-green-600">
                      ${service.cost.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Service</label>
                <select
                  value={serviceFilter}
                  onChange={(e) => {
                    setServiceFilter(e.target.value)
                    setApiPagination(prev => ({ ...prev, page: 1 }))
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Services</option>
                  <option value="openai">OpenAI</option>
                  <option value="supabase">Supabase</option>
                </select>
              </div>
            </div>
          </div>

          {/* API Logs Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading API logs...</div>
            ) : apiLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="mb-4">No API usage logs found</p>
                <p className="text-xs text-gray-400">
                  API logging must be integrated into your grading functions to see data here
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Service
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Operation
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tokens
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cost
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {apiLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{log.service}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{log.operation}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {log.input_tokens && log.output_tokens
                                ? `${log.input_tokens + log.output_tokens} (${log.input_tokens}/${log.output_tokens})`
                                : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-green-600">
                              ${log.cost_usd?.toFixed(4) || '0.0000'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(log.status)}`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {new Date(log.created_at).toLocaleString()}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                  <div className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(apiPagination.page - 1) * apiPagination.limit + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(apiPagination.page * apiPagination.limit, apiPagination.total)}
                    </span>{' '}
                    of <span className="font-medium">{apiPagination.total}</span> logs
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setApiPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={apiPagination.page === 1}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setApiPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={apiPagination.page >= apiPagination.total_pages}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
