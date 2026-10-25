import { z } from 'zod';
import { ApiError } from '@/lib/api/errors';
import { cleanFileName, maxBytes, saveUpload, type StoredFile } from '@/lib/storage';

/** Parsed request body: JSON, or multipart/form-data with an optional `file` part. */
export interface UploadRequest { fields: Record<string, string>; file?: File }

export async function readUpload(req: Request): Promise<UploadRequest> {
  const type = req.headers.get('content-type') ?? '';
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > maxBytes() + 2 * 1024 * 1024) {
    throw new ApiError(413, 'file_too_large', `The upload is larger than ${process.env.STORAGE_MAX_FILE_MB ?? 10} MB.`, { file: 'File too large' });
  }
  if (type.includes('multipart/form-data')) {
    const form = await req.formData().catch(() => {
      throw new ApiError(422, 'invalid_upload', 'The upload could not be read. It may be too large or incomplete.', { file: 'Upload could not be read' });
    });
    const fields: Record<string, string> = {};
    let file: File | undefined;
    for (const [k, v] of form.entries()) {
      if (typeof v === 'string') fields[k] = v;
      else if (k === 'file' && v.size > 0) file = v;
    }
    return { fields, file };
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) if (v !== null && v !== undefined) fields[k] = String(v);
  return { fields };
}

const urlRe = /^https?:\/\//i;

export const VersionFields = z.object({
  changeSummary: z.string().trim().min(1, 'Describe what changed in this version').max(500),
  linkUrl: z.string().trim().max(500).regex(urlRe, 'Must start with http:// or https://').optional(),
  fileName: z.string().trim().max(255).optional(),
  // Declared size of an externally hosted file. Deliberately NOT range-checked here: the database CHECK
  // (file_size_bytes >= 0) is the authority, which is what the rollback test (T-15) exercises.
  fileSizeBytes: z.coerce.number().int().optional(),
});

export interface PreparedVersion {
  changeSummary: string;
  fileName: string;
  fileUrl: string;            // storage key for uploads, or the external link
  sizeBytes: number | null;
  checksum: string | null;
  mime: string | null;
  extractedText: string | null;
  stored?: StoredFile;        // set only when a file was written to disk (so it can be compensated)
}

/** Validates the version part of a request and stores the file, if any. */
export async function prepareVersion(u: UploadRequest): Promise<PreparedVersion> {
  const f = VersionFields.parse({ ...u.fields, linkUrl: u.fields.linkUrl || undefined });
  if (u.file) {
    const stored = await saveUpload(u.file);
    return { changeSummary: f.changeSummary, fileName: stored.fileName, fileUrl: stored.key, sizeBytes: stored.size,
      checksum: stored.checksum, mime: stored.mime, extractedText: stored.extractedText, stored };
  }
  if (f.linkUrl) {
    let guess = 'external link';
    try { guess = cleanFileName(decodeURIComponent(new URL(f.linkUrl).pathname.split('/').filter(Boolean).pop() ?? '')) || guess; } catch { /* keep default */ }
    return { changeSummary: f.changeSummary, fileName: f.fileName || guess, fileUrl: f.linkUrl, sizeBytes: f.fileSizeBytes ?? null,
      checksum: null, mime: null, extractedText: null };
  }
  throw new ApiError(422, 'validation', 'Attach a file or provide a link.', { file: 'Attach a file or provide a link' });
}

export const DeliverableFields = z.object({
  deliverableType: z.enum(['proposal', 'srs', 'design_doc', 'source_code', 'screenshot', 'test_report', 'presentation', 'final_report', 'other']),
  title: z.string().trim().min(2, 'Title is too short').max(200),
  repoLink: z.string().trim().max(500).regex(urlRe, 'Must start with http:// or https://').optional().or(z.literal('')),
  evidenceUrl: z.string().trim().max(500).regex(urlRe, 'Must start with http:// or https://').optional().or(z.literal('')),
});
