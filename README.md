# Interview Console

An internal tool for running and scoring technical interviews. Interviewers browse
a categorized question bank during a live interview, log only the questions they
actually ask (each scored 0–5), rate soft skills, and hand candidates off to
teammates for the next round. HR tracks the whole pipeline and can share a
read-only report link publicly.

Built as a single Next.js app — no separate backend. Data lives in a local SQLite
file and uploaded resumes on disk.

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS v4** · **shadcn/ui**
- **better-sqlite3** (embedded DB, no server) · **bcryptjs** (password hashing) · **zod** (validation)

## Features

- **Roles & account types**: at sign-up people pick **Human Resources**,
  **Developer**, or **Product**. HR becomes the HR role; Developer/Product become
  Interviewers. Admins manage everyone.
- **Candidates**: add with basic info + resume (PDF/DOC/DOCX) + an optional HR
  "initial impression" note, track status.
- **Rounds & hand-off**: assign a candidate to a teammate for the next round;
  the next interviewer sees prior rounds before starting theirs.
- **Interview console**: split view — categorized question bank on the left
  (accordion, search, difficulty/type filters), asked-questions sheet with
  fast 0–5 scoring and per-question notes, and slide-in panels for soft-skill
  scoring (with custom parameters + recommendation) and candidate info.
- **Question banks**: a built-in "Frontend Core" bank (HTML, CSS, JavaScript,
  React, Web Fundamentals; easy/medium/hard; theory/practical/situational/
  architectural/debugging). Full CRUD, plus JSON **import/export** and a
  downloadable **AI-agent-focused template** so you can ask an AI to generate
  new banks.
- **Public report**: generate a revocable share link to a print-friendly
  interview summary (no contact details).
- **6 themes**: 2 light (Daylight, Latte) and 4 dark (Graphite, Midnight,
  Forest, Amoled), per-device with an org-wide default.

## New contributor? Start here

This repo doubles as a structured frontend training project. If you've been handed
it to work through:

1. [SETUP.md](./SETUP.md) — get it running (Windows-first).
2. [docs/ROADMAP.md](./docs/ROADMAP.md) — **which ticket to pick, and in what order.**
3. [CONTRIBUTING.md](./CONTRIBUTING.md) — the branch → test → PR loop.

## Local development

Requires **Node.js 20+**.

```bash
npm install
npm run dev
```

Open http://localhost:3000. On first run the database is created and seeded with
an admin account (**`admin` / `admin123`** — you'll be prompted to change it) and
the Frontend Core question bank.

### Helper scripts

- `npm run admin` — interactive CLI to create an admin, promote a user to admin,
  or reset an admin password (handy for first-time setup or recovering access).
- `npm run setup` — one-shot server deployment (pm2 + nginx). See
  [DEPLOYMENT.md](./DEPLOYMENT.md).

### Data location

Everything is stored under `DATA_DIR` (defaults to `./data`):

- `app.db` — SQLite database (schema auto-migrates on startup)
- `uploads/` — uploaded resumes

Both are gitignored. Back up by copying the whole `data/` directory.

## Question bank import format

Download the template from **Question Bank → Template** (or
`GET /api/question-banks/template`). It's JSON with an `$instructions` block
written for an AI agent, a `bank` object, and example `questions`. Import
validates every row and can either create a new bank or merge into an existing
one by name. Export produces the same shape, so banks round-trip.

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for a full walkthrough of running this on
a staging server (nginx + pm2, reachable by IP, no domain required).

## Project layout

```
src/
  app/
    (app)/            authenticated pages (dashboard, candidates, question-bank, settings)
    login/            login + self-registration
    report/[token]/   public, read-only interview report
    api/              route handlers (auth, candidates, rounds, question-banks, users, settings, files)
  components/         UI: app shell, badges, console/, candidates/, bank/, settings/, report/
  lib/
    db.ts             SQLite connection, schema, seeding
    auth.ts           sessions, password hashing, role guards
    queries.ts        typed data-access helpers
    pipeline.ts       candidate/round aggregates for dashboard & lists
    report.ts         public report assembly
    bank-format.ts    import/export schema + AI template
    seed/             built-in question bank (JSON per category)
```
