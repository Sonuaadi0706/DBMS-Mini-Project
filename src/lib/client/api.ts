'use client';

export class ApiClientError extends Error {
  constructor(message: string, public fields: Record<string, string> = {}, public status = 0) {
    super(message);
  }
}

/** fetch wrapper for the browser: JSON in, JSON out, errors as ApiClientError with field messages. */
export async function call<T = any>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiClientError(json?.error?.message ?? 'Something went wrong. Please try again.', json?.error?.fields ?? {}, res.status);
  return json as T;
}

/** multipart/form-data upload (files). Same error handling as `call`. */
export async function callForm<T = any>(url: string, form: FormData): Promise<T> {
  const res = await fetch(url, { method: 'POST', body: form });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiClientError(json?.error?.message ?? 'Something went wrong. Please try again.', json?.error?.fields ?? {}, res.status);
  return json as T;
}
