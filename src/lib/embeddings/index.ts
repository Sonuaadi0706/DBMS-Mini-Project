// Local sentence-embedding model (spec 12): Xenova/all-MiniLM-L6-v2 through @huggingface/transformers.
// Runs inside Node, needs no API key, produces 384-dimensional vectors, normalised to length 1 so that
// cosine similarity is a dot product. The model is downloaded once (first use needs internet) and cached.
import type { FeatureExtractionPipeline } from '@huggingface/transformers';

export const MODEL_NAME = process.env.EMBEDDING_MODEL ?? 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM ?? 384);

const g = globalThis as unknown as { __ppEmbedder?: Promise<FeatureExtractionPipeline> };

function extractor(): Promise<FeatureExtractionPipeline> {
  g.__ppEmbedder ??= (async () => {
    // The library's `pipeline` typing is huge; a narrow signature keeps the compiler fast and is all we use.
    const { pipeline } = (await import('@huggingface/transformers')) as unknown as { pipeline: (task: string, model: string) => Promise<unknown> };
    return (await pipeline('feature-extraction', MODEL_NAME)) as FeatureExtractionPipeline;
  })().catch((e) => { g.__ppEmbedder = undefined; throw e; });   // allow a retry after a failed download
  return g.__ppEmbedder;
}

/** One vector per text, in order. Batched so a long list does not exhaust memory. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const model = await extractor();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 8) {
    const t = await model(texts.slice(i, i + 8), { pooling: 'mean', normalize: true });
    const rows = t.tolist() as number[][];
    for (const r of rows) {
      if (r.length !== EMBEDDING_DIM) throw new Error(`Embedding has ${r.length} dimensions, expected ${EMBEDDING_DIM}`);
      out.push(r);
    }
  }
  return out;
}

/** pgvector text literal: '[0.1,0.2,...]' (cast with ::vector in SQL). */
export const toVectorLiteral = (v: number[]): string => `[${v.join(',')}]`;

/**
 * Long text is split into overlapping chunks of ~`size` words so that one vector never has to summarise a whole
 * document. Short text stays a single chunk.
 */
export function chunkText(text: string, size = 200, overlap = 30): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= size) return [words.join(' ')];
  const chunks: string[] = [];
  for (let start = 0; start < words.length; start += size - overlap) {
    chunks.push(words.slice(start, start + size).join(' '));
    if (start + size >= words.length) break;
  }
  return chunks;
}
