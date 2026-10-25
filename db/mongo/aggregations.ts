/**
 * MongoDB aggregation pipelines (spec 11.4). Each builder returns a plain pipeline so it can be shown in the
 * report, run in mongosh, or executed by the API. Project / deliverable ids come from PostgreSQL (the system of
 * record), which also decides WHICH projects a person may see; MongoDB only does the document maths.
 */
const CONFIRMED = { state: 'confirmed' };

export const pipelines = {
  /** A1: how many versions each document has, and when it last changed (one project). */
  versionCounts: (projectId: number) => [
    { $match: { projectId, ...CONFIRMED } },
    { $project: { title: 1, documentType: 1, deliverableType: 1, versionCount: { $size: '$versions' }, lastUpdated: { $max: '$versions.uploadedAt' } } },
    { $sort: { versionCount: -1, title: 1 } },
  ],

  /** A2: document-type distribution across a set of projects, with the average number of versions. */
  typeDistribution: (projectIds: number[]) => [
    { $match: { projectId: { $in: projectIds }, ...CONFIRMED } },
    { $group: { _id: '$documentType', documents: { $sum: 1 }, avgVersions: { $avg: { $size: '$versions' } } } },
    { $sort: { documents: -1, _id: 1 } },
  ],

  /**
   * A3 (Mongo half): which (milestone, deliverable type) pairs have a document, counting only the deliverables
   * PostgreSQL says are submitted or accepted. The API merges this with the required types from SQL.
   */
  typesPresent: (deliverableIds: number[]) => [
    { $match: { deliverableId: { $in: deliverableIds }, ...CONFIRMED } },
    { $group: { _id: { milestoneId: '$milestoneId', type: '$deliverableType' }, versions: { $sum: { $size: '$versions' } } } },
  ],

  /** A4: the most common themes among feedback discussions that are still open. */
  feedbackThemes: (projectIds: number[]) => [
    { $match: { projectId: { $in: projectIds }, status: { $in: ['open', 'in_progress', 'reopened'] } } },
    { $group: { _id: '$theme', openThreads: { $sum: 1 }, avgMessages: { $avg: { $size: '$messages' } } } },
    { $sort: { openThreads: -1, _id: 1 } },
    { $limit: 10 },
  ],

  /** A5: most used technology / domain tags ($unwind turns the tags array into one row per tag). */
  tagCounts: (projectIds: number[]) => [
    { $match: { projectId: { $in: projectIds }, ...CONFIRMED } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', n: { $sum: 1 } } },
    { $sort: { n: -1, _id: 1 } },
    { $limit: 15 },
  ],
};
