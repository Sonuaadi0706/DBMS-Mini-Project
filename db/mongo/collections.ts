import type { Db } from 'mongodb';

/**
 * MongoDB holds the flexible, document-shaped records (spec section 11): an SRS, a test report and a
 * meeting note have different fields, so they are not forced into SQL columns. PostgreSQL stays the
 * system of record; documents reference it by integer ids (projectId, milestoneId, deliverableId).
 */

export const DOCUMENT_TYPES = ['SRS', 'Design', 'Report', 'TestReport', 'Presentation', 'Proposal', 'Other'] as const;
export const FEEDBACK_THEMES = ['documentation', 'requirements', 'design', 'implementation', 'testing', 'presentation', 'other'] as const;

const intLike = { bsonType: ['int', 'long'] };

const versionSchema = {
  bsonType: 'object',
  required: ['versionNumber', 'uploadedBy', 'uploadedAt', 'changeSummary'],
  properties: {
    versionNumber: { ...intLike, minimum: 1 },
    uploadedBy: intLike,
    uploadedAt: { bsonType: 'date' },
    changeSummary: { bsonType: 'string' },
    fileUrl: { bsonType: ['string', 'null'] },
  },
};

export const COLLECTIONS: Record<string, { validator: object; indexes: { key: Record<string, 1 | -1 | 'text'>; options?: object }[] }> = {
  documents: {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['projectId', 'milestoneId', 'documentType', 'title', 'versions', 'tags'],
        properties: {
          projectId: intLike, milestoneId: intLike, deliverableId: { bsonType: ['int', 'long', 'null'] },
          documentType: { enum: [...DOCUMENT_TYPES] },
          title: { bsonType: 'string' },
          versions: { bsonType: 'array', minItems: 1, items: versionSchema },
          tags: { bsonType: 'array', items: { bsonType: 'string' } },
          state: { enum: ['pending', 'confirmed'] },
          // `sections` is free-form on purpose: that is the reason this is not a SQL table.
        },
      },
    },
    indexes: [
      { key: { projectId: 1, milestoneId: 1 } },
      { key: { documentType: 1 } },
      { key: { 'versions.uploadedAt': -1 } },
      { key: { tags: 1 } },
      { key: { deliverableId: 1 }, options: { sparse: true } },
      { key: { state: 1, createdAt: 1 } },
      { key: { title: 'text', extractedText: 'text', 'sections.problemStatement': 'text' }, options: { name: 'documents_text' } },
    ],
  },
  feedback_threads: {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['feedbackId', 'projectId', 'theme', 'status', 'messages'],
        properties: {
          feedbackId: intLike, projectId: intLike, milestoneId: { bsonType: ['int', 'long', 'null'] },
          theme: { enum: [...FEEDBACK_THEMES] },
          status: { enum: ['open', 'in_progress', 'resolved', 'verified', 'reopened'] },
          messages: {
            bsonType: 'array',
            items: { bsonType: 'object', required: ['authorId', 'role', 'text', 'at'],
              properties: { authorId: intLike, role: { bsonType: 'string' }, text: { bsonType: 'string' }, at: { bsonType: 'date' } } },
          },
        },
      },
    },
    indexes: [
      { key: { projectId: 1, status: 1 } },
      { key: { feedbackId: 1 }, options: { unique: true } },
    ],
  },
  meeting_notes: {
    validator: {
      $jsonSchema: {
        bsonType: 'object', required: ['projectId', 'date', 'notes'],
        properties: {
          projectId: intLike, date: { bsonType: 'date' }, notes: { bsonType: 'string' },
          attendees: { bsonType: 'array', items: { bsonType: ['int', 'long'] } },
          actionItems: { bsonType: 'array', items: { bsonType: 'object', required: ['text'], properties: { text: { bsonType: 'string' }, ownerId: { bsonType: ['int', 'long', 'null'] }, done: { bsonType: 'bool' } } } },
        },
      },
    },
    indexes: [{ key: { projectId: 1, date: -1 } }],
  },
  attachments: {
    validator: {
      $jsonSchema: {
        bsonType: 'object', required: ['projectId', 'fileName', 'storagePath', 'uploadedBy', 'uploadedAt'],
        properties: { projectId: intLike, deliverableId: { bsonType: ['int', 'long', 'null'] }, fileName: { bsonType: 'string' },
          mimeType: { bsonType: 'string' }, sizeBytes: { bsonType: ['int', 'long'] }, storagePath: { bsonType: 'string' },
          uploadedBy: intLike, uploadedAt: { bsonType: 'date' } },
      },
    },
    indexes: [{ key: { projectId: 1, deliverableId: 1 } }],
  },
};

/** Idempotent: creates each collection with its validator, or updates the validator if it already exists. */
export async function initCollections(db: Db, onStep?: (name: string) => void): Promise<void> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const [name, def] of Object.entries(COLLECTIONS)) {
    if (existing.has(name)) {
      await db.command({ collMod: name, validator: def.validator, validationLevel: 'strict', validationAction: 'error' });
    } else {
      await db.createCollection(name, { validator: def.validator, validationLevel: 'strict', validationAction: 'error' });
    }
    for (const ix of def.indexes) await db.collection(name).createIndex(ix.key as any, ix.options as any);
    onStep?.(name);
  }
}
