import { describe, expect, it } from 'vitest';
import { BASE, serverUp } from './helpers';
import { sql } from './stores';

/** Self-service sign-up, profile name and password change. Changes data (restored after a mutating run). */
const enabled = (await serverUp()) && process.env.ALLOW_MUTATING_TESTS === '1';
const d = enabled ? describe : describe.skip;

const post = (path: string, body: object, cookie?: string) => fetch(`${BASE}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body),
});
const patch = (path: string, body: object, cookie: string) => fetch(`${BASE}${path}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body),
});
const sessionOf = (res: Response) => res.headers.getSetCookie().find((c) => c.startsWith('pp_session='))!.split(';')[0];

d('student sign-up and account', () => {
  const email = 'signup.test@projectpulse.test';
  const pw = 'Signup1234', pw2 = 'Changed5678';
  let cookie = '';

  it('the sign-up page is public', async () => {
    expect((await fetch(`${BASE}/register`)).status).toBe(200);
  });

  it('sign-up checks the password rules and the e-mail', async () => {
    expect((await post('/api/auth/register', { name: 'Sign Up', email, password: 'short' })).status).toBe(422);
    expect((await post('/api/auth/register', { name: 'Sign Up', email: 'not-an-email', password: pw })).status).toBe(422);
    expect((await post('/api/auth/register', { name: 'S', email, password: pw })).status).toBe(422);
  });

  it('sign-up creates a student only (a client-supplied role is ignored), stores a hash, and signs in', async () => {
    const res = await post('/api/auth/register', { name: 'Sign Up Test', email, password: pw, roles: ['admin'], role: 'admin' });
    expect(res.status).toBe(201);
    cookie = sessionOf(res);
    const roles = await sql(`SELECT r.role_name FROM user_roles ur JOIN roles r USING (role_id) JOIN users u USING (user_id) WHERE u.email = $1`, [email]);
    expect(roles.map((r: any) => r.role_name)).toEqual(['student']);
    const hash = (await sql(`SELECT password_hash FROM users WHERE email = $1`, [email]))[0].password_hash as string;
    expect(hash).not.toContain(pw);
    const me = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookie } });
    expect((await me.json()).user.roles).toEqual(['student']);
  });

  it('a second sign-up with the same e-mail (any case) is refused', async () => {
    const dup = await post('/api/auth/register', { name: 'Someone Else', email: email.toUpperCase(), password: pw });
    expect(dup.status).toBe(409);
    expect((await dup.json()).error.message).toContain('already registered');
  });

  it('the user can rename themselves, but a too-short name is refused', async () => {
    expect((await patch('/api/auth/profile', { name: 'X' }, cookie)).status).toBe(422);
    const ok = await patch('/api/auth/profile', { name: 'Renamed Student' }, cookie);
    expect(ok.status).toBe(200);
    expect((await sql(`SELECT name FROM users WHERE email = $1`, [email]))[0].name).toBe('Renamed Student');
  });

  it('profile and password endpoints need a session', async () => {
    expect((await patch('/api/auth/profile', { name: 'Nobody' }, '')).status).toBe(401);
    expect((await post('/api/auth/change-password', { currentPassword: pw, newPassword: pw2 })).status).toBe(401);
  });

  it('change password: wrong current password refused, correct one works and the old one stops working', async () => {
    expect((await post('/api/auth/change-password', { currentPassword: 'Wrong12345', newPassword: pw2 }, cookie)).status).toBe(422);
    expect((await post('/api/auth/change-password', { currentPassword: pw, newPassword: 'weak' }, cookie)).status).toBe(422);
    expect((await post('/api/auth/change-password', { currentPassword: pw, newPassword: pw2 }, cookie)).status).toBe(200);
    expect((await post('/api/auth/login', { email, password: pw })).status).toBe(401);
    expect((await post('/api/auth/login', { email, password: pw2 })).status).toBe(200);
  });
});
