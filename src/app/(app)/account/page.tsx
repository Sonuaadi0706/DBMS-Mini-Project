import { pageUser } from '@/lib/auth/page';
import { query } from '@/lib/db/pg';
import { Card, PageTitle, label } from '@/components/ui';
import { PasswordForm, ProfileForm } from '@/components/AccountForms';

export default async function AccountPage() {
  const user = await pageUser();
  const [row] = await query<{ identifier: string | null; dept: string | null; last_login_at: string | null }>(
    `SELECT u.identifier, d.dept_name AS dept, u.last_login_at FROM users u LEFT JOIN departments d ON d.dept_id = u.dept_id WHERE u.user_id = $1`, [user.userId]);
  return (
    <section className="max-w-3xl space-y-4">
      <PageTitle title="Account" subtitle="Your profile and sign-in details." />
      <Card>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Email</dt><dd className="font-medium">{user.email}</dd></div>
          <div><dt className="text-xs text-slate-500">Roles</dt><dd className="font-medium">{user.roles.map(label).join(', ')}</dd></div>
          <div><dt className="text-xs text-slate-500">USN / employee id</dt><dd className="font-medium">{row?.identifier ?? '—'}</dd></div>
          <div><dt className="text-xs text-slate-500">Department</dt><dd className="font-medium">{row?.dept ?? '—'}</dd></div>
        </dl>
      </Card>
      <ProfileForm name={user.name} />
      <PasswordForm />
    </section>
  );
}
