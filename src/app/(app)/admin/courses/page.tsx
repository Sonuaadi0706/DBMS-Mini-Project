import { listAdminCourses, listDepartments } from '@/lib/data/admin';
import { CourseManager } from '@/components/AdminForms';

export default async function CoursesPage() {
  const [courses, departments] = await Promise.all([listAdminCourses(), listDepartments()]);
  return <CourseManager courses={courses} departments={departments} />;
}
