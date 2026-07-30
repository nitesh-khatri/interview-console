"use client";

import { useMemo, useState } from "react";
import { Search, Plus, Check, ChevronDown, X, Star } from "lucide-react";
import type { Question, Difficulty, QuestionType } from "@/lib/types";
import { DIFFICULTIES, QUESTION_TYPES } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DifficultyBadge, TypeBadge } from "@/components/badges";
import { FavoriteStar } from "@/components/bank/favorite-star";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Highlight } from "@/components/highlight";
import { cn } from "@/lib/utils";

/** Shared empty set, so the "nothing collapsed" case keeps a stable identity. */
const EMPTY_CATS: ReadonlySet<string> = new Set();

type BankQuestion = Question & { bank_name: string };

const DIFF_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

export function QuestionBankPanel({
  banks,
  bankQuestions,
  askedIds,
  favoriteIds = [],
  recentIds = [],
  onAsk,
  onAskAdhoc,
  readOnly,
}: {
  banks: { id: number; name: string }[];
  bankQuestions: BankQuestion[];
  askedIds: Set<number>;
  favoriteIds?: number[];
  recentIds?: number[];
  onAsk: (q: BankQuestion) => void;
  onAskAdhoc: () => void;
  readOnly: boolean;
}) {
  const [queryInput, setQueryInput] = useState("");
  const query = useDebouncedValue(queryInput, 250);
  const [activeBank, setActiveBank] = useState<number | "all">("all");
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [qtype, setQtype] = useState<QuestionType | "all">("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  // The last few questions this interviewer asked, most-recent first, that are
  // still in the bank. Rendered as a shortcut section above the categories.
  const recentQuestions = useMemo(() => {
    const byId = new Map(bankQuestions.map((q) => [q.id, q]));
    return recentIds
      .map((id) => byId.get(id))
      .filter((q): q is BankQuestion => q !== undefined)
      .slice(0, 5);
  }, [recentIds, bankQuestions]);
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  /**
   * Categories the user collapsed *while searching*, tagged with the query they
   * collapsed under. A search opens every matching category, but the user can
   * still shut one and have that stick — and because the tag is compared
   * against the live query, a new search starts fresh without an effect
   * syncing anything.
   */
  const [searchCollapse, setSearchCollapse] = useState<{
    query: string;
    cats: Set<string>;
  }>({ query: "", cats: new Set() });

  const searching = query.trim().length > 0;
  const collapsedWhileSearching =
    searchCollapse.query === query ? searchCollapse.cats : EMPTY_CATS;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bankQuestions.filter((item) => {
      if (favoritesOnly && !favorites.has(item.id)) return false;
      if (activeBank !== "all" && item.bank_id !== activeBank) return false;
      if (difficulty !== "all" && item.difficulty !== difficulty) return false;
      if (qtype !== "all" && item.qtype !== qtype) return false;
      if (q && !item.question.toLowerCase().includes(q) &&
          !item.category.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [bankQuestions, query, activeBank, difficulty, qtype, favoritesOnly, favorites]);

  const byCategory = useMemo(() => {
    const map = new Map<string, BankQuestion[]>();
    for (const item of filtered) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          (DIFF_ORDER[a.difficulty] ?? 9) - (DIFF_ORDER[b.difficulty] ?? 9)
      );
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  /** Search reveals matches; without a search the user's own choice applies. */
  function isCatOpen(cat: string) {
    return searching ? !collapsedWhileSearching.has(cat) : openCats.has(cat);
  }

  function toggleCat(cat: string) {
    if (searching) {
      setSearchCollapse((prev) => {
        const cats = new Set(prev.query === query ? prev.cats : []);
        if (cats.has(cat)) cats.delete(cat);
        else cats.add(cat);
        return { query, cats };
      });
      return;
    }
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Question Bank</h2>
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={onAskAdhoc}>
              <Plus className="h-3.5 w-3.5" />
              Ad-hoc
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Search questions…"
            className="h-9 pl-8"
            data-testid="search-input"
          />
        </div>
        {/* Compact filter row: bank + type dropdowns, difficulty segmented */}
        <div className="flex items-center gap-2">
          <Select
            value={activeBank === "all" ? "all" : String(activeBank)}
            onValueChange={(v) => setActiveBank(v === "all" ? "all" : Number(v))}
          >
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All banks</SelectItem>
              {banks.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={qtype}
            onValueChange={(v) => setQtype(v as QuestionType | "all")}
          >
            <SelectTrigger className="h-8 flex-1 text-xs capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any type</SelectItem>
              {QUESTION_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Difficulty segmented control */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 rounded-lg border p-0.5">
            {(["all", ...DIFFICULTIES] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors",
                  difficulty === d
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {d === "all" ? "Any level" : d}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            aria-pressed={favoritesOnly}
            title="Show only starred questions"
            className={cn(
              "flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors",
              favoritesOnly
                ? "border-warning bg-warning/10 text-warning"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Star className={cn("h-3.5 w-3.5", favoritesOnly && "fill-current")} />
          </button>
          {(activeBank !== "all" ||
            qtype !== "all" ||
            difficulty !== "all" ||
            favoritesOnly ||
            query) && (
            <button
              onClick={() => {
                setActiveBank("all");
                setQtype("all");
                setDifficulty("all");
                setFavoritesOnly(false);
                setQueryInput("");
              }}
              className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
              title="Clear filters"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Recently asked (ticket #18) — client-side, so empty until you ask one */}
      {!readOnly && recentQuestions.length > 0 && (
        <div
          data-testid="recent-questions"
          className="border-b px-3 py-2"
        >
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Recently asked
          </p>
          <div className="flex flex-col gap-1">
            {recentQuestions.map((item) => {
              const asked = askedIds.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={asked}
                  onClick={() => onAsk(item)}
                  className="truncate rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                  title={item.question}
                >
                  {item.question}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {byCategory.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {searching
              ? `Nothing matches “${query.trim()}”.`
              : "No questions match your filters."}
          </p>
        ) : (
          <div className="divide-y">
            {byCategory.map(([cat, items]) => {
              const open = isCatOpen(cat);
              return (
                <div key={cat}>
                  <button
                    onClick={() => toggleCat(cat)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-accent/40"
                  >
                    <span className="text-sm font-medium">{cat}</span>
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
                    <div className="space-y-1 px-2 pb-2">
                      {items.map((item) => {
                        const asked = askedIds.has(item.id);
                        const isExpanded = expanded.has(item.id);
                        return (
                          <div
                            key={item.id}
                            className="rounded-lg border bg-card/50 p-2.5"
                          >
                            <div className="flex items-start gap-2">
                              <FavoriteStar
                                questionId={item.id}
                                initialFavorite={favorites.has(item.id)}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <DifficultyBadge difficulty={item.difficulty} />
                                  <TypeBadge qtype={item.qtype} />
                                  {activeBank === "all" && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {item.bank_name}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1.5 text-sm leading-snug">
                                  <Highlight text={item.question} query={query} />
                                </p>
                                {(item.answer_hints || item.follow_ups) && (
                                  <button
                                    onClick={() =>
                                      setExpanded((prev) => {
                                        const n = new Set(prev);
                                        if (n.has(item.id)) n.delete(item.id);
                                        else n.add(item.id);
                                        return n;
                                      })
                                    }
                                    className="mt-1 text-xs text-primary hover:underline"
                                  >
                                    {isExpanded ? "Hide hints" : "Show hints"}
                                  </button>
                                )}
                                {isExpanded && (
                                  <div className="mt-1.5 space-y-1.5 rounded-md bg-muted/60 p-2 text-xs">
                                    {item.answer_hints && (
                                      <p>
                                        <span className="font-medium">Hints: </span>
                                        {item.answer_hints}
                                      </p>
                                    )}
                                    {item.follow_ups && (
                                      <FollowUps raw={item.follow_ups} />
                                    )}
                                  </div>
                                )}
                              </div>
                              {!readOnly && (
                                <Button
                                  size="sm"
                                  variant={asked ? "secondary" : "default"}
                                  disabled={asked}
                                  onClick={() => onAsk(item)}
                                  className="shrink-0"
                                >
                                  {asked ? (
                                    <>
                                      <Check className="h-3.5 w-3.5" />
                                      Added
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="h-3.5 w-3.5" />
                                      Ask
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FollowUps({ raw }: { raw: string }) {
  let items: string[] = [];
  try {
    items = JSON.parse(raw);
  } catch {
    items = [];
  }
  if (!items.length) return null;
  return (
    <div>
      <span className="font-medium">Follow-ups:</span>
      <ul className="ml-4 list-disc">
        {items.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
    </div>
  );
}

