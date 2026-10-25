import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoClient, type Db } from 'mongodb';
import '../../scripts/lib/env';
import { initCollections } from '../mongo/collections';

/** MongoDB validators and indexes (T-26 groundwork). Skipped when MongoDB is not running. */
let client: MongoClient | null = null;
let db: Db;

beforeAll(async () => {
  try {
    client = await new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 2000 }).connect();
    db = client.db(process.env.MONGODB_DB ?? 'projectpulse');
    await initCollections(db);
  } catch { client = null; }
});
afterAll(async () => { await db?.collection('documents').deleteMany({ title: /^__test__/ }); await db?.collection('feedback_threads').deleteMany({ feedbackId: { $gte: 900000 } }); await client?.close(); });

const validDoc = (over: object = {}) => ({
  projectId: 900001, milestoneId: 900001, documentType: 'SRS', title: '__test__ doc', tags: ['x'],
  versions: [{ versionNumber: 1, uploadedBy: 1, uploadedAt: new Date(), changeSummary: 'first' }], ...over,
});

describe('MongoDB collections', () => {
  it('accepts a well-formed document and keeps `sections` free-form', async (ctx) => {
    if (!client) return ctx.skip();
    const r = await db.collection('documents').insertOne(validDoc({ sections: { anything: { nested: [1, 2] } } }));
    expect(r.acknowledged).toBe(true);
  });
  it('rejects a document with an unknown type, no versions, or a bad version number', async (ctx) => {
    if (!client) return ctx.skip();
    const docs = db.collection('documents');
    await expect(docs.insertOne(validDoc({ documentType: 'Poster' }))).rejects.toMatchObject({ code: 121 });
    await expect(docs.insertOne(validDoc({ versions: [] }))).rejects.toMatchObject({ code: 121 });
    await expect(docs.insertOne(validDoc({ versions: [{ versionNumber: 0, uploadedBy: 1, uploadedAt: new Date(), changeSummary: 'x' }] }))).rejects.toMatchObject({ code: 121 });
    await expect(docs.insertOne({ title: '__test__ missing fields' })).rejects.toMatchObject({ code: 121 });
  });
  it('allows one thread per feedback item (unique index) and validates the theme', async (ctx) => {
    if (!client) return ctx.skip();
    const t = db.collection('feedback_threads');
    const base = { feedbackId: 900001, projectId: 1, theme: 'testing', status: 'open', messages: [] };
    await t.insertOne({ ...base });
    await expect(t.insertOne({ ...base })).rejects.toMatchObject({ code: 11000 });
    await expect(t.insertOne({ ...base, feedbackId: 900002, theme: 'gossip' })).rejects.toMatchObject({ code: 121 });
  });
  it('init is idempotent and creates the spec indexes', async (ctx) => {
    if (!client) return ctx.skip();
    await initCollections(db);
    const names = (await db.collection('documents').indexes()).map((i) => i.name);
    expect(names).toEqual(expect.arrayContaining(['projectId_1_milestoneId_1', 'documentType_1', 'tags_1', 'documents_text']));
  });
});
