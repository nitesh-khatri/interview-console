import { Link2 } from "lucide-react";
import type { Report } from "@/lib/report";
import { fmtDate } from "@/lib/client";
import { Markdown } from "@/components/markdown";
import {
  StatusBadge,
  ScoreChip,
  RoundStatusBadge,
  RecommendationBadge,
  DifficultyBadge,
  TypeBadge,
} from "@/components/badges";

/** Presentational report card for one candidate. Server-safe (no client hooks). */
export function ReportBody({ report }: { report: Report }) {
  const { candidate, rounds, overallQuestionAvg } = report;
  return (
    <div className="rounded-xl border bg-card p-6">
      {/* Candidate header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <h2 className="text-2xl font-semibold">{candidate.name}</h2>
          <div className="mt-1 text-sm text-muted-foreground">
            {[
              candidate.applied_role,
              candidate.current_company,
              candidate.experience_years != null
                ? `${candidate.experience_years} yrs experience`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </div>
          {candidate.resume_url && (
            <a
              href={candidate.resume_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <Link2 className="h-3.5 w-3.5" />
              View resume
            </a>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={candidate.status} />
          {overallQuestionAvg != null && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">Overall avg</span>
              <ScoreChip score={overallQuestionAvg} />
            </div>
          )}
        </div>
      </div>

      {rounds.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No interview rounds recorded yet.
        </p>
      ) : (
        <div className="mt-4 space-y-8">
          {rounds.map((r) => (
            <section key={r.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    R{r.round_number}
                  </span>
                  <h3 className="text-lg font-semibold">{r.title}</h3>
                  <RoundStatusBadge status={r.status} />
                </div>
                {r.recommendation && (
                  <RecommendationBadge value={r.recommendation} />
                )}
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>Interviewer: {r.interviewer_name ?? "—"}</span>
                {r.completed_at && <span>Completed {fmtDate(r.completed_at)}</span>}
                <span className="flex items-center gap-1">
                  Question avg <ScoreChip score={r.question_avg} />
                </span>
              </div>

              {r.ratings.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  {r.ratings.map((rt) => (
                    <div
                      key={rt.id}
                      className="flex items-start gap-3 rounded-lg border bg-muted/30 p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{rt.param_name}</div>
                        {rt.note && (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {rt.note}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-lg font-semibold tabular-nums">
                        {rt.score ?? "—"}
                        <span className="text-xs text-muted-foreground">/5</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {r.questions.length > 0 && (
                <div className="space-y-2">
                  {r.questions.map((q, i) => (
                    <div key={q.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {q.difficulty && (
                              <DifficultyBadge difficulty={q.difficulty as never} />
                            )}
                            {q.qtype && <TypeBadge qtype={q.qtype} />}
                            {q.category && (
                              <span className="text-[10px] text-muted-foreground">
                                {q.category}
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 text-sm">
                            <span className="text-muted-foreground">{i + 1}. </span>
                            {q.question_text}
                          </p>
                          {q.notes && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {q.notes}
                            </p>
                          )}
                        </div>
                        <ScoreChip score={q.score} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {r.overall_notes && (
                <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
                  <span className="font-medium">Summary</span>
                  {/* Markdown, rendered safely — this is a public page. */}
                  <Markdown source={r.overall_notes} className="mt-1 space-y-2" />
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
