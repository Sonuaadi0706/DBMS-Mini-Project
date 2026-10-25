'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { call } from '@/lib/client/api';
import { useAction } from './useAction';
import { ErrorBanner, FieldError, btnGhost, btnPrimary, inputCls } from './ui';

export interface ProposalValues {
  title: string; abstract: string; problemStatement: string; objectives: string; scope: string;
  domain: string; technologies: string; repoLink: string;
}
const EMPTY: ProposalValues = { title: '', abstract: '', problemStatement: '', objectives: '', scope: '', domain: '', technologies: '', repoLink: '' };

const TEXT_FIELDS: { key: keyof ProposalValues; label: string; rows: number; hint?: string }[] = [
  { key: 'abstract', label: 'Abstract', rows: 4, hint: 'At least 50 characters to submit' },
  { key: 'problemStatement', label: 'Problem statement', rows: 3, hint: 'At least 30 characters to submit' },
  { key: 'objectives', label: 'Objectives', rows: 3 },
  { key: 'scope', label: 'Scope', rows: 3 },
];

/** Create (projectId undefined) or edit a proposal. "Save draft" keeps it editable; "Save and submit" sends it to the guide. */
export function ProposalForm({ projectId, initial, teams }: {
  projectId?: number; initial?: ProposalValues; teams?: { team_id: number; label: string }[];
}) {
  const router = useRouter();
  const { busy, error, fields, run } = useAction();
  const [v, setV] = useState<ProposalValues>(initial ?? EMPTY);
  const [teamId, setTeamId] = useState<number | undefined>(teams?.length === 1 ? teams[0].team_id : undefined);
  const set = (k: keyof ProposalValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  function payload() {
    return {
      title: v.title, abstract: v.abstract, problemStatement: v.problemStatement, objectives: v.objectives, scope: v.scope,
      domain: v.domain, repoLink: v.repoLink,
      technologies: v.technologies.split(',').map((t) => t.trim()).filter(Boolean),
    };
  }

  async function save(submit: boolean) {
    await run(async () => {
      let id = projectId;
      if (id) await call('PATCH', `/api/proposals/${id}`, payload());
      else id = (await call<{ projectId: number }>('POST', '/api/proposals', { ...payload(), teamId })).projectId;
      if (submit) await call('POST', `/api/proposals/${id}/submit`);
      return id;
    }, { refresh: false, onDone: (id) => { router.push(`/proposals/${id}`); router.refresh(); } });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(false); }} className="space-y-4 rounded-lg border bg-white p-5">
      {!projectId && teams && teams.length > 1 && (
        <label className="block text-sm font-medium">Team
          <select value={teamId ?? ''} onChange={(e) => setTeamId(Number(e.target.value) || undefined)} className={inputCls}>
            <option value="">Choose a team…</option>
            {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.label}</option>)}
          </select>
        </label>
      )}
      <label className="block text-sm font-medium">Title
        <input value={v.title} onChange={set('title')} className={inputCls} maxLength={200} />
        <FieldError message={fields.title} />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium">Domain
          <input value={v.domain} onChange={set('domain')} className={inputCls} maxLength={80} placeholder="e.g. Healthcare" />
          <FieldError message={fields.domain} />
        </label>
        <label className="block text-sm font-medium">Technologies <span className="font-normal text-slate-500">(comma separated)</span>
          <input value={v.technologies} onChange={set('technologies')} className={inputCls} placeholder="Next.js, PostgreSQL" />
        </label>
      </div>
      {TEXT_FIELDS.map((f) => (
        <label key={f.key} className="block text-sm font-medium">{f.label} {f.hint && <span className="font-normal text-slate-500">({f.hint})</span>}
          <textarea value={v[f.key]} onChange={set(f.key)} rows={f.rows} className={inputCls} />
          <FieldError message={fields[f.key]} />
        </label>
      ))}
      <label className="block text-sm font-medium">Repository link <span className="font-normal text-slate-500">(optional)</span>
        <input value={v.repoLink} onChange={set('repoLink')} className={inputCls} placeholder="https://github.com/…" />
        <FieldError message={fields.repoLink} />
      </label>
      <ErrorBanner message={error} />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btnGhost}>{busy ? 'Saving…' : 'Save draft'}</button>
        <button type="button" disabled={busy} onClick={() => save(true)} className={btnPrimary}>Save and submit for review</button>
      </div>
    </form>
  );
}
