import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import '../../scripts/lib/env';

/** T-29: no credentials in the repository, and .env is ignored. Scans tracked source files, not node_modules. */
const root = path.resolve(__dirname, '../..');
const SKIP = new Set(['node_modules', '.next', '.git', 'storage', 'docs', 'coverage']);

function* files(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name === '.env') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* files(full);
    else if (/\.(ts|tsx|mts|js|mjs|json|sql|md|yml|yaml|css|example)$/.test(e.name) || e.name === '.env.example') yield full;
  }
}

describe('T-29 secrets are not in the repository', () => {
  it('.env is git-ignored and .env.example holds placeholders only', () => {
    const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toMatch(/storage\/uploads/);
    const ex = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
    for (const key of ['AUTH_SECRET', 'JOB_SECRET', 'SEED_DEFAULT_PASSWORD', 'APP_DB_PASSWORD']) {
      const v = ex.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1] ?? '';
      expect(v, key).toMatch(/choose|generate|another|random|password/i);          // an instruction, not a value
    }
  });

  it('no real secret value from .env appears in any source file', () => {
    const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
    const secrets = ['AUTH_SECRET', 'JOB_SECRET', 'SEED_DEFAULT_PASSWORD', 'APP_DB_PASSWORD']
      .map((k) => env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim()).filter((v): v is string => !!v && v.length >= 8);
    expect(secrets.length).toBe(4);
    const leaks: string[] = [];
    for (const f of files(root)) {
      const text = fs.readFileSync(f, 'utf8');
      for (const s of secrets) if (text.includes(s)) leaks.push(`${path.relative(root, f)}`);
    }
    expect(leaks).toEqual([]);
  });

  it('no hard-coded passwords, tokens or connection strings with credentials in code', () => {
    const bad: string[] = [];
    const patterns = [/postgres(ql)?:\/\/[^\s'"`:@/]+:[^\s'"`@]+@/i, /mongodb(\+srv)?:\/\/[^\s'"`:@/]+:[^\s'"`@]+@/i, /(password|secret|api[_-]?key)\s*[:=]\s*['"](?![A-Z_]+['"])[^'"\s$]{8,}['"]/i]    // ALL_CAPS values are variable names such as :'APP_DB_PASSWORD', not secrets;
    for (const f of files(root)) {
      if (/\.(test)\.(ts|mts)$/.test(f) || f.endsWith('.env.example') || f.endsWith('.md')) continue;       // tests may hold throw-away fixture values
      const text = fs.readFileSync(f, 'utf8');
      for (const p of patterns) if (p.test(text)) bad.push(`${path.relative(root, f)} matches ${p}`);
    }
    expect(bad).toEqual([]);
  });

  it('git does not track .env or uploaded files (when the folder is a repository)', () => {
    let tracked = '';
    try { tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return; }   // not a repository yet
    if (!tracked.trim()) return;
    expect(tracked.split('\n')).not.toContain('.env');
    expect(tracked).not.toMatch(/^storage\/uploads\/(?!\.gitkeep)/m);
  });
});
