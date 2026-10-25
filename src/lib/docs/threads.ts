import { mongoDb } from '@/lib/db/mongo';

// One discussion thread per feedback item, stored in MongoDB (spec 11). PostgreSQL holds the feedback
// state; the thread mirrors the status so the aggregation on open themes can run inside MongoDB alone.

export interface ThreadMessage { authorId: number; authorName?: string; role: string; text: string; at: Date }

export async function appendMessage(o: {
  feedbackId: number; projectId: number; milestoneId: number; theme: string; status: string; message: ThreadMessage;
}): Promise<void> {
  const db = await mongoDb();
  await db.collection('feedback_threads').updateOne(
    { feedbackId: o.feedbackId },
    { $setOnInsert: { projectId: o.projectId, milestoneId: o.milestoneId, theme: o.theme, status: o.status }, $push: { messages: o.message as any } },
    { upsert: true });
}

export async function setThreadStatus(feedbackId: number, status: string): Promise<void> {
  const db = await mongoDb();
  await db.collection('feedback_threads').updateOne({ feedbackId }, { $set: { status } });
}

export async function getThread(feedbackId: number) {
  const db = await mongoDb();
  return db.collection('feedback_threads').findOne({ feedbackId }, { projection: { _id: 0 } });
}

/** Thread side effects must never fail the SQL operation that already committed. */
export async function safely(fn: () => Promise<void>): Promise<void> {
  try { await fn(); } catch (e) { console.error('Feedback thread update failed (Mongo)', e); }
}
