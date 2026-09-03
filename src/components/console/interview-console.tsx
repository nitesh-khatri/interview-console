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
import { api } from "@/lib/client";
import { useDebouncedSave } from "@/lib/use-debounced-save";
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
import {
  RoundStatusBadge,
  DifficultyBadge,
  TypeBadge,
} from "@/components/badges";
import { ScoreButtons } from "@/components/console/score-buttons";
import { QuestionBankPanel } from "@/components/console/question-bank-panel";
import { ScoringPanel } from "@/components/console/scoring-panel";
import { CandidateInfoPanel } from "@/components/console/candidate-info-panel";
import { AssignRoundDialog } from "@/components/candidates/assign-round-dialog";
import { ArrowRightCircle, RotateCcw } from "lucide-react";

type BankQuestion = Question & { bank_name: string };

export function InterviewConsole({
  candidate,
  round,
  initialAsked,
  initialRatings,
  banks,
  bankQuestions,
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
    round.recommendation,
  );
  const [overallNotes, setOverallNotes] = useState(round.overall_notes ?? "");
  const [panel, setPanel] = useState<"scoring" | "info" | null>(null);
  const [adhocOpen, setAdhocOpen] = useState(false);
  const [adhocText, setAdhocText] = useState("");
  const [startedAt, setStartedAt] = useState<string | null>(round.started_at);

  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const {
    width: panelWidth,
    onMouseDown: onResize,
    dragging,
  } = useResizable("ic-console-panel-width", 380);

  const askedIds = useMemo(
    () =>
      new Set(asked.filter((a) => a.question_id).map((a) => a.question_id!)),
    [asked],
  );

  const scored = asked.filter((a) => a.score !== null);
  const avgScore =
    scored.length > 0
      ? (
          scored.reduce((s, a) => s + (a.score ?? 0), 0) / scored.length
        ).toFixed(1)
      : null;

  const { trigger: saveQuestionField, flush: flushQuestionFields } =
    useDebouncedSave((key, value) => {
      const rqId = Number(key.split(":")[1]);
      return api(`/api/rounds/${round.id}/questions/${rqId}`, {
        method: "PATCH",
        body: JSON.stringify({ notes: value }),
      }).catch((e) => toast.error((e as Error).message));
    });

  const { trigger: saveOverallNotes, flush: flushOverallNotes } =
    useDebouncedSave((_key, value) => {
      return api(`/api/rounds/${round.id}`, {
        method: "PATCH",
        body: JSON.stringify({ overall_notes: value }),
      }).catch((e) => toast.error((e as Error).message));
    });

  const { trigger: saveRatingNote, flush: flushRatingNotes } = useDebouncedSave(
    (key, value) => {
      const param = key.slice("rating:".length);
      return api(`/api/rounds/${round.id}/ratings`, {
        method: "PUT",
        body: JSON.stringify({ param_name: param, note: value }),
      }).catch((e) => toast.error((e as Error).message));
    },
  );

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
          { method: "POST", body: JSON.stringify({ question_id: q.id }) },
        );
        if (res.duplicate) return;
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
    [round.id],
  );

  async function addAdhoc() {
    const text = adhocText.trim();
    if (!text) return;
    try {
      const res = await api<{ id: number }>(
        `/api/rounds/${round.id}/questions`,
        {
          method: "POST",
          body: JSON.stringify({ question_text: text, qtype: "theory" }),
        },
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

  const setScore = useCallback(
  (rqId: number, score: number | null) => {
    setAsked((prev) =>
      prev.map((a) => (a.id === rqId ? { ...a, score } : a)),
    );

    api(`/api/rounds/${round.id}/questions/${rqId}`, {
      method: "PATCH",
      body: JSON.stringify({ score }),
    }).catch((e) => toast.error((e as Error).message));
  },
  [round.id],
);

  useEffect(() => {
    if (readOnly) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      // Don't trigger shortcuts while typing in input/textarea
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      // J = next question
      if (event.key.toLowerCase() === "j") {
        setActiveQuestionIndex((current) =>
          Math.min(current + 1, asked.length - 1),
        );
        return;
      }

      // K = previous question
      if (event.key.toLowerCase() === "k") {
        setActiveQuestionIndex((current) => Math.max(current - 1, 0));
        return;
      }

      // ? = open shortcuts help
      if (event.key === "?") {
        setShortcutsOpen(true);
        return;
      }

      // Escape = close shortcuts help
      if (event.key === "Escape") {
        setShortcutsOpen(false);
        return;
      }

      // Score shortcuts: 0-5
      if (/^[0-5]$/.test(event.key)) {
        const activeQuestion = asked[activeQuestionIndex];

        if (!activeQuestion) return;

        const score = event.key === "0" ? null : Number(event.key);

        setScore(activeQuestion.id, score);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [asked, activeQuestionIndex, readOnly, setScore]);

  function setQuestionNotes(rqId: number, notes: string) {
    setAsked((prev) => prev.map((a) => (a.id === rqId ? { ...a, notes } : a)));
    saveQuestionField(`q:${rqId}`, notes);
  }

  async function removeQuestion(rqId: number) {
  setAsked((prev) => {
    const updated = prev.filter((a) => a.id !== rqId);

    setActiveQuestionIndex((current) =>
      Math.max(0, Math.min(current, updated.length - 1))
    );

    return updated;
  });

  api(`/api/rounds/${round.id}/questions/${rqId}`, {
    method: "DELETE",
  }).catch((e) => toast.error((e as Error).message));
}

  // ---- rating actions ----
  function setRatingScore(param: string, score: number | null) {
    setRatings((prev) =>
      prev.map((r) => (r.param_name === param ? { ...r, score } : r)),
    );
    api(`/api/rounds/${round.id}/ratings`, {
      method: "PUT",
      body: JSON.stringify({ param_name: param, score }),
    }).catch((e) => toast.error((e as Error).message));
  }

  function setRatingNote(param: string, note: string) {
    setRatings((prev) =>
      prev.map((r) => (r.param_name === param ? { ...r, note } : r)),
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
    setRatings((prev) => prev.filter((r) => r.param_name !== param));
    api(`/api/rounds/${round.id}/ratings`, {
      method: "DELETE",
      body: JSON.stringify({ param_name: param }),
    }).catch((e) => toast.error((e as Error).message));
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
          <RoundTimer status={status} startedAt={startedAt} />
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
            <Button size="sm" onClick={completeRound}>
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
              (dragging ? "bg-primary" : "bg-border group-hover:bg-primary/50")
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAdhocOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ad-hoc question
                </Button>
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
                    active={!readOnly && i === activeQuestionIndex}
                    onScore={(s) => setScore(a.id, s)}
                    onNotes={(n) => setQuestionNotes(a.id, n)}
                    onRemove={() => removeQuestion(a.id)}
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
            onClick={() => setPanel(panel === "scoring" ? null : "scoring")}
          >
            <ClipboardList className="h-5 w-5" />
          </RailButton>
          <RailButton
            label="Candidate"
            active={panel === "info"}
            onClick={() => setPanel(panel === "info" ? null : "info")}
          >
            <UserRound className="h-5 w-5" />
          </RailButton>
        </div>
      </div>

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
            
            {/* Keyboard shortcuts help */}
      <Dialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      >
        <DialogContent data-testid="shortcuts-dialog">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Next question</span>
              <kbd className="rounded border bg-muted px-2 py-1">J</kbd>
            </div>

            <div className="flex justify-between">
              <span>Previous question</span>
              <kbd className="rounded border bg-muted px-2 py-1">K</kbd>
            </div>

            <div className="flex justify-between">
              <span>Score question</span>
              <kbd className="rounded border bg-muted px-2 py-1">1–5</kbd>
            </div>

            <div className="flex justify-between">
              <span>Clear score</span>
              <kbd className="rounded border bg-muted px-2 py-1">0</kbd>
            </div>

            <div className="flex justify-between">
              <span>Show shortcuts</span>
              <kbd className="rounded border bg-muted px-2 py-1">?</kbd>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AskedQuestionCard({
  index,
  item,
  readOnly,
   active,
  onScore,
  onNotes,
  onRemove,
}: {
  index: number;
  item: RoundQuestion;
  readOnly: boolean;
  active: boolean;
  onScore: (s: number | null) => void;
  onNotes: (n: string) => void;
  onRemove: () => void;
}) {
  const [notes, setNotes] = useState(item.notes ?? "");
  return (
    <div 
     data-testid={`asked-question-${item.id}`}
    data-active={active ? "true" : undefined}
    className={
      "rounded-xl border bg-card p-3 transition-colors " +
      (active ? "ring-2 ring-primary/40" : "")
    }>
      <div className="flex items-start gap-2">
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
            aria-label="Remove question"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-8">
        <ScoreButtons
          value={item.score}
          onChange={onScore}
          disabled={readOnly}
        />
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
}: {
  status: RoundStatus;
  startedAt: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status === "in_progress" && startedAt) {
      intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [status, startedAt]);

  if (!startedAt || status === "pending") return null;

  const start = new Date(
    startedAt.includes("T") ? startedAt : startedAt.replace(" ", "T") + "Z",
  ).getTime();
  const secs = Math.max(0, Math.floor((now - start) / 1000));
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return (
    <span className="hidden font-mono text-sm tabular-nums text-muted-foreground sm:inline">
      {mm}:{ss}
    </span>
  );
}
