import { ObjectId } from 'mongodb';
import { mongoDb } from '@/lib/db/mongo';
import type { PreparedVersion } from './upload';

// Cross-database rule (spec 7): PostgreSQL is the system of record. A MongoDB document is written first
// as { state: 'pending' }, confirmed after the SQL transaction commits, and deleted if it rolls back.

const TYPE_MAP: Record<string, string> = {
  proposal: 'Proposal', srs: 'SRS', design_doc: 'Design', source_code: 'Other', screenshot: 'Other',
  test_report: 'TestReport', presentation: 'Presentation', final_report: 'Report', other: 'Other',
};
export const mongoType = (deliverableType: string) => TYPE_MAP[deliverableType] ?? 'Other';

export interface DocVersion {
  versionNumber: number; uploadedBy: number; uploadedAt: Date; changeSummary: string;
  fileUrl: string | null; fileName: string | null; sizeBytes: number | null;
}

export function versionDoc(v: PreparedVersion, versionNumber: number, uploadedBy: number): DocVersion {
  return { versionNumber, uploadedBy, uploadedAt: new Date(), changeSummary: v.changeSummary, fileUrl: v.fileUrl, fileName: v.fileName, sizeBytes: v.sizeBytes };
}

export async function createPendingDocument(o: {
  projectId: number; milestoneId: number; deliverableType: string; title: string; version: DocVersion;
  extractedText: string | null; tags?: string[];
}): Promise<ObjectId> {
  const db = await mongoDb();
  const words = o.extractedText ? o.extractedText.split(/\s+/).filter(Boolean).length : 0;
  const res = await db.collection('documents').insertOne({
    projectId: o.projectId, milestoneId: o.milestoneId, deliverableId: null,
    documentType: mongoType(o.deliverableType), deliverableType: o.deliverableType, title: o.title,
    versions: [o.version], sections: {}, tags: o.tags ?? [], extractedText: o.extractedText ?? '', wordCount: words,
    state: 'pending', createdAt: new Date(),
  });
  return res.insertedId;
}

export async function confirmDocument(id: ObjectId | string, deliverableId: number): Promise<void> {
  const db = await mongoDb();
  await db.collection('documents').updateOne({ _id: new ObjectId(String(id)) }, { $set: { state: 'confirmed', deliverableId } });
}

/** Compensation after a SQL rollback. Never throws: the original error is what the caller must see. */
export async function discardDocument(id: ObjectId | string | null | undefined): Promise<void> {
  if (!id) return;
  try {
    const db = await mongoDb();
    await db.collection('documents').deleteOne({ _id: new ObjectId(String(id)), state: 'pending' });
  } catch (e) { console.error('Could not remove pending Mongo document', e); }
}

/** Append a version to an existing document (best effort after the SQL commit; reconcile repairs gaps). */
export async function pushVersion(docId: string, v: DocVersion, extractedText?: string | null): Promise<void> {
  const db = await mongoDb();
  await db.collection('documents').updateOne(
    { _id: new ObjectId(docId) },
    { $push: { versions: v as any }, ...(extractedText ? { $set: { extractedText, wordCount: extractedText.split(/\s+/).filter(Boolean).length } } : {}) });
}

export async function recordAttachment(o: { projectId: number; deliverableId: number; v: PreparedVersion; uploadedBy: number }): Promise<void> {
  if (!o.v.stored) return;
  const db = await mongoDb();
  await db.collection('attachments').insertOne({
    projectId: o.projectId, deliverableId: o.deliverableId, fileName: o.v.fileName, mimeType: o.v.mime ?? 'application/octet-stream',
    sizeBytes: o.v.sizeBytes ?? 0, storagePath: o.v.fileUrl, uploadedBy: o.uploadedBy, uploadedAt: new Date(),
  });
}

export async function listProjectDocuments(projectId: number) {
  const db = await mongoDb();
  return db.collection('documents')
    .find({ projectId, state: 'confirmed' }, { projection: { extractedText: 0 } })
    .sort({ createdAt: -1 }).toArray();
}
