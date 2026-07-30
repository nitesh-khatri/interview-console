import type { CandidateSummary, RoundSummary } from "@/lib/pipeline";

/**
 * Builders for candidate fixtures. Every name here is invented — never put real
 * candidate data in a test.
 */

export function makeRound(over: Partial<RoundSummary> = {}): RoundSummary {
  return {
    id: 1,
    round_number: 1,
    title: "Tech Round 1",
    status: "completed",
    interviewer_id: 10,
    interviewer_name: "Alex Chen",
    recommendation: "yes",
    question_avg: 3,
    question_count: 4,
    rating_avg: 3,
    ...over,
  };
}

export function makeCandidate(over: Partial<CandidateSummary> = {}): CandidateSummary {
  return {
    id: 1,
    name: "Nadia Fernandes",
    applied_role: "Frontend Engineer",
    current_company: "Harbour Studio",
    experience_years: 4,
    status: "in_process",
    has_resume: 0,
    share_token: null,
    created_by: 10,
    created_by_name: "Priya Raman",
    created_at: "2026-07-01 10:00:00",
    rounds: [],
    ...over,
  };
}

/**
 * 12 candidates — enough to page (page size is 10) and to make sorting
 * meaningful. Scores, statuses and owners vary on purpose.
 */
export function manyCandidates(): CandidateSummary[] {
  const rows: Array<[string, string, number | null, CandidateSummary["status"], number]> = [
    ["Zara Whitfield", "Frontend Engineer", 4.5, "in_process", 10],
    ["alex chen", "UI Engineer", 2.0, "rejected", 11],
    ["Mei Lin Zhao", "Senior Frontend Engineer", 3.5, "in_process", 10],
    ["Tomás Delgado", "Frontend Engineer", null, "in_process", 11],
    ["Béatrice Morel", "Full Stack Engineer", 4.0, "selected", 10],
    ["Grace Mwangi", "Frontend Engineer", 3.0, "on_hold", 11],
    ["Hana Kobayashi", "UI Engineer", 2.5, "in_process", 10],
    ["Marcus Webb", "Frontend Engineer", null, "in_process", 11],
    ["Priya Raman", "React Developer", 5.0, "selected", 10],
    ["Sam Okafor", "Frontend Engineer", 1.5, "rejected", 11],
    ["Liam O'Sullivan", "UI Engineer", 3.8, "on_hold", 10],
    ["Ana Sofía Rojas", "Frontend Engineer", 4.2, "in_process", 11],
  ];

  return rows.map(([name, role, score, status, createdBy], i) =>
    makeCandidate({
      id: i + 1,
      name,
      applied_role: role,
      current_company: `Company ${i + 1}`,
      status,
      created_by: createdBy,
      // Ascending dates, so "Added" sorting has a stable expected order.
      created_at: `2026-07-${String(i + 1).padStart(2, "0")} 09:00:00`,
      rounds:
        score == null
          ? [
              makeRound({
                id: 100 + i,
                status: "pending",
                question_avg: null,
                // Interviewer varies so "Assigned to me" genuinely hides some
                // candidates — without that, filter tests pass by accident.
                interviewer_id: createdBy,
              }),
            ]
          : [
              makeRound({
                id: 100 + i,
                status: "completed",
                question_avg: score,
                interviewer_id: createdBy,
              }),
            ],
    })
  );
}
