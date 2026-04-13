const BASE = '/api'

export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code)
  }
}

function mergeHeaders(
  base: Record<string, string>,
  extra?: HeadersInit
): Record<string, string> {
  if (!extra) return base
  const out = { ...base }
  if (extra instanceof Headers) {
    extra.forEach((v, k) => {
      out[k] = v
    })
    return out
  }
  if (Array.isArray(extra)) {
    for (const [k, v] of extra) out[k] = v
    return out
  }
  return { ...out, ...extra }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET'
  const hasJsonBody =
    typeof init?.body === 'string' &&
    init.body.length > 0 &&
    ['POST', 'PUT', 'PATCH'].includes(method)

  const headers = mergeHeaders(
    hasJsonBody ? { 'content-type': 'application/json' } : {},
    init?.headers
  )

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    method,
    credentials: 'include',
    headers,
  })
  if (!res.ok) {
    let body: { error?: string } = {}
    try {
      body = await res.json()
    } catch {}
    throw new ApiError(res.status, body.error ?? 'request_failed')
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: 'DELETE' }),
}
