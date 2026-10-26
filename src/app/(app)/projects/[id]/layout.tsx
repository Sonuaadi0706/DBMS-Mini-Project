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
      <div className="mb-1 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 text-xs font-medium text-slate-500">Team {project.team_name} · {project.course_name}</div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{project.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <StatusChip status={project.status} />{risk && <StatusChip status={risk.risk_level} />}
            <Link className="ml-1 text-indigo-700 hover:underline" href={`/proposals/${project.project_id}`}>View proposal</Link>
          </div>
        </div>
        <div className="hidden opacity-80 lg:block"><Pulse level={pulseLevel(risk?.risk_level)} width={220} height={40} /></div>
      </div>
      <ProjectTabs projectId={project.project_id} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
