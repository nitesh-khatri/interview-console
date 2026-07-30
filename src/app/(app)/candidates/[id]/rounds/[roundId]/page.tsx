import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getCandidate,
  getRound,
  getRoundQuestions,
  getRoundRatings,
  listAssignableUsers,
} from "@/lib/queries";
import { getDb, getSettingJson } from "@/lib/db";
import {
  listBanks,
  listAllActiveQuestions,
  listFavoriteQuestionIds,
} from "@/lib/queries";
import { DEFAULT_ROUND_PRESETS } from "@/lib/types";
import { InterviewConsole } from "@/components/console/interview-console";
import type { RoundSummary } from "@/lib/pipeline";

export default async function RoundConsolePage({
  params,
}: {
  params: Promise<{ id: string; roundId: string }>;
}) {
  const user = (await getCurrentUser())!;
  const { id, roundId } = await params;
  const candidate = getCandidate(Number(id));
  const round = getRound(Number(roundId));
  if (!candidate || !round || round.candidate_id !== candidate.id) notFound();

  const askedQuestions = getRoundQuestions(round.id);
  const ratings = getRoundRatings(round.id);
  const banks = listBanks();
  const bankQuestions = listAllActiveQuestions();
  const favoriteIds = listFavoriteQuestionIds(user.id);

  // Previous rounds (for the candidate info panel).
  const previousRounds = getDb()
    .prepare(
      `SELECT r.id, r.round_number, r.title, r.status, r.interviewer_id, r.recommendation,
              iv.display_name AS interviewer_name,
              (SELECT AVG(score) FROM round_questions WHERE round_id = r.id AND score IS NOT NULL) AS question_avg,
              (SELECT COUNT(*) FROM round_questions WHERE round_id = r.id) AS question_count,
              (SELECT AVG(score) FROM round_ratings WHERE round_id = r.id AND score IS NOT NULL) AS rating_avg
       FROM rounds r LEFT JOIN users iv ON iv.id = r.interviewer_id
       WHERE r.candidate_id = ? AND r.id != ?
       ORDER BY r.round_number ASC`
    )
    .all(candidate.id, round.id) as RoundSummary[];

  // Read-only unless admin, or the assigned interviewer on an unfinished round.
  const readOnly =
    round.status === "completed" ||
    user.role === "hr" ||
    (user.role === "interviewer" && round.interviewer_id !== user.id);

  // Anyone who conducted this round (or a manager) can advance the candidate.
  const canAdvance =
    user.role === "admin" ||
    user.role === "hr" ||
    round.interviewer_id === user.id ||
    round.created_by === user.id;

  // A completed round can be reopened by the assigned interviewer or an admin
  // (e.g. "Complete" was clicked by accident).
  const canReopen =
    round.status === "completed" &&
    (user.role === "admin" || round.interviewer_id === user.id);

  const nextRoundNumber =
    (getDb()
      .prepare("SELECT MAX(round_number) AS n FROM rounds WHERE candidate_id = ?")
      .get(candidate.id) as { n: number | null }).n! + 1;

  const interviewers = listAssignableUsers().map((u) => ({
    id: u.id,
    display_name: u.display_name,
  }));
  const roundPresets = getSettingJson<string[]>(
    "round_presets",
    DEFAULT_ROUND_PRESETS
  );

  return (
    <InterviewConsole
      candidate={candidate}
      round={round}
      initialAsked={askedQuestions}
      initialRatings={ratings}
      banks={banks}
      bankQuestions={bankQuestions}
      favoriteIds={favoriteIds}
      previousRounds={previousRounds}
      readOnly={readOnly}
      canReopen={canReopen}
      canAdvance={canAdvance}
      interviewers={interviewers}
      roundPresets={roundPresets}
      nextRoundNumber={nextRoundNumber}
      currentUserId={user.id}
    />
  );
}
