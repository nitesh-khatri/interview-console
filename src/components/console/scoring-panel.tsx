"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { RoundRating, Recommendation } from "@/lib/types";
import { RECOMMENDATIONS } from "@/lib/types";
import { ScoreButtons } from "@/components/console/score-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ScoringPanel({
  ratings,
  onSetScore,
  onSetNote,
  onAddParam,
  onRemoveParam,
  recommendation,
  onSetRecommendation,
  overallNotes,
  onNotesChange,
  readOnly,
}: {
  ratings: RoundRating[];
  onSetScore: (param: string, score: number | null) => void;
  onSetNote: (param: string, note: string) => void;
  onAddParam: (name: string) => void;
  onRemoveParam: (param: string) => void;
  recommendation: Recommendation | null;
  onSetRecommendation: (r: Recommendation | null) => void;
  overallNotes: string;
  onNotesChange: (v: string) => void;
  readOnly: boolean;
}) {
  const [newParam, setNewParam] = useState("");

  const avg = (() => {
    const scored = ratings.filter((r) => r.score !== null);
    if (!scored.length) return null;
    return (
      scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length
    ).toFixed(1);
  })();

  return (
    <div className="space-y-6 p-4">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Quick-look scoring</h3>
          {avg && (
            <span className="text-sm text-muted-foreground">
              Avg <span className="font-semibold text-foreground">{avg}</span>
            </span>
          )}
        </div>
        <div className="space-y-3">
          {ratings.map((r) => (
            <RatingRow
              key={r.id}
              rating={r}
              readOnly={readOnly}
              onSetScore={onSetScore}
              onSetNote={onSetNote}
              onRemoveParam={onRemoveParam}
            />
          ))}
        </div>

        {!readOnly && (
          <div className="mt-3 flex items-center gap-2">
            <Input
              value={newParam}
              onChange={(e) => setNewParam(e.target.value)}
              placeholder="Add parameter…"
              className="h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newParam.trim()) {
                  onAddParam(newParam.trim());
                  setNewParam("");
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!newParam.trim()}
              onClick={() => {
                onAddParam(newParam.trim());
                setNewParam("");
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Recommendation</h3>
        <div className="grid grid-cols-2 gap-2">
          {RECOMMENDATIONS.map((r) => {
            const active = recommendation === r.value;
            const positive = r.value === "strong_yes" || r.value === "yes";
            return (
              <button
                key={r.value}
                disabled={readOnly}
                onClick={() =>
                  onSetRecommendation(active ? null : r.value)
                }
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60",
                  active
                    ? positive
                      ? "border-success bg-success/15 text-success"
                      : "border-destructive bg-destructive/15 text-destructive"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Overall notes</h3>
        <Textarea
          value={overallNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Summary, strengths, concerns…"
          rows={5}
          disabled={readOnly}
        />
      </div>
    </div>
  );
}

function RatingRow({
  rating,
  readOnly,
  onSetScore,
  onSetNote,
  onRemoveParam,
}: {
  rating: RoundRating;
  readOnly: boolean;
  onSetScore: (param: string, score: number | null) => void;
  onSetNote: (param: string, note: string) => void;
  onRemoveParam: (param: string) => void;
}) {
  // The caller keys this component by `rating.id`, so a different rating
  // remounts it and this initializer runs again. No sync effect needed.
  const [note, setNote] = useState(rating.note ?? "");

  return (
    <div className="space-y-1.5 rounded-lg border p-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{rating.param_name}</Label>
        {rating.is_custom === 1 && !readOnly && (
          <button
            onClick={() => onRemoveParam(rating.param_name)}
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${rating.param_name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <ScoreButtons
        value={rating.score}
        onChange={(s) => onSetScore(rating.param_name, s)}
        disabled={readOnly}
        size="sm"
      />
      <Input
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          onSetNote(rating.param_name, e.target.value);
        }}
        placeholder="Why this score? (optional)"
        className="h-8 text-sm"
        disabled={readOnly}
      />
    </div>
  );
}
