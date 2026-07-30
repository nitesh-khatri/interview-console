import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ComparisonCandidate } from "@/lib/pipeline";
import { StatusBadge, ScoreChip, RecommendationBadge } from "@/components/badges";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { cn } from "@/lib/utils";

/**
 * Two or three candidates side by side (ticket #17). The interesting problem is
 * aligning data across candidates who may have different rating criteria — so
 * rows are the *union* of every criterion any of them has, and a candidate
 * missing one shows a blank, never a zero.
 */
export function ComparisonView({
  candidates,
}: {
  candidates: ComparisonCandidate[];
}) {
  // Union of criteria, in first-seen order.
  const criteria: string[] = [];
  for (const c of candidates) {
    for (const param of Object.keys(c.ratings)) {
      if (!criteria.includes(param)) criteria.push(param);
    }
  }

  const bestScore = Math.max(
    ...candidates.map((c) => c.score ?? -Infinity)
  );
  const bestByCriterion = new Map<string, number>();
  for (const param of criteria) {
    bestByCriterion.set(
      param,
      Math.max(...candidates.map((c) => c.ratings[param] ?? -Infinity))
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link
        href="/candidates"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All candidates
      </Link>
      <h1 className="mb-4 text-2xl font-semibold">Compare candidates</h1>

      {/* Scrolls sideways on a phone rather than squashing the columns. */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table
          data-testid="comparison-view"
          className="w-full min-w-[32rem] text-sm"
        >
          <thead>
            <tr className="border-b">
              <th className="w-32 px-4 py-3 text-left font-medium text-muted-foreground">
                &nbsp;
              </th>
              {candidates.map((c) => (
                <th
                  key={c.id}
                  data-testid={`comparison-column-${c.id}`}
                  className="px-4 py-3 text-left align-bottom"
                >
                  <Link
                    href={`/candidates/${c.id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <CandidateAvatar name={c.name} />
                    <span className="font-medium">{c.name}</span>
                  </Link>
                  <div className="mt-1 text-xs font-normal text-muted-foreground">
                    {[c.applied_role, c.current_company]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            <Row label="Status">
              {candidates.map((c) => (
                <Cell key={c.id}>
                  <StatusBadge status={c.status} />
                </Cell>
              ))}
            </Row>
            <Row label="Overall score">
              {candidates.map((c) => (
                <Cell key={c.id} best={c.score != null && c.score === bestScore}>
                  {c.score == null ? <Blank /> : <ScoreChip score={c.score} />}
                </Cell>
              ))}
            </Row>
            <Row label="Recommendation">
              {candidates.map((c) => (
                <Cell key={c.id}>
                  {c.recommendation ? (
                    <RecommendationBadge value={c.recommendation} />
                  ) : (
                    <Blank />
                  )}
                </Cell>
              ))}
            </Row>
            {criteria.map((param) => (
              <Row key={param} label={param}>
                {candidates.map((c) => {
                  const v = c.ratings[param];
                  const isBest =
                    v != null && v === bestByCriterion.get(param) && v > -Infinity;
                  return (
                    <Cell key={c.id} best={isBest}>
                      {v == null ? <Blank /> : <ScoreChip score={v} />}
                    </Cell>
                  );
                })}
              </Row>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
        {label}
      </th>
      {children}
    </tr>
  );
}

function Cell({
  children,
  best = false,
}: {
  children: React.ReactNode;
  best?: boolean;
}) {
  return (
    <td className={cn("px-4 py-3", best && "bg-success/10")}>
      <span className="flex items-center gap-1.5">
        {children}
        {best && (
          <span
            className="text-xs font-medium text-success"
            aria-label="best in row"
            title="Best in row"
          >
            ★
          </span>
        )}
      </span>
    </td>
  );
}

function Blank() {
  return <span className="text-muted-foreground">—</span>;
}
