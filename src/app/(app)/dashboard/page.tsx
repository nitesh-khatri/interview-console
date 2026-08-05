import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCandidateSummaries, getPipelineStats } from "@/lib/pipeline";
import { StatusBadge, ScoreChip, RoundStatusBadge } from "@/components/badges";
import { AddCandidateDialog } from "@/components/candidates/add-candidate-dialog";
import { Button } from "@/components/ui/button";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  PauseCircle,
} from "lucide-react";

export default async function DashboardPage() {
// i have change time to load
    await new Promise((resolve) => setTimeout(resolve, 2000));

    //test to error
  // throw new Error("Testing Error Boundary");

  const user = (await getCurrentUser())!;
  const stats = getPipelineStats();
  const candidates = getCandidateSummaries();

  // Group active candidates by their latest round title (or "Not started").
  const active = candidates.filter((c) => c.status === "in_process" || c.status === "on_hold");
  const groups = new Map<string, typeof candidates>();
  for (const c of active) {
    const last = c.rounds[c.rounds.length - 1];
    const key = last ? last.title : "Not started";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const statCards = [
    { label: "Total", value: stats.total, icon: Users, tone: "text-chart-1" },
    { label: "In progress", value: stats.rounds_in_progress, icon: Clock, tone: "text-chart-1" },
    { label: "Selected", value: stats.selected, icon: CheckCircle2, tone: "text-success" },
    { label: "On hold", value: stats.on_hold, icon: PauseCircle, tone: "text-warning" },
    { label: "Rejected", value: stats.rejected, icon: XCircle, tone: "text-destructive" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome back, {user.display_name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s where every candidate stands right now.
          </p>
        </div>
        <AddCandidateDialog />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{s.label}</span>
                <Icon className={`h-4 w-4 ${s.tone}`} />
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {s.value}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Active pipeline</h2>
      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">
          No active candidates. Add one to get started.
        </div>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([stage, list]) => (
            <div key={stage}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {stage}
                </h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {list.length}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((c) => {
                  const last = c.rounds[c.rounds.length - 1];
                  return (
                    <Link
                      key={c.id}
                      href={`/candidates/${c.id}`}
                      className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium group-hover:underline">
                            {c.name}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {[c.applied_role, c.current_company]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </div>
                        </div>
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        {last ? (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium">{last.title}</span>
                            {last.status === "completed" ? (
                              <ScoreChip score={last.question_avg} />
                            ) : (
                              <RoundStatusBadge status={last.status} />
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No rounds yet
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                      {last?.interviewer_name && (
                        <div className="mt-1.5 text-xs text-muted-foreground">
                          Interviewer: {last.interviewer_name}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Button asChild variant="outline">
          <Link href="/candidates">
            View all candidates
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
