import { pageUser } from '@/lib/auth/page';
import { listDepartments, listUsers } from '@/lib/data/admin';
import { Card, StatusChip, fmt, label } from '@/components/ui';
import { CreateUserForm, UserActions } from '@/components/AdminForms';

export default async function UsersPage() {
  const me = await pageUser();
  const [users, departments] = await Promise.all([listUsers(), listDepartments()]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><p className="text-sm text-slate-600">{users.length} accounts. Passwords are stored only as salted hashes; you can set a new temporary password but never see one.</p><CreateUserForm departments={departments} /></div>
      <Card className="overflow-x-auto !p-0"><table className="w-full text-left text-sm">
        <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Roles</th><th className="p-2">Dept</th><th className="p-2">Last login</th><th className="p-2">Status</th><th className="p-2" /></tr></thead>
        <tbody>{users.map((u) => (
          <tr key={u.user_id} className="border-b last:border-0 align-top">
            <td className="p-2 font-medium">{u.name}<div className="text-xs font-normal text-slate-500">{u.identifier}</div></td><td className="p-2 text-xs">{u.email}</td>
            <td className="p-2 text-xs">{u.roles.map((r) => label(r)).join(', ')}</td><td className="p-2 text-xs">{u.dept_name ?? '—'}</td>
            <td className="p-2 text-xs text-slate-500">{u.last_login_at ? fmt(u.last_login_at) : 'never'}</td>
            <td className="p-2"><StatusChip status={u.status === 'active' ? 'approved' : 'rejected'} />{u.locked && <span className="ml-1 text-xs text-red-600">locked</span>}<div className="text-xs text-slate-500">{label(u.status)}</div></td>
            <td className="p-2"><UserActions userId={u.user_id} roles={u.roles} status={u.status} isSelf={u.user_id === me.userId} /></td></tr>))}</tbody></table></Card>
    </div>
  );
}
