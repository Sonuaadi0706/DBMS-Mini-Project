import Link from 'next/link';
import { pageProject } from '@/lib/auth/page';
import { latestSnapshot } from '@/lib/risk';
import { StatusChip } from '@/components/ui';
import { ProjectTabs } from '@/components/ProjectTabs';
import { Pulse, pulseLevel } from '@/components/viz/Pulse';

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { project } = await pageProject((await params).id);
  const risk = await latestSnapshot(project.project_id);
  return (
    <div>
      <div className="card-surface relative mb-5 overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-8 top-1/2 hidden -translate-y-1/2 lg:block"><Pulse level={pulseLevel(risk?.risk_level)} width={380} height={80} glow /></div>
        <div className="relative max-w-3xl">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-600">Team {project.team_name} · {project.course_name}</div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{project.title}</h1>
            <StatusChip status={project.status} />
            {risk && <StatusChip status={risk.risk_level} />}
          </div>
          <p className="mt-2 text-sm text-slate-600"><Link className="text-indigo-700 underline" href={`/proposals/${project.project_id}`}>View proposal</Link></p>
        </div>
      </div>
      <ProjectTabs projectId={project.project_id} />
      <div className="mt-5">{children}</div>
    </div>
  );
}
