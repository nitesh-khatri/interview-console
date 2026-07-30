import type {
  Candidate,
  Round,
  RoundQuestion,
  RoundRating,
  QuestionBank,
  Question,
} from "@/lib/types";
import type { RoundSummary } from "@/lib/pipeline";

/**
 * Props for the interview console. It takes a lot of them, so this builds a
 * whole working round in one call and lets a test override just the bit it
 * cares about.
 */

type BankQuestion = Question & { bank_name: string };

export const candidate: Candidate = {
  id: 1,
  name: "Nadia Fernandes",
  email: "nadia@example.com",
  phone: null,
  applied_role: "Frontend Engineer",
  current_company: "Harbour Studio",
  experience_years: 4,
  status: "in_process",
  resume_path: null,
  resume_url: null,
  hr_notes: null,
  share_token: null,
  created_by: 10,
  created_at: "2026-07-01 10:00:00",
} as Candidate;

export const round: Round = {
  id: 42,
  candidate_id: 1,
  round_number: 1,
  title: "Tech Round 1",
  interviewer_id: 10,
  status: "in_progress",
  recommendation: null,
  overall_notes: null,
  created_by: 11,
  created_at: "2026-07-29 09:00:00",
  started_at: "2026-07-30 09:30:00",
  completed_at: null,
} as Round;

export function askedQuestion(over: Partial<RoundQuestion> = {}): RoundQuestion {
  return {
    id: 1,
    round_id: 42,
    question_id: 100,
    question_text: "What are data-* attributes and when would you use them?",
    category: "HTML",
    difficulty: "easy",
    qtype: "theory",
    score: null,
    notes: null,
    sort_order: 0,
    created_at: "2026-07-30 09:31:00",
    ...over,
  } as RoundQuestion;
}

export const asked: RoundQuestion[] = [
  askedQuestion({ id: 1, question_id: 100, sort_order: 0, score: 3 }),
  askedQuestion({
    id: 2,
    question_id: 101,
    question_text: "Explain the event loop.",
    category: "JavaScript",
    sort_order: 1,
    score: null,
  }),
  askedQuestion({
    id: 3,
    question_id: 102,
    question_text: "When does a component re-render?",
    category: "React",
    sort_order: 2,
    score: 4,
  }),
];

export const ratings: RoundRating[] = [
  {
    id: 1,
    round_id: 42,
    param_name: "Attitude",
    score: 4,
    note: null,
    is_custom: 0,
  },
  {
    id: 2,
    round_id: 42,
    param_name: "Problem Solving",
    score: null,
    note: null,
    is_custom: 0,
  },
];

export const banks: QuestionBank[] = [
  { id: 1, name: "Frontend", description: null, is_seed: 1, created_at: "" } as QuestionBank,
];

export const bankQuestions: BankQuestion[] = [
  {
    id: 100,
    bank_id: 1,
    bank_name: "Frontend",
    category: "HTML",
    question: "What are data-* attributes and when would you use them?",
    difficulty: "easy",
    qtype: "theory",
    answer_hints: null,
    follow_ups: null,
    created_at: "",
  } as BankQuestion,
  {
    id: 200,
    bank_id: 1,
    bank_name: "Frontend",
    category: "CSS",
    question: "How does flexbox distribute free space?",
    difficulty: "medium",
    qtype: "theory",
    answer_hints: null,
    follow_ups: null,
    created_at: "",
  } as BankQuestion,
];

export const previousRounds: RoundSummary[] = [];

/** Every console prop, with sensible defaults for an editable in-progress round. */
export function consoleProps(over: Record<string, unknown> = {}) {
  return {
    candidate,
    round,
    initialAsked: asked,
    initialRatings: ratings,
    banks,
    bankQuestions,
    favoriteIds: [],
    recentIds: [],
    previousRounds,
    readOnly: false,
    canReopen: false,
    canAdvance: true,
    interviewers: [{ id: 10, display_name: "Alex Chen" }],
    roundPresets: ["Tech Round 1", "Tech Round 2"],
    nextRoundNumber: 2,
    currentUserId: 10,
    ...over,
  };
}
