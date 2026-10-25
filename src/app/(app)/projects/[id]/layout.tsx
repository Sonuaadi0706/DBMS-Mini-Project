import Link from 'next/link';
import { pageProject } from '@/lib/auth/page';
import { StatusChip } from '@/components/ui';
import { ProjectTabs } from '@/components/ProjectTabs';

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { project } = await pageProject((await params).id);
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{project.title}</h1>
        <StatusChip status={project.status} />
      </div>
      <p className="mb-4 text-sm text-slate-600">Team {project.team_name} · {project.course_name} · <Link className="text-indigo-700 underline" href={`/proposals/${project.project_id}`}>Proposal</Link></p>
      <ProjectTabs projectId={project.project_id} />
      <div className="mt-4">{children}</div>
    </div>
  );
}
