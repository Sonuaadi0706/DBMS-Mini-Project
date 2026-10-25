import { query } from '@/lib/db/pg';
import type { CurrentUser } from '@/lib/auth/session';

export interface SimilarityRow {
  similarity_id: number; source_project_id: number; matched_project_id: number; similarity_score: string; matched_section: string | null;
  source_excerpt: string | null; matched_excerpt: string | null; faculty_decision: string; comments: string | null;
  decided_at: string | null; created_at: string; reviewed_by_name: string | null;
  source_title: string; source_team: string; source_status: string; matched_title: string; matched_team: string; matched_status: string;
}

/** Admin: all. Guide / reviewer: only pairs whose SOURCE proposal is allocated to them. */
export function listSimilarity(user: CurrentUser, decision: string | null): Promise<SimilarityRow[]> {
  return query<SimilarityRow>(
    `SELECT sr.similarity_id, sr.source_project_id, sr.matched_project_id, sr.similarity_score, sr.matched_section, sr.source_excerpt,
            sr.matched_excerpt, sr.faculty_decision, sr.comments, sr.decided_at, sr.created_at, ru.name AS reviewed_by_name,
            sp.title AS source_title, st.team_name AS source_team, sp.status AS source_status,
            mp.title AS matched_title, mt.team_name AS matched_team, mp.status AS matched_status
       FROM similarity_reviews sr
       JOIN projects sp ON sp.project_id = sr.source_project_id JOIN teams st ON st.team_id = sp.team_id
       JOIN projects mp ON mp.project_id = sr.matched_project_id JOIN teams mt ON mt.team_id = mp.team_id
       LEFT JOIN users ru ON ru.user_id = sr.reviewed_by
      WHERE ($1::boolean OR EXISTS (SELECT 1 FROM guide_allocations ga WHERE ga.project_id = sr.source_project_id AND ga.user_id = $2))
        AND ($3::text IS NULL OR sr.faculty_decision = $3)
      ORDER BY (sr.faculty_decision <> 'pending'), sr.similarity_score DESC, sr.similarity_id`,
    [user.roles.includes('admin'), user.userId, decision]);
}
