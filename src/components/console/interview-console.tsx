"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ClipboardList,
  UserRound,
  Play,
  CheckCircle2,
  Trash2,
  Plus,
  Lock,
  GripVertical,
} from "lucide-react";
import type {
  Candidate,
  Question,
  QuestionBank,
  Recommendation,
  Round,
  RoundQuestion,
  RoundRating,
  RoundStatus,
} from "@/lib/types";
import type { RoundSummary } from "@/lib/pipeline";
import { api, formatDuration, roundDurationSeconds } from "@/lib/client";
import { useDebouncedSave, combineSaveStatus } from "@/lib/use-debounced-save";
import { useResizable } from "@/lib/use-resizable";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RoundStatusBadge, DifficultyBadge, TypeBadge } from "@/components/badges";
import { ScoreButtons } from "@/components/console/score-buttons";
import { QuestionBankPanel } from "@/components/console/question-bank-panel";
import { SaveStatusIndicator } from "@/components/console/save-status";
import { ScoringPanel } from "@/components/console/scoring-panel";
import { CandidateInfoPanel } from "@/components/console/candidate-info-panel";
import { AssignRoundDialog } from "@/components/candidates/assign-round-dialog";
import { ArrowRightCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useRecentQuestions } from "@/lib/use-recent-questions";
import { TemplatesMenu } from "@/components/console/templates-menu";

type BankQuestion = Question & { bank_name: string };

/** Returns a new array with the item at `from` moved to `to`. */
function move<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Is the keystroke aimed at something the user is typing into? Global
 * shortcuts must stay out of the way of note-taking, so "just 3 things" in a
 * notes field never scores anything.
 */
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

export function InterviewConsole({
  candidate,
  round,
  initialAsked,
  initialRatings,
  banks,
  bankQuestions,
  favoriteIds = [],
  previousRounds,
  readOnly,
  canReopen,
  canAdvance,
  interviewers,
  roundPresets,
  nextRoundNumber,
  currentUserId,
}: {
  candidate: Candidate;
  round: Round;
  initialAsked: RoundQuestion[];
  initialRatings: RoundRating[];
  banks: QuestionBank[];
  bankQuestions: BankQuestion[];
  favoriteIds?: number[];
  previousRounds: RoundSummary[];
  readOnly: boolean;
  canReopen: boolean;
  canAdvance: boolean;
  interviewers: { id: number; display_name: string }[];
  roundPresets: string[];
  nextRoundNumber: number;
  currentUserId: number;
}) {
  const router = useRouter();
  const [asked, setAsked] = useState<RoundQuestion[]>(initialAsked);
  const [ratings, setRatings] = useState<RoundRating[]>(initialRatings);
  const [status, setStatus] = useState<RoundStatus>(round.status);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(
    round.recommendation
  );
  const [overallNotes, setOverallNotes] = useState(round.overall_notes ?? "");
  const [panel, setPanel] = useState<"scoring" | "info" | null>(null);
  const [adhocOpen, setAdhocOpen] = useState(false);
  const [adhocText, setAdhocText] = useState("");
  const [startedAt, setStartedAt] = useState<string | null>(round.started_at);
  // Keyboard scoring (ticket #11): which asked question the number keys target.
  const [activeIndex, setActiveIndex] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Drag-and-drop reorder (ticket #14): the row currently being dragged.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Confirmations for irreversible actions (ticket #23).
  const [confirmDelete, setConfirmDelete] = useState<RoundQuestion | null>(null);
  const [confirmComplete, setConfirmComplete] = useState(false);
  // Mobile: the question bank is hidden below md, so a bottom sheet is the only
  // way to reach it on a phone (ticket #20).
  const [mobileBankOpen, setMobileBankOpen] = useState(false);
  const { width: panelWidth, onMouseDown: onResize, dragging } = useResizable(
    "ic-console-panel-width",
    380
  );
  const { recent: recentIds, record: recordRecent } = useRecentQuestions();

  const askedIds = useMemo(
    () => new Set(asked.filter((a) => a.question_id).map((a) => a.question_id!)),
    [asked]
  );

  const scored = asked.filter((a) => a.score !== null);
  const avgScore =
    scored.length > 0
      ? (scored.reduce((s, a) => s + (a.score ?? 0), 0) / scored.length).toFixed(1)
      : null;

  // ---- persistence helpers ----
  // Each returns its promise so `flush()` can await pending saves before we
  // complete the round (which makes it read-only server-side).
  const {
    trigger: saveQuestionField,
    flush: flushQuestionFields,
    status: questionSaveStatus,
    retry: retryQuestionFields,
  } = useDebouncedSave((key, value) => {
    const rqId = Number(key.split(":")[1]);
    // Deliberately not caught here. The hook needs the rejection to report
    // "Not saved", and the indicator is a better home for that than a toast
    // that vanishes after a few seconds.
    return api(`/api/rounds/${round.id}/questions/${rqId}`, {
      method: "PATCH",
      body: JSON.stringify({ notes: value }),
    });
  });

  const {
    trigger: saveOverallNotes,
    flush: flushOverallNotes,
    status: overallSaveStatus,
    retry: retryOverallNotes,
  } = useDebouncedSave((_key, value) =>
    api(`/api/rounds/${round.id}`, {
      method: "PATCH",
      body: JSON.stringify({ overall_notes: value }),
    })
  );

  const {
    trigger: saveRatingNote,
    flush: flushRatingNotes,
    status: ratingSaveStatus,
    retry: retryRatingNotes,
  } = useDebouncedSave((key, value) => {
    const param = key.slice("rating:".length);
    return api(`/api/rounds/${round.id}/ratings`, {
      method: "PUT",
      body: JSON.stringify({ param_name: param, note: value }),
    });
  });

  // One combined answer to "is my work safe?" — three indicators for one
  // question would be worse UX and more code.
  const saveStatus = combineSaveStatus([
    questionSaveStatus,
    overallSaveStatus,
    ratingSaveStatus,
  ]);

  async function retrySaves() {
    await Promise.all([
      retryQuestionFields(),
      retryOverallNotes(),
      retryRatingNotes(),
    ]);
  }

  /** Persist any in-flight debounced edits before a status change. */
  async function flushPendingSaves() {
    await Promise.all([
      flushQuestionFields(),
      flushOverallNotes(),
      flushRatingNotes(),
    ]);
  }

  // ---- question actions ----
  const addQuestion = useCallback(
    async (q: BankQuestion) => {
      try {
        const res = await api<{ id: number; duplicate?: boolean }>(
          `/api/rounds/${round.id}/questions`,
          { method: "POST", body: JSON.stringify({ question_id: q.id }) }
        );
        if (res.duplicate) {
          // Used to return silently, so the click looked like it did nothing.
          toast.info("That question is already in this round");
          return;
        }
        recordRecent(q.id); // remember it for "recently asked" (ticket #18)
        setAsked((prev) => [
          ...prev,
          {
            id: res.id,
            round_id: round.id,
            question_id: q.id,
            question_text: q.question,
            category: q.category,
            difficulty: q.difficulty,
            qtype: q.qtype,
            score: null,
            notes: null,
            sort_order: prev.length,
            created_at: "",
          },
        ]);
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [round.id, recordRecent]
  );

  /**
   * Apply a template's questions (ticket #19): add the ones not already in the
   * round, in template order, and report how many were new. Reuses addQuestion,
   * which de-duplicates server-side too.
   */
  function applyTemplateQuestions(questionIds: number[]): number {
    const present = new Set(
      asked.filter((a) => a.question_id).map((a) => a.question_id)
    );
    const toAdd = questionIds.filter((id) => !present.has(id));
    for (const id of toAdd) {
      const q = bankQuestions.find((b) => b.id === id);
      if (q) addQuestion(q);
    }
    return toAdd.length;
  }

  async function addAdhoc() {
    const text = adhocText.trim();
    if (!text) return;
    try {
      const res = await api<{ id: number }>(
        `/api/rounds/${round.id}/questions`,
        {
          method: "POST",
          body: JSON.stringify({ question_text: text, qtype: "theory" }),
        }
      );
      setAsked((prev) => [
        ...prev,
        {
          id: res.id,
          round_id: round.id,
          question_id: null,
          question_text: text,
          category: null,
          difficulty: null,
          qtype: null,
          score: null,
          notes: null,
          sort_order: prev.length,
          created_at: "",
        },
      ]);
      setAdhocText("");
      setAdhocOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function setScore(rqId: number, score: number | null) {
    // Capture the value we are replacing so a rejected write can be undone.
    // The console's job is to show what is actually recorded about the
    // candidate; leaving a score on screen that the server refused is worse
    // than showing nothing.
    const previous = asked.find((a) => a.id === rqId)?.score ?? null;
    setAsked((prev) => prev.map((a) => (a.id === rqId ? { ...a, score } : a)));

    api(`/api/rounds/${round.id}/questions/${rqId}`, {
      method: "PATCH",
      body: JSON.stringify({ score }),
    }).catch((e) => {
      toast.error((e as Error).message);
      // Only undo if nothing else has changed this score in the meantime —
      // a rollback must not clobber a newer edit.
      setAsked((prev) =>
        prev.map((a) =>
          a.id === rqId && a.score === score ? { ...a, score: previous } : a
        )
      );
    });
  }

  function setQuestionNotes(rqId: number, notes: string) {
    setAsked((prev) =>
      prev.map((a) => (a.id === rqId ? { ...a, notes } : a))
    );
    saveQuestionField(`q:${rqId}`, notes);
  }

  async function removeQuestion(rqId: number) {
    // Remember where it was — putting a question back at the end of the list
    // when it was third is still a bug.
    const index = asked.findIndex((a) => a.id === rqId);
    const removed = asked[index];
    setAsked((prev) => prev.filter((a) => a.id !== rqId));

    api(`/api/rounds/${round.id}/questions/${rqId}`, { method: "DELETE" }).catch(
      (e) => {
        toast.error((e as Error).message);
        if (!removed) return;
        setAsked((prev) => {
          if (prev.some((a) => a.id === rqId)) return prev; // already back
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, removed);
          return next;
        });
      }
    );
  }

  /**
   * Move an asked question from one position to another, optimistically, and
   * persist the new order. Shared by drag-and-drop and the keyboard arrows so
   * the two paths can never drift apart (ticket #14).
   */
  function moveQuestion(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    const before = asked;
    if (to >= before.length) return;

    const reordered = move(before, from, to);
    setAsked(reordered);
    setActiveIndex(to);

    api(`/api/rounds/${round.id}/questions/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ ordered_ids: reordered.map((a) => a.id) }),
    }).catch((e) => {
      toast.error((e as Error).message);
      // Roll back to the order the server still has (same principle as #13).
      setAsked(before);
    });
  }

  // ---- keyboard shortcuts (ticket #11) ----
  // The handler is kept in a ref, refreshed each render by an effect, so the
  // window listener subscribes once and never goes stale — and no ref is
  // written during render.
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    onKeyRef.current = (e: KeyboardEvent) => {
      if (readOnly) return;
      // While the help dialog is up, the only shortcut is "close it".
      if (shortcutsOpen) {
        if (e.key === "Escape") setShortcutsOpen(false);
        return;
      }
      // Never hijack a keystroke meant for a text field or an open dialog.
      if (isTypingTarget(e.target) || adhocOpen) return;

      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (asked.length === 0) return;

      if (e.key === "j") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(asked.length - 1, i + 1));
      } else if (e.key === "k") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (/^[0-5]$/.test(e.key)) {
        e.preventDefault();
        const q = asked[Math.min(activeIndex, asked.length - 1)];
        if (q) setScore(q.id, e.key === "0" ? null : Number(e.key));
      }
    };
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKeyRef.current(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Clamp for rendering rather than writing state back in an effect: if a
  // deletion left `activeIndex` past the end, the highlight lands on the last
  // row instead of nowhere. The number-key handler clamps the same way.
  const clampedActiveIndex = Math.min(activeIndex, Math.max(0, asked.length - 1));

  // ---- rating actions ----
  function setRatingScore(param: string, score: number | null) {
    const previous = ratings.find((r) => r.param_name === param)?.score ?? null;
    setRatings((prev) =>
      prev.map((r) => (r.param_name === param ? { ...r, score } : r))
    );

    api(`/api/rounds/${round.id}/ratings`, {
      method: "PUT",
      body: JSON.stringify({ param_name: param, score }),
    }).catch((e) => {
      toast.error((e as Error).message);
      setRatings((prev) =>
        prev.map((r) =>
          r.param_name === param && r.score === score
            ? { ...r, score: previous }
            : r
        )
      );
    });
  }

  function setRatingNote(param: string, note: string) {
    setRatings((prev) =>
      prev.map((r) => (r.param_name === param ? { ...r, note } : r))
    );
    saveRatingNote(`rating:${param}`, note);
  }

  async function addRatingParam(name: string) {
    try {
      const res = await api<{ id: number }>(`/api/rounds/${round.id}/ratings`, {
        method: "POST",
        body: JSON.stringify({ param_name: name }),
      });
      setRatings((prev) => [
        ...prev,
        {
          id: res.id,
          round_id: round.id,
          param_name: name,
          score: null,
          note: null,
          is_custom: 1,
        },
      ]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function removeRatingParam(param: string) {
    const index = ratings.findIndex((r) => r.param_name === param);
    const removed = ratings[index];
    setRatings((prev) => prev.filter((r) => r.param_name !== param));

    api(`/api/rounds/${round.id}/ratings`, {
      method: "DELETE",
      body: JSON.stringify({ param_name: param }),
    }).catch((e) => {
      toast.error((e as Error).message);
      if (!removed) return;
      setRatings((prev) => {
        if (prev.some((r) => r.param_name === param)) return prev;
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, removed);
        return next;
      });
    });
  }

  function setRec(r: Recommendation | null) {
    setRecommendation(r);
    api(`/api/rounds/${round.id}`, {
      method: "PATCH",
      body: JSON.stringify({ recommendation: r }),
    }).catch((e) => toast.error((e as Error).message));
  }

  function changeOverallNotes(v: string) {
    setOverallNotes(v);
    saveOverallNotes("notes", v);
  }

  // ---- status actions ----
  async function startRound() {
    try {
      await api(`/api/rounds/${round.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "in_progress" }),
      });
      setStatus("in_progress");
      setStartedAt(new Date().toISOString());
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function completeRound() {
    try {
      // Persist any just-typed notes first — completing makes the round
      // read-only server-side, so a pending save would be rejected and lost.
      await flushPendingSaves();
      await api(`/api/rounds/${round.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
      });
      toast.success("Round completed");
      router.push(`/candidates/${candidate.id}`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function reopenRound() {
    try {
      await api(`/api/rounds/${round.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "in_progress" }),
      });
      setStatus("in_progress");
      toast.success("Round reopened — you can edit it again");
      // Refresh so the server re-renders the console in editable mode.
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2.5">
        <Link
          href={`/candidates/${candidate.id}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="h-5 w-px bg-border" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{candidate.name}</span>
            <RoundStatusBadge status={status} />
            {readOnly && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Read-only
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {round.title} · {candidate.applied_role ?? "—"}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {!readOnly && (
            <SaveStatusIndicator status={saveStatus} onRetry={retrySaves} />
          )}
          <RoundTimer
            status={status}
            startedAt={startedAt}
            completedAt={round.completed_at}
          />
          <div className="text-sm">
            <span className="text-muted-foreground">Avg</span>{" "}
            <span className="font-semibold tabular-nums">
              {avgScore ?? "—"}
            </span>
          </div>
          {!readOnly && status === "pending" && (
            <Button size="sm" onClick={startRound}>
              <Play className="h-4 w-4" />
              Start round
            </Button>
          )}
          {!readOnly && status === "in_progress" && (
            <Button size="sm" onClick={() => setConfirmComplete(true)}>
              <CheckCircle2 className="h-4 w-4" />
              Complete
            </Button>
          )}
          {status === "completed" && canReopen && (
            <Button size="sm" variant="outline" onClick={reopenRound}>
              <RotateCcw className="h-4 w-4" />
              Reopen
            </Button>
          )}
          {canAdvance && (
            <AssignRoundDialog
              candidateId={candidate.id}
              interviewers={interviewers}
              roundPresets={roundPresets}
              currentUserId={currentUserId}
              nextRoundNumber={nextRoundNumber}
              trigger={
                <Button size="sm" variant="outline">
                  <ArrowRightCircle className="h-4 w-4" />
                  Move to next round
                </Button>
              }
            />
          )}
        </div>
      </div>

      {/* Body: split layout */}
      <div className="flex min-h-0 flex-1">
        {/* Left: question bank (resizable) */}
        <div
          className="hidden shrink-0 border-r md:block"
          style={{ width: panelWidth }}
        >
          <QuestionBankPanel
            banks={banks.map((b) => ({ id: b.id, name: b.name }))}
            bankQuestions={bankQuestions}
            askedIds={askedIds}
            favoriteIds={favoriteIds}
            recentIds={recentIds}
            onAsk={addQuestion}
            onAskAdhoc={() => setAdhocOpen(true)}
            readOnly={readOnly}
          />
        </div>
        {/* Drag handle — thin visual line with a wide invisible hit area */}
        <div
          onMouseDown={onResize}
          className="group relative hidden w-1.5 shrink-0 cursor-col-resize md:block"
          role="separator"
          aria-orientation="vertical"
          title="Drag to resize the question panel"
        >
          <span className="absolute inset-y-0 -left-1 -right-1 z-10" />
          <span
            className={
              "absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors " +
              (dragging
                ? "bg-primary"
                : "bg-border group-hover:bg-primary/50")
            }
          />
        </div>

        {/* Center: asked questions */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Questions asked ({asked.length})
              </h2>
              {!readOnly && (
                <div className="flex items-center gap-1">
                  <TemplatesMenu
                    askedQuestionIds={asked
                      .filter((a) => a.question_id)
                      .map((a) => a.question_id!)}
                    hasAdhoc={asked.some((a) => !a.question_id)}
                    onApply={applyTemplateQuestions}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAdhocOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ad-hoc question
                  </Button>
                </div>
              )}
            </div>

            {asked.length === 0 ? (
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                {readOnly
                  ? "No questions were recorded for this round."
                  : "Add questions from the bank on the left, or an ad-hoc question, as you ask them."}
              </div>
            ) : (
              <div className="space-y-2.5">
                {asked.map((a, i) => (
                  <AskedQuestionCard
                    key={a.id}
                    index={i + 1}
                    item={a}
                    readOnly={readOnly}
                    active={!readOnly && i === clampedActiveIndex}
                    isDragging={i === dragIndex}
                    onScore={(s) => setScore(a.id, s)}
                    onNotes={(n) => setQuestionNotes(a.id, n)}
                    onRemove={() => setConfirmDelete(a)}
                    onFocusRow={() => setActiveIndex(i)}
                    onMoveUp={i > 0 ? () => moveQuestion(i, i - 1) : undefined}
                    onMoveDown={
                      i < asked.length - 1 ? () => moveQuestion(i, i + 1) : undefined
                    }
                    onDragStartRow={() => setDragIndex(i)}
                    onDragEndRow={() => setDragIndex(null)}
                    onDropRow={() => {
                      if (dragIndex !== null) moveQuestion(dragIndex, i);
                      setDragIndex(null);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right edge rail */}
        <div className="flex w-12 shrink-0 flex-col items-center gap-2 border-l bg-card py-3">
          <RailButton
            label="Scoring"
            active={panel === "scoring"}
            onClick={() => {
              setMobileBankOpen(false); // one sheet at a time
              setPanel(panel === "scoring" ? null : "scoring");
            }}
          >
            <ClipboardList className="h-5 w-5" />
          </RailButton>
          <RailButton
            label="Candidate"
            active={panel === "info"}
            onClick={() => {
              setMobileBankOpen(false);
              setPanel(panel === "info" ? null : "info");
            }}
          >
            <UserRound className="h-5 w-5" />
          </RailButton>
        </div>
      </div>

      {/* Mobile-only trigger for the question bank (ticket #20). Below md the
          split panel is display:none, so without this there is no way to add a
          question on a phone. Placed bottom-left, clear of the notes fields and
          the Complete button in the header. */}
      {!readOnly && (
        <Button
          size="sm"
          data-testid="mobile-bank-trigger"
          onClick={() => {
            setPanel(null); // one sheet at a time
            setMobileBankOpen(true);
          }}
          className="fixed bottom-4 left-4 z-30 shadow-lg md:hidden"
        >
          <Plus className="h-4 w-4" />
          Question bank
        </Button>
      )}

      {/* Mobile question-bank bottom sheet */}
      <Sheet open={mobileBankOpen} onOpenChange={setMobileBankOpen}>
        <SheetContent
          side="bottom"
          data-testid="mobile-bank-sheet"
          className="h-[80dvh] gap-0 overflow-hidden p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Question bank</SheetTitle>
          </SheetHeader>
          <div className="h-full overflow-y-auto">
            <QuestionBankPanel
              banks={banks.map((b) => ({ id: b.id, name: b.name }))}
              bankQuestions={bankQuestions}
              askedIds={askedIds}
              favoriteIds={favoriteIds}
              recentIds={recentIds}
              onAsk={(q) => {
                addQuestion(q);
                setMobileBankOpen(false); // see it land in the list
              }}
              onAskAdhoc={() => {
                setMobileBankOpen(false);
                setAdhocOpen(true);
              }}
              readOnly={readOnly}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Slide-in panels */}
      <Sheet open={panel !== null} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>
              {panel === "scoring" ? "Scoring" : "Candidate info"}
            </SheetTitle>
          </SheetHeader>
          {panel === "scoring" && (
            <ScoringPanel
              ratings={ratings}
              onSetScore={setRatingScore}
              onSetNote={setRatingNote}
              onAddParam={addRatingParam}
              onRemoveParam={removeRatingParam}
              recommendation={recommendation}
              onSetRecommendation={setRec}
              overallNotes={overallNotes}
              onNotesChange={changeOverallNotes}
              readOnly={readOnly}
            />
          )}
          {panel === "info" && (
            <CandidateInfoPanel
              candidate={candidate}
              previousRounds={previousRounds}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Ad-hoc question dialog */}
      <Dialog open={adhocOpen} onOpenChange={setAdhocOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add an ad-hoc question</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="adhoc">Question</Label>
            <Textarea
              id="adhoc"
              value={adhocText}
              onChange={(e) => setAdhocText(e.target.value)}
              rows={3}
              placeholder="Type the question you asked…"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button onClick={addAdhoc} disabled={!adhocText.trim()}>
              Add question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyboard shortcuts help (ticket #11) */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent data-testid="shortcuts-dialog">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
            {[
              ["j", "Move to the next question"],
              ["k", "Move to the previous question"],
              ["1 – 5", "Score the focused question"],
              ["0", "Clear the focused question's score"],
              ["?", "Show this help"],
              ["Esc", "Close this help"],
            ].map(([key, desc]) => (
              <div key={key} className="contents">
                <dt>
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {key}
                  </kbd>
                </dt>
                <dd className="text-muted-foreground">{desc}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>

      {/* Confirmations for irreversible actions (ticket #23) */}
      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete this question?"
        description={
          <>
            “{confirmDelete?.question_text}” and its score and notes will be
            removed from this round. This can’t be undone.
          </>
        }
        confirmLabel="Delete question"
        destructive
        onConfirm={() => {
          if (confirmDelete) removeQuestion(confirmDelete.id);
        }}
      />
      <ConfirmDialog
        open={confirmComplete}
        onOpenChange={setConfirmComplete}
        title="Complete this round?"
        description="Completing marks the round read-only. You can reopen it later, but make sure you've finished scoring first."
        confirmLabel="Complete round"
        onConfirm={completeRound}
      />
    </div>
  );
}

function AskedQuestionCard({
  index,
  item,
  readOnly,
  active,
  isDragging,
  onScore,
  onNotes,
  onRemove,
  onFocusRow,
  onMoveUp,
  onMoveDown,
  onDragStartRow,
  onDragEndRow,
  onDropRow,
}: {
  index: number;
  item: RoundQuestion;
  readOnly: boolean;
  active: boolean;
  isDragging: boolean;
  onScore: (s: number | null) => void;
  onNotes: (n: string) => void;
  onRemove: () => void;
  onFocusRow: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDragStartRow: () => void;
  onDragEndRow: () => void;
  onDropRow: () => void;
}) {
  const [notes, setNotes] = useState(item.notes ?? "");
  const ref = useRef<HTMLDivElement>(null);

  // Keep the keyboard-focused row on screen as `j`/`k` walk the list.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function onHandleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowUp" && onMoveUp) {
      e.preventDefault();
      onMoveUp();
    } else if (e.key === "ArrowDown" && onMoveDown) {
      e.preventDefault();
      onMoveDown();
    }
  }

  return (
    <div
      ref={ref}
      data-testid={`asked-question-${item.id}`}
      data-active={active ? "true" : undefined}
      onMouseDown={onFocusRow}
      onDragOver={readOnly ? undefined : (e) => e.preventDefault()}
      onDrop={
        readOnly
          ? undefined
          : (e) => {
              e.preventDefault();
              onDropRow();
            }
      }
      className={cn(
        "rounded-xl border bg-card p-3 transition-shadow",
        active && "ring-2 ring-primary",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-start gap-2">
        {!readOnly && (
          <button
            type="button"
            draggable
            onDragStart={onDragStartRow}
            onDragEnd={onDragEndRow}
            onKeyDown={onHandleKeyDown}
            data-testid={`drag-handle-${item.id}`}
            aria-label={`Reorder question ${index}. Use the arrow keys to move it.`}
            className="mt-0.5 flex h-6 w-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {item.difficulty && (
              <DifficultyBadge difficulty={item.difficulty as never} />
            )}
            {item.qtype && <TypeBadge qtype={item.qtype} />}
            {item.category && (
              <span className="text-[10px] text-muted-foreground">
                {item.category}
              </span>
            )}
            {!item.question_id && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                ad-hoc
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm">{item.question_text}</p>
        </div>
        {!readOnly && (
          <button
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Remove question ${index}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-8">
        <ScoreButtons value={item.score} onChange={onScore} disabled={readOnly} />
      </div>
      <div className="mt-2 pl-8">
        <Input
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            onNotes(e.target.value);
          }}
          placeholder="Notes on the answer…"
          className="h-8 text-sm"
          disabled={readOnly}
        />
      </div>
    </div>
  );
}

function RailButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={
        "flex h-10 w-10 items-center justify-center rounded-lg transition-colors " +
        (active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function RoundTimer({
  status,
  startedAt,
  completedAt,
}: {
  status: RoundStatus;
  startedAt: string | null;
  completedAt: string | null;
}) {
  const [now, setNow] = useState(() => new Date());

  // The interval runs *only* while the round is live. A completed round shows a
  // fixed duration, so ticking it once a second forever is pure waste.
  useEffect(() => {
    if (status !== "in_progress" || !startedAt) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [status, startedAt]);

  const seconds = roundDurationSeconds(status, startedAt, completedAt, now);
  if (seconds === null) return null;

  return (
    <span
      className="hidden font-mono text-sm tabular-nums text-muted-foreground sm:inline"
      title={status === "completed" ? "Interview duration" : "Elapsed"}
    >
      {formatDuration(seconds)}
    </span>
  );
}
