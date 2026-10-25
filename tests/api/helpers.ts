import '../../scripts/lib/env';

export const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3100';

export async function serverUp(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/login`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}

export interface Client {
  get(path: string): Promise<Res>;
  post(path: string, body?: unknown): Promise<Res>;
  patch(path: string, body?: unknown): Promise<Res>;
  del(path: string): Promise<Res>;
  /** multipart/form-data (file upload). `file.content` may be text or bytes. */
  form(path: string, fields: Record<string, string>, file?: { name: string; content: string | Uint8Array; type?: string }, headers?: Record<string, string>): Promise<Res>;
  /** raw GET returning bytes + headers (file downloads) */
  raw(path: string): Promise<{ status: number; headers: Headers; bytes: Buffer }>;
}
export interface Res { status: number; body: any }

/** A tiny cookie-carrying client. Passwords come from SEED_DEFAULT_PASSWORD, never from source. */
export async function login(email: string | null): Promise<Client> {
  let cookie = '';
  if (email) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: process.env.SEED_DEFAULT_PASSWORD }),
    });
    if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`);
    cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  }
  const call = async (method: string, path: string, body?: unknown): Promise<Res> => {
    const res = await fetch(`${BASE}${path}`, {
      method, redirect: 'manual',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const refreshed = res.headers.getSetCookie().find((c) => c.startsWith('pp_session='));      // e.g. after a role switch
    if (refreshed) cookie = refreshed.split(';')[0];
    const text = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: res.status, body: parsed };
  };
  return {
    get: (p) => call('GET', p), post: (p, b) => call('POST', p, b ?? {}),
    patch: (p, b) => call('PATCH', p, b ?? {}), del: (p) => call('DELETE', p),
    async form(path, fields, file, headers = {}) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      if (file) fd.append('file', new Blob([file.content as BlobPart], { type: file.type ?? 'application/octet-stream' }), file.name);
      const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: fd });
      const text = await res.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      return { status: res.status, body: parsed };
    },
    async raw(path) {
      const res = await fetch(`${BASE}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
      return { status: res.status, headers: res.headers, bytes: Buffer.from(await res.arrayBuffer()) };
    },
  };
}

export const em = {
  admin: 'admin@projectpulse.test',
  guide: (n: number) => `guide${n}@projectpulse.test`,
  student: (n: number) => `student${String(n).padStart(2, '0')}@projectpulse.test`,
};

export async function projectIdByTitle(admin: Client, prefix: string): Promise<number> {
  const r = await admin.get('/api/proposals');
  const p = r.body.proposals.find((x: { title: string }) => x.title.startsWith(prefix));
  if (!p) throw new Error(`project ${prefix} not found`);
  return p.project_id;
}
