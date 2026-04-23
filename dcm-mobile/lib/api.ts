const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'

async function request(path: string, options: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`API error ${response.status}: ${errorBody}`)
  }

  return response.json()
}

export const api = {
  get: (path: string, token?: string) => request(path, { method: 'GET' }, token),

  post: (path: string, body: any, token?: string) =>
    request(path, { method: 'POST', body: JSON.stringify(body) }, token),

  put: (path: string, body: any, token?: string) =>
    request(path, { method: 'PUT', body: JSON.stringify(body) }, token),

  delete: (path: string, token?: string) =>
    request(path, { method: 'DELETE' }, token),
}
