import { ApiError, forbidden } from '@/lib/api/errors';
import type { CurrentUser } from '@/lib/auth/session';
import { loadFeedback, requireFeedbackAccess, type FeedbackContext, type ProjectAccess } from '@/lib/auth/access';
import { appendMessage, safely, setThreadStatus } from './threads';
import { refreshRiskSafely } from '@/lib/risk';

export const roleOf = (a: ProjectAccess) => (a.isGuide ? 'faculty_guide' : a.isReviewer ? 'reviewer' : a.isAdmin && !a.isMember ? 'admin' : 'student');

/** Load a feedback item and check the caller may see it (students: only their own). */
export async function feedbackFor(user: CurrentUser, id: number) {
  const fb = await loadFeedback(id);
  const access = await requireFeedbackAccess(user, fb);
  return { fb, access };
}

/** Only the student the item was assigned to may respond to or resolve it. */
export function requireAssignee(user: CurrentUser, fb: FeedbackContext) {
  if (fb.assignedUserId !== user.userId) throw forbidden('Only the student this feedback is assigned to can do that.');
}

export function requireFeedbackGuide(access: ProjectAccess) {
  if (!access.isGuide) throw forbidden('Only the project\'s guide can verify or reopen feedback.');
}

export function badState(fb: FeedbackContext, wanted: string): ApiError {
  return new ApiError(409, 'bad_state', `This feedback is ${fb.status.replace('_', ' ')} and cannot be ${wanted}.`);
}

/** After the SQL commit: mirror the new status (and an optional message) into the MongoDB thread. */
export async function syncThread(user: CurrentUser, fb: FeedbackContext, access: ProjectAccess, status: string, text?: string | null) {
  await refreshRiskSafely(fb.projectId); // unresolved feedback is a risk factor
  await safely(async () => {
    if (text) {
      await appendMessage({
        feedbackId: fb.feedbackId, projectId: fb.projectId, milestoneId: fb.milestoneId, theme: 'other', status,
        message: { authorId: user.userId, authorName: user.name, role: roleOf(access), text, at: new Date() },
      });
    }
    await setThreadStatus(fb.feedbackId, status);
  });
}
