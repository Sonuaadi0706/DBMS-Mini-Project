import { describe, expect, it } from 'vitest';
import { BASE, em, login, serverUp } from './helpers';
import { sql } from './stores';

/** T-01 / T-02 / T-03 (authentication). The lockout test locks one demo account, so it needs ALLOW_MUTATING_TESTS=1. */
const up = await serverUp();
const d = up ? describe : describe.skip;
const post = (email: string, password: string) => fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });

d('authentication', () => {
  it('T-01: every role can sign in and lands on its own dashboard', async () => {
    const cases: [string, string, string][] = [
      [em.admin, 'Admin console', 'Risk by course'], [em.guide(1), 'Faculty dashboard', 'Approval queue'],
      ['reviewer1@projectpulse.test', 'Reviewer dashboard', 'Waiting for your review'], [em.student(1), 'Student workspace', 'Team progress'],
    ];
    for (const [email, title, widget] of cases) {
      const c = await login(email);
      const html = (await c.raw('/dashboard')).bytes.toString();
      expect(html, email).toContain(title);
      expect(html, email).toContain(widget);
    }
  });

  it('a user holding two roles can switch and gets the matching dashboard (AUTH-03)', async () => {
    const g3 = await login('guide3@projectpulse.test');
    expect((await g3.raw('/dashboard')).bytes.toString()).toContain('Faculty dashboard');
    expect((await g3.patch('/api/auth/me', { activeRole: 'reviewer' })).status).toBe(200);
    expect((await g3.raw('/dashboard')).bytes.toString()).toContain('Reviewer dashboard');
    expect((await g3.patch('/api/auth/me', { activeRole: 'admin' })).status).toBe(403);
  });

  it('wrong credentials and unknown users get the same generic message; the cookie is HttpOnly', async () => {
    const a = await (await post(em.student(5), 'definitely-wrong-1')).json();
    const b = await (await post('nobody@projectpulse.test', 'definitely-wrong-1')).json();
    expect(a.error.message).toBe(b.error.message);
    const ok = await post(em.student(5), process.env.SEED_DEFAULT_PASSWORD!);
    const cookie = ok.headers.getSetCookie().find((c) => c.startsWith('pp_session'))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
  });

  it('T-03: stored passwords are salted bcrypt hashes; nothing is plain text', async () => {
    const rows = await sql(`SELECT email::text AS email, password_hash FROM users`);
    expect(rows.length).toBeGreaterThan(10);
    for (const r of rows) expect(r.password_hash, r.email).toMatch(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/);
    expect(new Set(rows.map((r) => r.password_hash)).size).toBe(rows.length);                // same password, different salt
    expect(rows.some((r) => r.password_hash === process.env.SEED_DEFAULT_PASSWORD)).toBe(false);
  });
});

const lock = up && process.env.ALLOW_MUTATING_TESTS === '1' ? describe : describe.skip;
lock('T-02 account lockout', () => {
  it('five wrong passwords lock the account for 15 minutes, even for the right password', async () => {
    const email = em.student(8);                                   // an account no other test signs in with
    for (let i = 0; i < 5; i++) expect((await post(email, 'wrong-password-9')).status).toBe(401);
    const locked = await post(email, process.env.SEED_DEFAULT_PASSWORD!);
    expect(locked.status).toBe(429);
    expect((await locked.json()).error.message).toContain('15 minutes');
    const row = (await sql(`SELECT locked_until > now() + interval '14 minutes' AS long_lock FROM users WHERE email = $1`, [email]))[0];
    expect(row.long_lock).toBe(true);
    // an admin can unlock it again (reactivating clears the lock), so this test leaves nothing behind
    const admin = await login(em.admin);
    const id = (await sql(`SELECT user_id FROM users WHERE email = $1`, [email]))[0].user_id;
    expect((await admin.patch(`/api/admin/users/${id}`, { status: 'active' })).status).toBe(200);
    expect((await post(email, process.env.SEED_DEFAULT_PASSWORD!)).status).toBe(200);
  });
});
