const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function fetchJson(url, options = {}) {
  const response = await fetch(`${BASE_URL}${url}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }
  
  return response.json()
}

export const authApi = {
  signup: (email, password) => fetchJson('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }),
  
  login: (email, password) => fetchJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }),
  
  logout: () => fetchJson('/auth/logout', { method: 'POST' }),
  
  me: () => fetchJson('/auth/me')
}

