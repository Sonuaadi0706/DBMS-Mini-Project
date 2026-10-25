import { pageProject } from '@/lib/auth/page';
import { listMilestones, listProjectTasks, teamMemberOptions } from '@/lib/data/queries';
import { Empty } from '@/components/ui';
import { TaskBoard } from '@/components/TaskBoard';

export default async function TasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { access, project: p } = await pageProject((await params).id);
  const [tasks, milestones, people] = await Promise.all([listProjectTasks(p.project_id), listMilestones(p.project_id), teamMemberOptions(p.team_id)]);
  if (milestones.length === 0) return <Empty>Tasks belong to milestones. Create the milestones first.</Empty>;
  return (
    <TaskBoard tasks={tasks} people={people} isMember={access.isMember} isGuide={access.isGuide}
      canPlan={['approved', 'in_progress'].includes(p.status)}
      milestones={milestones.map((m) => ({ milestone_id: m.milestone_id, sequence_no: m.sequence_no, title: m.title, status: m.status }))} />
  );
}
