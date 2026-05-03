// src/tea/admin/lib/api.ts
// Typed wrappers around /tea/api/*. All requests include credentials so the
// session cookie is sent automatically.

const BASE = "/tea/api";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: "same-origin",
    headers:
      body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    init.body = body instanceof FormData ? body : JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, init);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: string }).error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
