import { describe, expect, it } from 'vitest';
import { chunkText } from '@/lib/embeddings';
import { bestSection, isFlagged, projectScore, SECTION_WEIGHTS, type SectionSimilarity } from '@/lib/embeddings/scoring';

const sims = (o: Partial<Record<keyof typeof SECTION_WEIGHTS, number>>): SectionSimilarity[] =>
  Object.entries(o).map(([section, similarity]) => ({ section: section as keyof typeof SECTION_WEIGHTS, similarity: similarity! }));

describe('project-level similarity score (spec 12.1 step 4)', () => {
  it('weights are title .15, abstract .30, problem .30, objectives .15, scope .10 and sum to 1', () => {
    expect(Object.values(SECTION_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(SECTION_WEIGHTS.abstract).toBe(0.3);
  });
  it('is the weighted mean of the section similarities', () => {
    const all = sims({ title: 1, abstract: 0.5, problem_statement: 0.5, objectives: 0, scope: 0 });
    expect(projectScore(all)).toBeCloseTo(0.15 * 1 + 0.3 * 0.5 + 0.3 * 0.5, 10);
    expect(projectScore(sims({ title: 1, abstract: 1, problem_statement: 1, objectives: 1, scope: 1 }))).toBeCloseTo(1, 10);
  });
  it('uses only the sections both proposals have (weights are renormalised)', () => {
    expect(projectScore(sims({ title: 0.8, abstract: 0.8 }))).toBeCloseTo(0.8, 10);
    expect(projectScore([])).toBe(0);
  });
  it('never leaves 0..1 even if cosine rounding overshoots', () => {
    expect(projectScore(sims({ title: 1.0000001 }))).toBe(1);
    expect(projectScore(sims({ title: -0.2 }))).toBe(0);
  });
});

describe('flagging rule: overall >= threshold OR any single section >= 0.90', () => {
  const c = { threshold: 0.8, sectionLimit: 0.9, topK: 5 };
  it('flags a high overall score', () => expect(isFlagged(0.8, sims({ title: 0.8 }), c)).toBe(true));
  it('does not flag a middling pair', () => expect(isFlagged(0.7, sims({ title: 0.7, abstract: 0.7 }), c)).toBe(false));
  it('flags one near-identical section even when the overall score is low', () => {
    const s = sims({ title: 0.2, abstract: 0.3, problem_statement: 0.95, objectives: 0.2, scope: 0.2 });
    expect(projectScore(s)).toBeLessThan(0.8);
    expect(isFlagged(projectScore(s), s, c)).toBe(true);
  });
  it('reports the best-matching section', () => expect(bestSection(sims({ title: 0.1, scope: 0.9, abstract: 0.5 }))?.section).toBe('scope'));
});

describe('chunking (~200 words, 30-word overlap)', () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
  it('keeps short text as one chunk and ignores blank text', () => {
    expect(chunkText(words(50))).toEqual([words(50)]);
    expect(chunkText('   \n ')).toEqual([]);
  });
  it('splits long text into overlapping chunks that cover every word', () => {
    const chunks = chunkText(words(450));
    expect(chunks.length).toBe(3);
    expect(chunks[0].split(' ')).toHaveLength(200);
    expect(chunks[1].split(' ')[0]).toBe('w170');                    // starts 30 words before the previous chunk ended
    expect(chunks[0].split(' ').slice(-30)).toEqual(chunks[1].split(' ').slice(0, 30));
    expect(chunks.at(-1)!.endsWith('w449')).toBe(true);
  });
});
