"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Upload,
  Download,
  Pencil,
  Trash2,
  ChevronDown,
  Library,
  Search,
} from "lucide-react";

import type { Question, QuestionBank } from "@/lib/types";
import { api } from "@/lib/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { DifficultyBadge, TypeBadge } from "@/components/badges";
import { QuestionFormDialog } from "@/components/bank/question-form-dialog";
import { ImportDialog } from "@/components/bank/import-dialog";
import { EmptyState } from "@/components/empty-state";
import { Highlight } from "@/components/highlight";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";

const DIFF_ORDER: Record<string, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

export function QuestionBankView({
  banks,
  questionsByBank,
}: {
  banks: QuestionBank[];
  questionsByBank: Record<number, Question[]>;
}) {
  const router = useRouter();

  const [activeBankId, setActiveBankId] = useState<number>(
    banks[0]?.id ?? 0
  );

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const normalizedQuery = debouncedQuery.trim();

  const [openCats, setOpenCats] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);

  const [formKey, setFormKey] = useState(0);

  const [importOpen, setImportOpen] = useState(false);

  const [deleteBank, setDeleteBank] = useState<QuestionBank | null>(null);
  const [deleteQ, setDeleteQ] = useState<Question | null>(null);

  function openForm(question: Question | null) {
    setEditing(question);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  const activeBank =
    banks.find((b) => b.id === activeBankId) ?? banks[0];

  const questions = questionsByBank[activeBankId] ?? [];

  const categories = useMemo(
    () => [...new Set(questions.map((q) => q.category))].sort(),
    [questions]
  );

  const byCategory = useMemo(() => {
    const q = normalizedQuery.toLowerCase();

    const filtered = questions.filter(
      (item) =>
        !q ||
        item.question.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );

    const map = new Map<string, Question[]>();

    for (const item of filtered) {
      if (!map.has(item.category)) {
        map.set(item.category, []);
      }

      map.get(item.category)!.push(item);
    }

    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          (DIFF_ORDER[a.difficulty] ?? 9) -
          (DIFF_ORDER[b.difficulty] ?? 9)
      );
    }

    return [...map.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    );
  }, [questions, normalizedQuery]);

  function toggleCat(cat: string) {
    setOpenCats((prev) => {
      const next = new Set(prev);

      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }

      return next;
    });
  }

  async function confirmDeleteBank() {
    if (!deleteBank) return;

    try {
      await api(`/api/question-banks/${deleteBank.id}`, {
        method: "DELETE",
      });

      toast.success("Bank deleted");

      setDeleteBank(null);

      setActiveBankId(
        banks.find((b) => b.id !== deleteBank.id)?.id ?? 0
      );

      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function confirmDeleteQuestion() {
    if (!deleteQ) return;

    try {
      await api(`/api/questions/${deleteQ.id}`, {
        method: "DELETE",
      });

      toast.success("Question deleted");

      setDeleteQ(null);

      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Question Bank</h1>

          <p className="text-sm text-muted-foreground">
            Browse and manage the questions available during interviews.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/api/question-banks/template" download>
              <Download className="h-4 w-4" />
              Template
            </a>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
        </div>
      </div>

      {banks.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {banks.map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveBankId(b.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                b.id === activeBankId
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Library className="h-3.5 w-3.5" />

              {b.name}

              <span className="rounded-full bg-muted px-1.5 text-xs">
                {(questionsByBank[b.id] ?? []).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {banks.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No question banks yet"
          description="Create a question bank or import one to start managing interview questions."
          action={
            <Button onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Import question bank
            </Button>
          }
        />
      ) : activeBank ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-medium">{activeBank.name}</h2>

              {activeBank.description && (
                <p className="text-sm text-muted-foreground">
                  {activeBank.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <a
                  href={`/api/question-banks/${activeBank.id}/export`}
                  download
                >
                  <Download className="h-4 w-4" />
                  Export
                </a>
              </Button>

              {activeBank.is_seed === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteBank(activeBank)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete bank
                </Button>
              )}

              <Button
                size="sm"
                onClick={() => openForm(null)}
              >
                <Plus className="h-4 w-4" />
                Add question
              </Button>
            </div>
          </div>

          <div className="relative mb-3 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />

            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search questions…"
              className="pl-8"
            />
          </div>

          {byCategory.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              {questions.length === 0
                ? "This bank has no questions yet. Add one or import a file."
                : "No questions match your search."}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              {byCategory.map(([cat, items], idx) => {
                const open = openCats.has(cat);

                return (
                  <div
                    key={cat}
                    className={idx > 0 ? "border-t" : ""}
                  >
                    <button
                      onClick={() => toggleCat(cat)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent/40"
                    >
                      <span className="font-medium">
                        <Highlight
                          text={cat}
                          query={normalizedQuery}
                        />
                      </span>

                      <span className="flex items-center gap-2">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {items.length}
                        </span>

                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            open && "rotate-180"
                          )}
                        />
                      </span>
                    </button>

                    {open && (
                      <div className="space-y-2 px-3 pb-3">
                        {items.map((q) => (
                          <div
                            key={q.id}
                            className="rounded-lg border bg-card/50 p-3"
                          >
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <DifficultyBadge
                                    difficulty={q.difficulty}
                                  />

                                  <TypeBadge qtype={q.qtype} />
                                </div>

                                <p className="mt-1.5 text-sm">
                                  <Highlight
                                    text={q.question}
                                    query={normalizedQuery}
                                  />
                                </p>

                                {q.answer_hints && (
                                  <p className="mt-1.5 rounded bg-muted/60 p-2 text-xs text-muted-foreground">
                                    <span className="font-medium">
                                      Hints:{" "}
                                    </span>
                                    {q.answer_hints}
                                  </p>
                                )}
                              </div>

                              <div className="flex shrink-0 gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openForm(q)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => setDeleteQ(q)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {activeBank && (
        <QuestionFormDialog
          key={formKey}
          open={formOpen}
          onOpenChange={setFormOpen}
          bankId={activeBank.id}
          question={editing}
          categories={categories}
        />
      )}

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
      />

      <AlertDialog
        open={!!deleteBank}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteBank(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete this bank?
            </AlertDialogTitle>

            <AlertDialogDescription>
              &quot;{deleteBank?.name}&quot; and all its questions will be
              permanently removed. Questions already asked in past
              interviews keep their saved copy.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction onClick={confirmDeleteBank}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteQ}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteQ(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete this question?
            </AlertDialogTitle>

            <AlertDialogDescription>
              This removes it from the bank. Interviews that already
              asked it keep their saved copy.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction onClick={confirmDeleteQuestion}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}