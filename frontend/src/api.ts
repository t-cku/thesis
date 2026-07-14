import type {
  AuthResponse,
  OnePager,
  SavedThesisDetail,
  SavedThesisSummary,
  User,
} from './types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

function apiPath(path: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path
}

type RequestOptions = {
  method?: string
  body?: unknown
  token?: string | null
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const response = await fetch(apiPath(path), {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { detail?: string }
    throw new Error(payload.detail ?? 'Request failed')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function register(
  email: string,
  password: string,
  name?: string,
): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, name: name || undefined },
  })
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}

export function fetchCurrentUser(token: string): Promise<User> {
  return request<User>('/auth/me', { token })
}

export function verifyEmail(token: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/verify-email', {
    method: 'POST',
    body: { token },
  })
}

export function resendVerification(token: string): Promise<{ message: string }> {
  return request<{ message: string }>('/auth/resend-verification', {
    method: 'POST',
    token,
  })
}

export function deleteAccount(token: string, password: string): Promise<{ message: string }> {
  return request<{ message: string }>('/auth/me', {
    method: 'DELETE',
    token,
    body: { password },
  })
}

export function analyzeTicker(ticker: string): Promise<OnePager> {
  return request<OnePager>('/analyze', {
    method: 'POST',
    body: { ticker },
  })
}

export function saveThesis(token: string, onePager: OnePager): Promise<SavedThesisSummary> {
  return request<SavedThesisSummary>('/theses', {
    method: 'POST',
    token,
    body: { one_pager: onePager },
  })
}

export function listTheses(token: string): Promise<SavedThesisSummary[]> {
  return request<SavedThesisSummary[]>('/theses', { token })
}

export function getThesis(token: string, thesisId: number): Promise<SavedThesisDetail> {
  return request<SavedThesisDetail>(`/theses/${thesisId}`, { token })
}

export function deleteThesis(token: string, thesisId: number): Promise<void> {
  return request<void>(`/theses/${thesisId}`, {
    method: 'DELETE',
    token,
  })
}
