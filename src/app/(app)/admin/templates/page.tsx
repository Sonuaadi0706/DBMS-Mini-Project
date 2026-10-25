import { listAdminCourses, listAdminTemplates } from '@/lib/data/admin';
import { Card, label } from '@/components/ui';
import { TemplateEditor } from '@/components/AdminForms';

export default async function TemplatesPage() {
  const [templates, courses] = await Promise.all([listAdminTemplates(), listAdminCourses()]);
  const opts = courses.map((c) => ({ course_id: c.course_id, course_name: c.course_name }));
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">A template is a reusable project plan. Teams copy it into their own milestones, so editing a template never changes running projects.</p>
      {templates.map((t) => (
        <Card key={t.template_id}>
          <div className="flex items-start justify-between gap-2"><div><h2 className="font-medium">{t.name} {!t.is_active && <span className="text-xs font-normal text-slate-500">(inactive)</span>}</h2><p className="text-xs text-slate-500">{t.description} · used by {t.used_by} project(s)</p></div></div>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm">{t.milestones.map((m, i) => <li key={i}>{m.title} <span className="text-xs text-slate-500">· day {m.offsetDays} · weight {m.weightage}{m.requiredDeliverableTypes.length > 0 && ` · needs ${m.requiredDeliverableTypes.map(label).join(', ')}`}</span></li>)}</ol>
          <TemplateEditor template={t} courses={opts} />
        </Card>))}
      <Card><h2 className="mb-1 font-medium">New template</h2><TemplateEditor courses={opts} /></Card>
    </div>
  );
}
