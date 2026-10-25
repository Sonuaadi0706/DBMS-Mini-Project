import { listDepartments } from '@/lib/data/admin';
import { DepartmentManager } from '@/components/AdminForms';

export default async function DepartmentsPage() {
  return <DepartmentManager departments={await listDepartments()} />;
}
