# Your roadmap

Welcome. This is a real internal tool, and you'll be shipping real improvements to
it — every ticket comes from an actual gap or bug in the code, not a made-up
exercise. This page tells you **what to pick and in what order**. For the
mechanical loop (branch → un-skip test → PR), read [CONTRIBUTING.md](../CONTRIBUTING.md).

New here? Do these three things first:

1. Get the app running — [SETUP.md](../SETUP.md) (Windows-first).
2. Load the demo data — `npm run seed:demo` — and sign in. Ask for the
   `demo-credentials.txt` file; it isn't in the repo.
3. Read [docs/ARCHITECTURE.md](./ARCHITECTURE.md) — 10 minutes that will save you
   hours. Especially the note that this Next.js version differs from most tutorials.

---

## How to pick

**Always take the top unstarted issue of the lowest-numbered milestone.** The
milestones are ordered so each one builds on skills from the last, and the issues
inside a milestone are ordered too. You don't have to choose — the order is the
choice. On the
[project board](https://github.com/nitesh-khatri/interview-console/projects) the
top of the **Todo** column is always the right next pick.

Do **not** jump ahead to a `hard` ticket in a later milestone to start. They lean
on things you'll build earlier — #17 builds on the selection fix from #9, #22
reuses the "am I typing in a field?" logic from #11, and so on. The order is not
arbitrary.

Every ticket is labelled with a difficulty:

- **easy** — half a day. A focused change in one or two files.
- **medium** — one to two days.
- **hard** — two-plus days, usually a new feature with a few moving parts.

---

## The five milestones

### Week 1 — [M1: Foundations](https://github.com/nitesh-khatri/interview-console/milestone/1)
*Goal: learn the codebase by shipping small, visible wins, and meet the shadcn
primitives that are installed but unused.*

| # | Ticket | Level | What you'll learn |
|---|--------|-------|-------------------|
| [#1](https://github.com/nitesh-khatri/interview-console/issues/1) | Loading skeletons & error boundary | easy | How the App Router renders `loading.tsx` / `error.tsx` |
| [#2](https://github.com/nitesh-khatri/interview-console/issues/2) | Candidate avatars | easy | Pure functions, deterministic colour, theme tokens |
| [#3](https://github.com/nitesh-khatri/interview-console/issues/3) | Relative timestamps | easy | A testable pure formatter + the Tooltip primitive |
| [#4](https://github.com/nitesh-khatri/interview-console/issues/4) | Extract shared components | easy | Spotting and removing duplication |
| [#5](https://github.com/nitesh-khatri/interview-console/issues/5) | 🐛 Settings Save button | easy | Derived vs stored state — your first bug |

### Week 2 — [M2: Lists, tables & URL state](https://github.com/nitesh-khatri/interview-console/milestone/2)
*Goal: data-heavy UI, and the difference between state you store and state you derive.*

| # | Ticket | Level | What you'll learn |
|---|--------|-------|-------------------|
| [#6](https://github.com/nitesh-khatri/interview-console/issues/6) | Migrate to the Table primitive | easy | Refactoring safely behind tests |
| [#7](https://github.com/nitesh-khatri/interview-console/issues/7) | Sortable, paginated table | medium | Deriving views; sorting rules for missing data |
| [#8](https://github.com/nitesh-khatri/interview-console/issues/8) | Search/filters/sort in the URL | medium | The URL as state; push vs replace |
| [#9](https://github.com/nitesh-khatri/interview-console/issues/9) | 🐛 Selection count vs what's shared | medium | One source of truth; indeterminate checkboxes |
| [#10](https://github.com/nitesh-khatri/interview-console/issues/10) | Debounced search + highlight | medium | Debouncing; safe highlighting (no XSS) |

### Week 3 — [M3: The interview console](https://github.com/nitesh-khatri/interview-console/milestone/3)
*Goal: the app's richest surface — interaction, optimistic UI, the keyboard.*

| # | Ticket | Level | What you'll learn |
|---|--------|-------|-------------------|
| [#11](https://github.com/nitesh-khatri/interview-console/issues/11) | Keyboard scoring shortcuts | medium | Global key handlers that don't fire mid-typing |
| [#12](https://github.com/nitesh-khatri/interview-console/issues/12) | Autosave status indicator | medium | A small state machine; `aria-live` |
| [#13](https://github.com/nitesh-khatri/interview-console/issues/13) | 🐛 Optimistic updates never roll back | medium | Optimistic UI done right |
| [#14](https://github.com/nitesh-khatri/interview-console/issues/14) | Drag-and-drop reorder | hard | Drag *and keyboard* reordering |
| [#15](https://github.com/nitesh-khatri/interview-console/issues/15) | 🐛 Search hidden behind collapsed categories | easy | Deriving open/closed from the query |

### Week 4 — [M4: Data viz & bigger features](https://github.com/nitesh-khatri/interview-console/milestone/4)
*Goal: build whole features against pre-built APIs, and visualise data.*

| # | Ticket | Level | What you'll learn |
|---|--------|-------|-------------------|
| [#16](https://github.com/nitesh-khatri/interview-console/issues/16) | Dashboard charts | medium | Charts with plain SVG/CSS — no library |
| [#17](https://github.com/nitesh-khatri/interview-console/issues/17) | Candidate comparison | hard | Aligning data across a set (the union problem) |
| [#18](https://github.com/nitesh-khatri/interview-console/issues/18) | Favourites & recents | medium | Server state + safe `localStorage` |
| [#19](https://github.com/nitesh-khatri/interview-console/issues/19) | Interview templates | hard | Bulk actions; the duplicate case |

### Weeks 5–6 — [M5: Responsive, a11y & polish](https://github.com/nitesh-khatri/interview-console/milestone/5)
*Goal: make it work for everyone — small screens, keyboards, screen readers.*

| # | Ticket | Level | What you'll learn |
|---|--------|-------|-------------------|
| [#20](https://github.com/nitesh-khatri/interview-console/issues/20) | Mobile console (bottom sheet) | medium | Reusing a component responsively |
| [#21](https://github.com/nitesh-khatri/interview-console/issues/21) | Accessibility pass | medium | Accessible names, radiogroup, focus |
| [#22](https://github.com/nitesh-khatri/interview-console/issues/22) | Command palette (⌘K) | hard | Global shortcuts, focus management |
| [#23](https://github.com/nitesh-khatri/interview-console/issues/23) | Confirm destructive actions | easy | Reusing the AlertDialog pattern |
| [#24](https://github.com/nitesh-khatri/interview-console/issues/24) | Markdown in notes | hard | Parsing safely; never trust input on a public page |
| [#25](https://github.com/nitesh-khatri/interview-console/issues/25) | 🐛 Round timer on completed rounds | easy | Reading the right field; a pure, testable formatter |

🐛 = a real bug. Bug tickets don't tell you the fix — diagnosing it is the point.
Their tests already fail on today's code; making them pass is how you know you got it.

### [Backlog](https://github.com/nitesh-khatri/interview-console/milestone/6) (unscheduled)
Nine more real findings — dead code, a listener leak, an N+1 query, missing
validation. Pick from here once you've cleared the milestones, or when you want a
palate cleanser between bigger tickets.

---

## What "done" means

A ticket is done when **all four** of these hold — not before:

- [ ] Its test passes: `npm run test:ticket <NN>` (you un-skipped it first)
- [ ] The whole suite still passes: `npm test` (you didn't break earlier work)
- [ ] It builds clean: `npm run build` (no TypeScript or lint errors)
- [ ] It works in all 6 themes and at 375px and 1280px (you actually looked)

The test is the spec. If you're unsure what a ticket wants, read its test file in
`tests/tickets/` — it's precise about the shape expected of you (the `data-testid`
hooks, the function signatures).

---

## Using the reference branch honestly

There's a `reference/solutions` branch with every ticket implemented. It's there so
you can compare **after you've attempted a ticket** — not before.

The learning is in the attempt. If you read the solution first, you'll understand it
and then not be able to reproduce it a week later, which helps no one. So:

1. Attempt the ticket. Get its test passing your own way.
2. Open your PR.
3. *Then* diff your branch against `reference/solutions` and see where it differs.
   Different is fine — there's rarely one right answer. Look for *why* the reference
   made a choice, and ask if it isn't obvious.

If you're properly stuck for more than an hour — not "this is hard" but "I don't
know what to try next" — that's the moment to ask, not to peek. Drop a comment on
the issue or message the team.

---

## Getting help

- **Stuck on the setup?** [SETUP.md](../SETUP.md) has a troubleshooting section for
  the errors you'll actually hit on Windows.
- **Stuck on a ticket?** Comment on the issue with what you tried and what happened.
  "It doesn't work" is hard to help with; "I expected X, I see Y, here's the code"
  gets you an answer fast.
- **Not sure something's in scope?** Every ticket has an *Out of scope* section.
  When in doubt, keep the PR small — smaller PRs get reviewed and merged faster.
