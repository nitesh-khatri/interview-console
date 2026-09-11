"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users, Link2, X } from "lucide-react";

import type { CandidateSummary } from "@/lib/pipeline";
import type { Role } from "@/lib/types";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, ScoreChip, RoundStatusBadge } from "@/components/badges";
import { AddCandidateDialog } from "@/components/candidates/add-candidate-dialog";
import { ShareBatchDialog } from "@/components/candidates/share-batch-dialog";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { RelativeTime } from "@/components/relative-time";

type Filter = "all" | "mine" | "assigned";

type SortKey = "name" | "status" | "added" | "score";

type SortDirection = "asc" | "desc";

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

export function candidateScore(candidate: CandidateSummary): number | null {
  const scores = candidate.rounds
    .filter(
      (round) => round.status === "completed" && round.question_avg != null,
    )
    .map((round) => round.question_avg as number);

  if (scores.length === 0) {
    return null;
  }

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function compareCandidates(
  a: CandidateSummary,
  b: CandidateSummary,
  key: SortKey,
  direction: SortDirection,
): number {
  const multiplier = direction === "asc" ? 1 : -1;

  if (key === "score") {
    const aScore = candidateScore(a);
    const bScore = candidateScore(b);

    if (aScore == null && bScore == null) {
      return 0;
    }

    if (aScore == null) {
      return 1;
    }

    if (bScore == null) {
      return -1;
    }

    return (aScore - bScore) * multiplier;
  }

  let result = 0;

  if (key === "name") {
    const aName = a.name.trim().toLowerCase();
    const bName = b.name.trim().toLowerCase();

    result = aName.localeCompare(bName);
  } else if (key === "status") {
    result = a.status.localeCompare(b.status);
  } else if (key === "added") {
    result =
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }

  return result * multiplier;
}

export function CandidatesView({
  candidates,
  currentUserId,
  role,
}: {
  candidates: CandidateSummary[];
  currentUserId: number;
  role: Role;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [shareOpen, setShareOpen] = useState(false);

  const [sort, setSort] = useState<SortState>({
    key: "name",
    direction: "asc",
  });

  const [page, setPage] = useState(1);

  const PAGE_SIZE = 10;

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function handleSort(key: SortKey) {
    setPage(1);

    setSort((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: "asc",
      };
    });
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  function handleFilterChange(nextFilter: Filter) {
    setFilter(nextFilter);
    setPage(1);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return candidates.filter((c) => {
      if (filter === "mine" && c.created_by !== currentUserId) {
        return false;
      }

      if (
        filter === "assigned" &&
        !c.rounds.some((r) => r.interviewer_id === currentUserId)
      ) {
        return false;
      }

      if (!q) {
        return true;
      }

      return (
        c.name.toLowerCase().includes(q) ||
        (c.applied_role ?? "").toLowerCase().includes(q) ||
        (c.current_company ?? "").toLowerCase().includes(q)
      );
    });
  }, [candidates, query, filter, currentUserId]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      compareCandidates(a, b, sort.key, sort.direction),
    );
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  const safePage = Math.min(page, totalPages);

  const startIndex = (safePage - 1) * PAGE_SIZE;

  const paginated = sorted.slice(startIndex, startIndex + PAGE_SIZE);

  const visibleStart = sorted.length === 0 ? 0 : startIndex + 1;

  const visibleEnd = Math.min(startIndex + PAGE_SIZE, sorted.length);

  const filters: {
    key: Filter;
    label: string;
  }[] = [
    { key: "all", label: "All" },
    { key: "mine", label: "Added by me" },
    { key: "assigned", label: "Assigned to me" },
  ];

  function sortIndicator(key: SortKey) {
  if (sort.key !== key) {
    return "↕";
  }

  return sort.direction === "asc" ? "↑" : "↓";
}
  function ariaSort(key: SortKey) {
    if (sort.key !== key) {
      return "none" as const;
    }

    return sort.direction === "asc"
      ? ("ascending" as const)
      : ("descending" as const);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Candidates</h1>

          <p className="text-sm text-muted-foreground">
            {candidates.length} candidate
            {candidates.length === 1 ? "" : "s"} in the pipeline
          </p>
        </div>

        <AddCandidateDialog />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />

          <Input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search by name, role or company…"
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => handleFilterChange(f.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.key
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            candidates.length > 0
              ? "No candidates match your filters"
              : "No candidates yet"
          }
          description={
            candidates.length > 0
              ? "Try clearing the search or switching filters."
              : "Add your first candidate to start tracking interviews."
          }
          action={
            candidates.length === 0 ? (
              <AddCandidateDialog trigger={<Button>Add candidate</Button>} />
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <TableRow>
                <TableHead className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                    aria-label="Select all"
                    checked={
                      filtered.length > 0 &&
                      filtered.every((c) => selected.has(c.id))
                    }
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev);

                        if (e.target.checked) {
                          filtered.forEach((c) => next.add(c.id));
                        } else {
                          filtered.forEach((c) => next.delete(c.id));
                        }

                        return next;
                      });
                    }}
                  />
                </TableHead>

                <TableHead
                  aria-sort={ariaSort("name")}
                  className="px-4 py-2.5 font-medium"
                >
                  <button
                    type="button"
                    data-testid="sort-name"
                    onClick={() => handleSort("name")}
                    className="inline-flex items-center gap-1"
                  >
                    Candidate
                    <span aria-hidden="true">{sortIndicator("name")}</span>
                  </button>
                </TableHead>

                <TableHead className="px-4 py-2.5 font-medium">
                  Rounds
                </TableHead>

                <TableHead
                  aria-sort={ariaSort("status")}
                  className="px-4 py-2.5 font-medium"
                >
                  <button
                    type="button"
                    data-testid="sort-status"
                    onClick={() => handleSort("status")}
                    className="inline-flex items-center gap-1"
                  >
                    Status
                    <span aria-hidden="true">{sortIndicator("status")}</span>
                  </button>
                </TableHead>

                <TableHead
                  aria-sort={ariaSort("added")}
                  className="px-4 py-2.5 font-medium"
                >
                  <button
                    type="button"
                    data-testid="sort-added"
                    onClick={() => handleSort("added")}
                    className="inline-flex items-center gap-1"
                  >
                    Added
                    <span aria-hidden="true">{sortIndicator("added")}</span>
                  </button>
                </TableHead>

                <TableHead
                  aria-sort={ariaSort("score")}
                  className="px-4 py-2.5 font-medium"
                >
                  <button
                    type="button"
                    data-testid="sort-score"
                    onClick={() => handleSort("score")}
                    className="inline-flex items-center gap-1"
                  >
                    Score
                    <span aria-hidden="true">{sortIndicator("score")}</span>
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginated.map((c) => (
                <TableRow
                  key={c.id}
                  className={cn(
                    "group hover:bg-accent/30",
                    selected.has(c.id) && "bg-primary/5",
                  )}
                >
                  <TableCell className="px-3 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                      aria-label={`Select ${c.name}`}
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                  </TableCell>

                  <TableCell className="px-4 py-3">
                    <Link
                      href={`/candidates/${c.id}`}
                      className="flex items-center gap-3"
                    >
                      <CandidateAvatar name={c.name} size="md" />

                      <div>
                        <div className="font-medium group-hover:underline">
                          {c.name}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {[c.applied_role, c.current_company]
                            .filter(Boolean)
                            .join(" · ") || "—"}

                          {c.experience_years != null &&
                            ` · ${c.experience_years} yr`}
                        </div>
                      </div>
                    </Link>
                  </TableCell>

                  <TableCell className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {c.rounds.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          No rounds yet
                        </span>
                      ) : (
                        c.rounds.map((r) => (
                          <span
                            key={r.id}
                            className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs"
                            title={`${r.title} · ${
                              r.interviewer_name ?? "Unassigned"
                            }`}
                          >
                            <span className="font-medium">
                              R{r.round_number}
                            </span>

                            {r.status === "completed" ? (
                              <ScoreChip score={r.question_avg} />
                            ) : (
                              <RoundStatusBadge status={r.status} />
                            )}
                          </span>
                        ))
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </TableCell>

                  <TableCell className="px-4 py-3 text-muted-foreground">
                    <RelativeTime value={c.created_at} />

                    {c.created_by_name && (
                      <div className="text-xs">by {c.created_by_name}</div>
                    )}
                  </TableCell>

                  <TableCell className="px-4 py-3">
                    {candidateScore(c) == null ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <ScoreChip score={candidateScore(c)} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div
            data-testid="page-info"
            className="text-sm text-muted-foreground"
          >
            {visibleStart}–{visibleEnd} of {sorted.length}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="page-prev"
              disabled={safePage === 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="page-next"
              disabled={safePage >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border bg-card px-4 py-2 shadow-lg">
            <span className="text-sm font-medium">
              {selected.size} selected
            </span>

            <Button size="sm" onClick={() => setShareOpen(true)}>
              <Link2 className="h-4 w-4" />
              Share link
            </Button>

            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <ShareBatchDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        candidateIds={filtered
          .filter((c) => selected.has(c.id))
          .map((c) => c.id)}
      />
    </div>
  );
}
