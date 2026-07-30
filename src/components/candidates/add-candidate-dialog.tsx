"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Upload, UserPlus, X } from "lucide-react";

export function AddCandidateDialog({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resume, setResume] = useState<File | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (resume) form.set("resume", resume);
    else form.delete("resume");
    setLoading(true);
    try {
      const { id } = await api<{ id: number }>("/api/candidates", {
        method: "POST",
        body: form,
      });
      toast.success("Candidate added");
      setOpen(false);
      setResume(null);
      router.push(`/candidates/${id}`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <UserPlus className="h-4 w-4" />
            Add candidate
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add candidate</DialogTitle>
          <DialogDescription>
            Basic details and an optional resume. You can assign interview rounds
            afterwards.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name *</Label>
            <Input id="name" name="name" required placeholder="Jane Doe" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="applied_role">Applied role</Label>
              <Input
                id="applied_role"
                name="applied_role"
                placeholder="Frontend Engineer"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="experience_years">Experience (years)</Label>
              <Input
                id="experience_years"
                name="experience_years"
                type="number"
                min="0"
                step="0.5"
                placeholder="3"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="current_company">Current company</Label>
              <Input
                id="current_company"
                name="current_company"
                placeholder="Acme Inc."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="jane@example.com"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" placeholder="+1 555 0100" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              placeholder="Source, links, context…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hr_notes">HR notes / initial impression (optional)</Label>
            <Textarea
              id="hr_notes"
              name="hr_notes"
              rows={2}
              placeholder="First impression, screening call takeaways, anything the interviewers should know…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resume_url">Resume link (URL)</Label>
            <Input
              id="resume_url"
              name="resume_url"
              type="url"
              placeholder="https://drive.google.com/…  (works in public shared reports)"
            />
            <p className="text-xs text-muted-foreground">
              A link is included in public shared reports; an uploaded file is only
              visible to signed-in users.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Or upload resume (PDF, DOC, DOCX · max 10MB)</Label>
            {resume ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2 text-sm">
                <span className="truncate">{resume.name}</span>
                <button
                  type="button"
                  onClick={() => setResume(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent/50 focus-within:ring-2 focus-within:ring-ring">
                <Upload className="h-4 w-4" />
                Choose file
                {/* sr-only, not display:none, so the input stays in the tab
                    order; focus-within rings the label so keyboard users can
                    see and reach it (ticket #21). */}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  aria-label="Resume file (PDF, DOC or DOCX)"
                  className="sr-only"
                  onChange={(e) => setResume(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Add candidate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
