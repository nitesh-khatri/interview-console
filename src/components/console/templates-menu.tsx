"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LayoutTemplate, Save } from "lucide-react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TemplateSummary {
  id: number;
  name: string;
  question_count: number;
}

interface TemplateDetail extends TemplateSummary {
  questions: { id: number }[];
}

/**
 * Save the current question set as a reusable template, and apply a saved one
 * to the round in one click (ticket #19). The apply API is the existing
 * per-question endpoint, so applying reuses the console's own `onApply`, which
 * already de-duplicates — the point of the ticket is surfacing what happened.
 */
export function TemplatesMenu({
  askedQuestionIds,
  hasAdhoc,
  onApply,
}: {
  /** question_ids currently in the round (real bank questions only). */
  askedQuestionIds: number[];
  /** True if the round has ad-hoc questions, which templates can't capture. */
  hasAdhoc: boolean;
  /** Adds the given question ids to the round; returns how many were new. */
  onApply: (questionIds: number[]) => number;
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<TemplateDetail[] | null>(null);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (askedQuestionIds.length === 0) {
      toast.error("Add some questions before saving a template");
      return;
    }
    setSaving(true);
    try {
      await api("/api/templates", {
        method: "POST",
        body: JSON.stringify({ name: trimmed, question_ids: askedQuestionIds }),
      });
      toast.success(
        hasAdhoc
          ? "Template saved (ad-hoc questions were left out)"
          : "Template saved"
      );
      setSaveOpen(false);
      setName("");
      setTemplates(null); // force a refetch next time apply opens
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function openApply() {
    setApplyOpen(true);
    try {
      const { templates } = await api<{ templates: TemplateDetail[] }>(
        "/api/templates"
      );
      setTemplates(templates);
    } catch (e) {
      toast.error((e as Error).message);
      setTemplates([]);
    }
  }

  function apply(t: TemplateDetail) {
    const ids = t.questions.map((q) => q.id);
    const added = onApply(ids);
    const skipped = ids.length - added;
    toast.success(
      skipped > 0
        ? `Added ${added} question${added === 1 ? "" : "s"} (${skipped} already in the round)`
        : `Added ${added} question${added === 1 ? "" : "s"}`
    );
    setApplyOpen(false);
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          data-testid="apply-template-button"
          onClick={openApply}
        >
          <LayoutTemplate className="h-4 w-4" />
          Templates
        </Button>
        <Button
          size="sm"
          variant="ghost"
          data-testid="save-template-button"
          onClick={() => setSaveOpen(true)}
          title="Save the current questions as a template"
        >
          <Save className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Frontend screen — round 1"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Captures the {askedQuestionIds.length} bank question
              {askedQuestionIds.length === 1 ? "" : "s"} in this round
              {hasAdhoc ? ", excluding ad-hoc ones." : "."}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving || !name.trim()}>
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply a template</DialogTitle>
          </DialogHeader>
          {templates === null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : templates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No templates yet. Save one from a round first.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`template-${t.id}`}
                  onClick={() => apply(t)}
                  className="flex items-center justify-between rounded-lg border p-3 text-left hover:bg-accent"
                >
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.question_count} question
                    {t.question_count === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
