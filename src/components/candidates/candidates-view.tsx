"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Users,
  Link2,
  X,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { CandidateSummary } from "@/lib/pipeline";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Highlight } from "@/components/highlight";
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
import { CandidateAvatar } from "@/components/candidate-avatar";
import { RelativeTime } from "@/components/relative-time";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type Filter = "all" | "mine" | "assigned";
type SortKey = "name" | "status" | "added" | "score";
type SortDir = "asc" | "desc";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "Added by me" },
  { key: "assigned", label: "Assigned to me" },
];

const SORT_KEYS = ["name", "status", "added", "score"] as const;

/** Average of completed rounds' question averages, or null if none are done. */
export function candidateScore(c: CandidateSummary): number | null {
  const done = c.rounds.filter(
    (r) => r.status === "completed" && r.question_avg != null
  );
  if (done.length === 0) return null;
  return done.reduce((s, r) => s + (r.question_avg ?? 0), 0) / done.length;
}

const STATUS_ORDER: Record<string, number> = {
  in_process: 0,
  on_hold: 1,
  selected: 2,
  rejected: 3,
};

export function compareCandidates(
  a: CandidateSummary,
  b: CandidateSummary,
  key: SortKey,
  dir: SortDir
): number {
  const sign = dir === "asc" ? 1 : -1;

  if (key === "score") {
    const sa = candidateScore(a);
    const sb = candidateScore(b);
    // A missing score is not a zero. Unscored candidates sort last in both
    // directions, so reversing the sort never floats them to the top.
    if (sa == null && sb == null) return a.name.localeCompare(b.name);
    if (sa == null) return 1;
    if (sb == null) return -1;
    return (sa - sb) * sign || a.name.localeCompare(b.name);
  }

  if (key === "status") {
    const d = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    return d * sign || a.name.localeCompare(b.name);
  }

  if (key === "added") {
    const d = (a.created_at ?? "").localeCompare(b.created_at ?? "");
    return d * sign || a.name.localeCompare(b.name);
  }

  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) * sign;
}

/** Reads a value from the URL, falling back to the default when it's junk. */
function readParam<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  const raw = params.get(key);
  return raw && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback;
}

export function CandidatesView({
  candidates,
  currentUserId,
}: {
  candidates: CandidateSummary[];
  currentUserId: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The URL is the source of truth for everything shareable. Deriving these
  // rather than mirroring them into state avoids the two-sources-of-truth bugs
  // that come from keeping a copy in sync.
  const filter = readParam(
    searchParams,
    "filter",
    ["all", "mine", "assigned"] as const,
    "all"
  );
  const sortKey = readParam(searchParams, "sort", SORT_KEYS, "name");
  const sortDir = readParam(searchParams, "dir", ["asc", "desc"] as const, "asc");
  const urlQuery = searchParams.get("q") ?? "";
  const pageParam = Number(searchParams.get("page"));
  const requestedPage =
    Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  // The text box is local state so typing never waits on a navigation; the
  // debounced value is what reaches the URL and the filter.
  const [queryInput, setQueryInput] = useState(urlQuery);
  const query = useDebouncedValue(queryInput, 250);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [shareOpen, setShareOpen] = useState(false);

  const setParams = useCallback(
    (changes: Record<string, string | null>, { replace = false } = {}) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        // Defaults are omitted, so a clean /candidates URL stays clean.
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Typing replaces the current history entry rather than pushing one per
  // keystroke, so Back leaves the list instead of retyping the query.
  useEffect(() => {
    if (query === urlQuery) return;
    setParams({ q: query || null, page: null }, { replace: true });
  }, [query, urlQuery, setParams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter((c) => {
      if (filter === "mine" && c.created_by !== currentUserId) return false;
      if (
        filter === "assigned" &&
        !c.rounds.some((r) => r.interviewer_id === currentUserId)
      )
        return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.applied_role ?? "").toLowerCase().includes(q) ||
        (c.current_company ?? "").toLowerCase().includes(q)
      );
    });
  }, [candidates, query, filter, currentUserId]);

  const sorted = useMemo(
    // Copy before sorting: `filtered` is memoised and sort() mutates in place.
    () => [...filtered].sort((a, b) => compareCandidates(a, b, sortKey, sortDir)),
    [filtered, sortKey, sortDir]
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  // Clamped rather than trusted, so ?page=99 shows the last page of results
  // instead of an empty table.
  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * PAGE_SIZE;
  const visible = sorted.slice(start, start + PAGE_SIZE);

  // ---- selection ----
  // Selection is intersected with the current filter wherever it is *used*, so
  // the count and the share action can never disagree. Hidden selections are
  // kept — switching the filter back restores them — but never acted on
  // silently; the bar says how many are being left out.
  const selectedVisible = useMemo(
    () => sorted.filter((c) => selected.has(c.id)).map((c) => c.id),
    [sorted, selected]
  );
  const hiddenSelectedCount = selected.size - selectedVisible.length;

  const allVisibleSelected =
    sorted.length > 0 && sorted.every((c) => selected.has(c.id));
  const someVisibleSelected = selectedVisible.length > 0 && !allVisibleSelected;

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      // Checked or indeterminate both clear; only an empty box selects.
      if (allVisibleSelected || someVisibleSelected) {
        sorted.forEach((c) => next.delete(c.id));
      } else {
        sorted.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }

  function sortBy(key: SortKey) {
    const dir: SortDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";
    setParams({
      sort: key === "name" ? null : key,
      dir: dir === "asc" ? null : dir,
      page: null,
    });
  }

  function ariaSort(key: SortKey): "ascending" | "descending" | "none" {
    if (sortKey !== key) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  }

  const rangeLabel =
    sorted.length === 0
      ? "0 of 0"
      : `${start + 1}–${Math.min(start + PAGE_SIZE, sorted.length)} of ${
          sorted.length
        }`;

  function clearFilters() {
    setQueryInput("");
    setParams({ q: null, filter: null, page: null });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Candidates</h1>
          <p className="text-sm text-muted-foreground">
            {candidates.length} candidate{candidates.length === 1 ? "" : "s"} in the
            pipeline
          </p>
        </div>
        <AddCandidateDialog />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Search by name, role or company…"
            className="pl-8"
            data-testid="search-input"
            aria-label="Search candidates"
          />
        </div>
        <div
          className="flex items-center gap-1 rounded-lg border bg-card p-1"
          role="group"
          aria-label="Filter candidates"
        >
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() =>
                setParams({ filter: f.key === "all" ? null : f.key, page: null })
              }
              aria-pressed={filter === f.key}
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

      {sorted.length === 0 ? (
        candidates.length > 0 ? (
          <EmptyState
            icon={Users}
            title="No candidates match your filters"
            description="Try clearing the search or switching filters."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No candidates yet"
            description="Add your first candidate to start tracking interviews."
            action={<AddCandidateDialog trigger={<Button>Add candidate</Button>} />}
          />
        )
      ) : (
        <>
          {/* No overflow-hidden here: `Table` renders its own scroll container,
              so clipping it would make the right-hand columns unreachable. */}
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <TableRow>
                  <TableHead className="w-10 px-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                      aria-label="Select all candidates in this view"
                      data-testid="select-all"
                      checked={allVisibleSelected}
                      aria-checked={
                        someVisibleSelected ? "mixed" : allVisibleSelected
                      }
                      ref={(el) => {
                        // `indeterminate` is a DOM property with no HTML
                        // attribute, so it has to be set imperatively.
                        if (el) el.indeterminate = someVisibleSelected;
                      }}
                      onChange={toggleAllVisible}
                    />
                  </TableHead>
                  <SortableHead
                    label="Candidate"
                    testId="sort-name"
                    active={sortKey === "name"}
                    dir={sortDir}
                    ariaSort={ariaSort("name")}
                    onClick={() => sortBy("name")}
                  />
                  <TableHead className="px-4">Rounds</TableHead>
                  <SortableHead
                    label="Score"
                    testId="sort-score"
                    active={sortKey === "score"}
                    dir={sortDir}
                    ariaSort={ariaSort("score")}
                    onClick={() => sortBy("score")}
                  />
                  <SortableHead
                    label="Status"
                    testId="sort-status"
                    active={sortKey === "status"}
                    dir={sortDir}
                    ariaSort={ariaSort("status")}
                    onClick={() => sortBy("status")}
                  />
                  <SortableHead
                    label="Added"
                    testId="sort-added"
                    active={sortKey === "added"}
                    dir={sortDir}
                    ariaSort={ariaSort("added")}
                    onClick={() => sortBy("added")}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((c) => {
                  const score = candidateScore(c);
                  const isSelected = selected.has(c.id);
                  return (
                    <TableRow
                      key={c.id}
                      className={cn("group", isSelected && "bg-primary/5")}
                      data-state={isSelected ? "selected" : undefined}
                    >
                      <TableCell className="px-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                          aria-label={`Select ${c.name}`}
                          checked={isSelected}
                          onChange={() => toggle(c.id)}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Link
                          href={`/candidates/${c.id}`}
                          className="flex items-center gap-3"
                        >
                          <CandidateAvatar name={c.name} />
                          <span className="min-w-0">
                            <span className="block font-medium group-hover:underline">
                              <Highlight text={c.name} query={query} />
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              <Highlight
                                text={
                                  [c.applied_role, c.current_company]
                                    .filter(Boolean)
                                    .join(" · ") || "—"
                                }
                                query={query}
                              />
                              {c.experience_years != null &&
                                ` · ${c.experience_years} yr`}
                            </span>
                          </span>
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
                        {score == null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <ScoreChip score={score} />
                        )}
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
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" data-testid="page-info">
              {rangeLabel}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                data-testid="page-prev"
                disabled={page <= 1}
                onClick={() =>
                  setParams({ page: page - 1 <= 1 ? null : String(page - 1) })
                }
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                data-testid="page-next"
                disabled={page >= pageCount}
                onClick={() => setParams({ page: String(page + 1) })}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Floating selection action bar */}
      {selectedVisible.length > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="flex max-w-full flex-wrap items-center justify-center gap-3 rounded-2xl border bg-card px-4 py-2 shadow-lg">
            <span className="text-sm font-medium" data-testid="selection-count">
              {selectedVisible.length} selected
            </span>
            {hiddenSelectedCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {hiddenSelectedCount} more hidden by this filter — not included
              </span>
            )}
            <Button size="sm" onClick={() => setShareOpen(true)}>
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
        candidateIds={selectedVisible}
      />
    </div>
  );
}

function SortableHead({
  label,
  testId,
  active,
  dir,
  ariaSort,
  onClick,
}: {
  label: string;
  testId: string;
  active: boolean;
  dir: SortDir;
  ariaSort: "ascending" | "descending" | "none";
  onClick: () => void;
}) {
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className="px-4" aria-sort={ariaSort}>
      <button
        type="button"
        onClick={onClick}
        data-testid={testId}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium uppercase tracking-wide transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5", !active && "opacity-50")} />
      </button>
    </TableHead>
  );
}
