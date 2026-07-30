import { getDb } from "./db";
import type { CandidateStatus, Recommendation, RoundStatus } from "./types";

export interface RoundSummary {
  id: number;
  round_number: number;
  title: string;
  status: RoundStatus;
  interviewer_id: number | null;
  interviewer_name: string | null;
  recommendation: Recommendation | null;
  question_avg: number | null;
  question_count: number;
  rating_avg: number | null;
}

export interface CandidateSummary {
  id: number;
  name: string;
  applied_role: string | null;
  current_company: string | null;
  experience_years: number | null;
  status: CandidateStatus;
  has_resume: number;
  share_token: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  rounds: RoundSummary[];
}

/** All candidates with their rounds + aggregates, for dashboard and list views. */
export function getCandidateSummaries(): CandidateSummary[] {
  const db = getDb();
  const candidates = db
    .prepare(
      `SELECT c.id, c.name, c.applied_role, c.current_company, c.experience_years,
              c.status, c.share_token, c.created_by, c.created_at,
              (c.resume_path IS NOT NULL) AS has_resume,
              u.display_name AS created_by_name
       FROM candidates c
       LEFT JOIN users u ON u.id = c.created_by
       ORDER BY c.created_at DESC`
    )
    .all() as Omit<CandidateSummary, "rounds">[];

  const roundStmt = db.prepare(
    `SELECT r.id, r.candidate_id, r.round_number, r.title, r.status,
            r.interviewer_id, r.recommendation,
            iv.display_name AS interviewer_name,
            (SELECT AVG(score) FROM round_questions WHERE round_id = r.id AND score IS NOT NULL) AS question_avg,
            (SELECT COUNT(*) FROM round_questions WHERE round_id = r.id) AS question_count,
            (SELECT AVG(score) FROM round_ratings WHERE round_id = r.id AND score IS NOT NULL) AS rating_avg
     FROM rounds r
     LEFT JOIN users iv ON iv.id = r.interviewer_id
     WHERE r.candidate_id = ?
     ORDER BY r.round_number ASC, r.created_at ASC`
  );

  return candidates.map((c) => ({
    ...c,
    rounds: roundStmt.all(c.id) as RoundSummary[],
  }));
}

export interface PipelineStats {
  total: number;
  selected: number;
  rejected: number;
  in_process: number;
  on_hold: number;
  rounds_in_progress: number;
  rounds_pending: number;
}

export function getPipelineStats(): PipelineStats {
  const db = getDb();
  const c = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'selected') AS selected,
         SUM(status = 'rejected') AS rejected,
         SUM(status = 'in_process') AS in_process,
         SUM(status = 'on_hold') AS on_hold
       FROM candidates`
    )
    .get() as Record<string, number | null>;
  const r = db
    .prepare(
      `SELECT
         SUM(status = 'in_progress') AS rounds_in_progress,
         SUM(status = 'pending') AS rounds_pending
       FROM rounds`
    )
    .get() as Record<string, number | null>;
  return {
    total: c.total ?? 0,
    selected: c.selected ?? 0,
    rejected: c.rejected ?? 0,
    in_process: c.in_process ?? 0,
    on_hold: c.on_hold ?? 0,
    rounds_in_progress: r.rounds_in_progress ?? 0,
    rounds_pending: r.rounds_pending ?? 0,
  };
}

export interface ComparisonCandidate {
  id: number;
  name: string;
  applied_role: string | null;
  current_company: string | null;
  status: CandidateStatus;
  /** Average of completed rounds' question averages, or null. */
  score: number | null;
  /** The most recent completed round's recommendation. */
  recommendation: Recommendation | null;
  /** Average score per rating criterion, across the candidate's rounds. */
  ratings: Record<string, number>;
}

/**
 * Side-by-side comparison data for 2–3 candidates (ticket #17). One pass per
 * concern rather than per candidate, so it stays a handful of queries.
 */
export function getComparison(ids: number[]): ComparisonCandidate[] {
  const db = getDb();
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");

  const candidates = db
    .prepare(
      `SELECT id, name, applied_role, current_company, status
       FROM candidates WHERE id IN (${placeholders})`
    )
    .all(...ids) as Array<{
    id: number;
    name: string;
    applied_role: string | null;
    current_company: string | null;
    status: CandidateStatus;
  }>;

  const summaries = getCandidateSummaries();
  const byId = new Map(summaries.map((c) => [c.id, c]));

  const ratingRows = db
    .prepare(
      `SELECT r.candidate_id AS cid, rr.param_name AS param, AVG(rr.score) AS avg
       FROM round_ratings rr JOIN rounds r ON r.id = rr.round_id
       WHERE r.candidate_id IN (${placeholders}) AND rr.score IS NOT NULL
       GROUP BY r.candidate_id, rr.param_name`
    )
    .all(...ids) as Array<{ cid: number; param: string; avg: number }>;

  const ratingsByCandidate = new Map<number, Record<string, number>>();
  for (const row of ratingRows) {
    const map = ratingsByCandidate.get(row.cid) ?? {};
    map[row.param] = Math.round(row.avg * 10) / 10;
    ratingsByCandidate.set(row.cid, map);
  }

  // Preserve the order the ids were requested in.
  return ids
    .map((id) => candidates.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => c !== undefined)
    .map((c) => {
      const summary = byId.get(c.id);
      const completed =
        summary?.rounds.filter(
          (r) => r.status === "completed" && r.question_avg != null
        ) ?? [];
      const score =
        completed.length > 0
          ? Math.round(
              (completed.reduce((s, r) => s + (r.question_avg ?? 0), 0) /
                completed.length) *
                10
            ) / 10
          : null;
      const recommendation = completed.at(-1)?.recommendation ?? null;
      return {
        id: c.id,
        name: c.name,
        applied_role: c.applied_role,
        current_company: c.current_company,
        status: c.status,
        score,
        recommendation,
        ratings: ratingsByCandidate.get(c.id) ?? {},
      };
    });
}
