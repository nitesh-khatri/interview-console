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
import {
  StatusBadge,
  ScoreChip,
  RoundStatusBadge,
} from "@/components/badges";
import { AddCandidateDialog } from "@/components/candidates/add-candidate-dialog";
import { ShareBatchDialog } from "@/components/candidates/share-batch-dialog";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { RelativeTime } from "@/components/relative-time";

type Filter = "all" | "mine" | "assigned";

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

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "mine", label: "Added by me" },
    { key: "assigned", label: "Assigned to me" },
  ];

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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, role or company…"
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.key
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
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
              <AddCandidateDialog
                trigger={<Button>Add candidate</Button>}
              />
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

                <TableHead className="px-4 py-2.5 font-medium">
                  Candidate
                </TableHead>

                <TableHead className="px-4 py-2.5 font-medium">
                  Rounds
                </TableHead>

                <TableHead className="px-4 py-2.5 font-medium">
                  Status
                </TableHead>

                <TableHead className="px-4 py-2.5 font-medium">
                  Added
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className={cn(
                    "group hover:bg-accent/30",
                    selected.has(c.id) && "bg-primary/5"
                  )}
                >
                  {/* Checkbox */}
                  <TableCell className="px-3 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                      aria-label={`Select ${c.name}`}
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                  </TableCell>

                  {/* Candidate Name + Avatar */}
                  <TableCell className="px-4 py-3">
                    <Link
                      href={`/candidates/${c.id}`}
                      className="flex items-center gap-3"
                    >
                      <CandidateAvatar
                        name={c.name}
                        size="md"
                      />

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

                  {/* Interview Rounds */}
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

                  {/* Status */}
                  <TableCell className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </TableCell>

                  {/* Created Date */}
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    <RelativeTime value={c.created_at} />

                    {c.created_by_name && (
                      <div className="text-xs">
                        by {c.created_by_name}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Floating selection action bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border bg-card px-4 py-2 shadow-lg">
            <span className="text-sm font-medium">
              {selected.size} selected
            </span>

            <Button
              size="sm"
              onClick={() => setShareOpen(true)}
            >
              <Link2 className="h-4 w-4" />
              Share link
            </Button>

            <button
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