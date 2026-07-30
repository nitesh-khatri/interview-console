"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  FileText,
  Link2,
  Copy,
  Trash2,
  Plus,
  ExternalLink,
  Building2,
  Briefcase,
  Clock3,
} from "lucide-react";
import type { Candidate, CandidateStatus, Role } from "@/lib/types";
import { CANDIDATE_STATUSES } from "@/lib/types";
import type { RoundSummary } from "@/lib/pipeline";
import { api, absoluteUrl, copyToClipboard } from "@/lib/client";
import { canInterview } from "@/lib/session";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  StatusBadge,
  ScoreChip,
  RoundStatusBadge,
  RecommendationBadge,
} from "@/components/badges";
import { AssignRoundDialog } from "@/components/candidates/assign-round-dialog";
import { EditCandidateDialog } from "@/components/candidates/edit-candidate-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Round = RoundSummary & {
  overall_notes: string | null;
  completed_at: string | null;
};

export function CandidateDetail({
  candidate,
  rounds,
  interviewers,
  roundPresets,
  currentUser,
}: {
  candidate: Candidate;
  rounds: Round[];
  interviewers: { id: number; display_name: string }[];
  roundPresets: string[];
  currentUser: { id: number; role: Role };
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [status, setStatus] = useState<CandidateStatus>(candidate.status);
  const [shareToken, setShareToken] = useState<string | null>(
    candidate.share_token
  );
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const mayInterview = canInterview(currentUser.role);
  // Everyone (incl. HR) can create/assign rounds; only interviewers/admin conduct them.
  const canAssign = true;
  const nextRoundNumber = rounds.length + 1;

  async function changeStatus(next: CandidateStatus) {
    setStatus(next);
    try {
      await api(`/api/candidates/${candidate.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
      setStatus(candidate.status);
    }
  }

  async function createShare() {
    setBusy(true);
    try {
      const { share_token } = await api<{ share_token: string }>(
        `/api/candidates/${candidate.id}/share`,
        { method: "POST" }
      );
      setShareToken(share_token);
      toast.success("Share link created");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Revoking breaks a URL that may already be in someone's inbox, so it's
  // gated behind a confirmation (ticket #23). Creating a link is not.
  async function revokeShare() {
    try {
      await api(`/api/candidates/${candidate.id}/share`, { method: "DELETE" });
      setShareToken(null);
      toast.success("Share link revoked");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  // Relative on purpose: reading window.location during render makes the server
  // and client markup disagree. The absolute URL is built at click time.
  const sharePath = shareToken ? `/report/${shareToken}` : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link
        href="/candidates"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All candidates
      </Link>

      {/* Profile header */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{candidate.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {candidate.applied_role && (
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  {candidate.applied_role}
                </span>
              )}
              {candidate.current_company && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {candidate.current_company}
                </span>
              )}
              {candidate.experience_years != null && (
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {candidate.experience_years} yrs experience
                </span>
              )}
            </div>
            {(candidate.email || candidate.phone) && (
              <div className="mt-1 text-sm text-muted-foreground">
                {[candidate.email, candidate.phone].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={(v) => changeStatus(v as CandidateStatus)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CANDIDATE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {candidate.notes && (
          <p className="mt-4 rounded-lg bg-muted/50 p-3 text-sm">{candidate.notes}</p>
        )}

        {candidate.hr_notes && (
          <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-warning">
              HR notes / initial impression
            </div>
            {candidate.hr_notes}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          {candidate.resume_path && (
            <Button asChild variant="outline" size="sm">
              <a
                href={`/api/files/${candidate.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <FileText className="h-4 w-4" />
                View resume file
              </a>
            </Button>
          )}
          {candidate.resume_url && (
            <Button asChild variant="outline" size="sm">
              <a href={candidate.resume_url} target="_blank" rel="noreferrer">
                <Link2 className="h-4 w-4" />
                Resume link
              </a>
            </Button>
          )}
          {!candidate.resume_path && !candidate.resume_url && (
            <span className="text-xs text-muted-foreground">No resume added</span>
          )}
        </div>
      </div>

      {/* Share link */}
      <div className="mt-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Public report link</div>
              <div className="text-xs text-muted-foreground">
                Anyone with the link can view the interview summary (no contact
                details).
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sharePath && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const ok = await copyToClipboard(absoluteUrl(sharePath));
                    if (ok) toast.success("Link copied");
                    else toast.error("Couldn't copy — select the link and copy manually");
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={sharePath} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </a>
                </Button>
              </>
            )}
            <Button
              variant={shareToken ? "outline" : "default"}
              size="sm"
              onClick={() => (shareToken ? setConfirmRevoke(true) : createShare())}
              disabled={busy}
            >
              {shareToken ? (
                <>
                  <Trash2 className="h-4 w-4" />
                  Revoke
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" />
                  Create link
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Rounds timeline */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Interview rounds</h2>
        {canAssign && (
          <AssignRoundDialog
            candidateId={candidate.id}
            interviewers={interviewers}
            roundPresets={roundPresets}
            currentUserId={currentUser.id}
            nextRoundNumber={nextRoundNumber}
          />
        )}
      </div>

      {rounds.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed bg-card/50 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No rounds yet.{" "}
            {mayInterview
              ? "Start the first round to begin the interview."
              : "Assign this candidate to an interviewer to begin."}
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {rounds.map((r) => {
            const isMine = r.interviewer_id === currentUser.id;
            const canOpen = mayInterview || currentUser.role === "hr";
            return (
              <div key={r.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                        R{r.round_number}
                      </span>
                      <span className="font-medium">{r.title}</span>
                      <RoundStatusBadge status={r.status} />
                    </div>
                    <div className="mt-1.5 text-sm text-muted-foreground">
                      Interviewer: {r.interviewer_name ?? "Unassigned"}
                      {isMine && " (you)"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.recommendation && (
                      <RecommendationBadge value={r.recommendation} />
                    )}
                    {canOpen && (
                      <Button asChild size="sm" variant={r.status === "completed" ? "outline" : "default"}>
                        <Link href={`/candidates/${candidate.id}/rounds/${r.id}`}>
                          {r.status === "completed"
                            ? "View"
                            : isMine || currentUser.role === "admin"
                              ? "Open console"
                              : "View"}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Questions:</span>
                    <span className="font-medium">{r.question_count}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Avg score:</span>
                    <ScoreChip score={r.question_avg} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Ratings avg:</span>
                    <ScoreChip score={r.rating_avg} />
                  </div>
                </div>

                {r.overall_notes && (
                  <p className="mt-3 rounded-lg bg-muted/50 p-2.5 text-sm text-muted-foreground">
                    {r.overall_notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canAssign && rounds.length > 0 && (
        <div className="mt-4">
          <AssignRoundDialog
            candidateId={candidate.id}
            interviewers={interviewers}
            roundPresets={roundPresets}
            currentUserId={currentUser.id}
            nextRoundNumber={nextRoundNumber}
            trigger={
              <Button variant="outline">
                <Plus className="h-4 w-4" />
                Add round {nextRoundNumber}
              </Button>
            }
          />
        </div>
      )}

      <EditCandidateDialog
        candidate={candidate}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <ConfirmDialog
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        title="Revoke this share link?"
        description="Anyone who already has the link will lose access immediately, including people you've already sent it to. You can create a new link later, but it will be a different URL."
        confirmLabel="Revoke link"
        destructive
        onConfirm={revokeShare}
      />
    </div>
  );
}
