# Contributing

How to pick up a ticket and get it merged. New here? Read [SETUP.md](./SETUP.md)
to get running and [docs/ROADMAP.md](./docs/ROADMAP.md) to see which ticket to pick
first — this page is just the mechanical loop.

---

## The loop

1. **Pick the top ticket** from the [project board](https://github.com/nitesh-khatri/interview-console/projects)
   Todo column. They're ordered — the top one is the right next thing. Move it to
   **In Progress** and assign yourself.

2. **Branch off `main`**, named after the issue:

   ```powershell
   git checkout main
   git pull
   git checkout -b feature/12-autosave-indicator
   ```

   Use `feature/`, `fix/`, or `chore/` followed by the issue number and a short slug.

3. **Un-skip the ticket's test.** Every ticket has one in `tests/tickets/`. Open it
   and change `describe.skip(` to `describe(`. Run it and watch it fail:

   ```powershell
   npm run test:watch
   ```

   That failing test is your specification. When it's green, the ticket's core
   requirement is met.

4. **Build it.** The test tells you *what*; the ticket's screenshot tells you what
   it should *look* like; [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) tells you
   *where things go*.

5. **Check your work before pushing:**

   ```powershell
   npm test          # all tests, not just yours
   npm run build     # catches type and lint errors
   ```

   Both must pass. `npm test` running everything matters — it's how you find out
   you broke something you finished last week.

6. **Commit and push:**

   ```powershell
   git add .
   git commit -m "Add autosave status indicator to the interview console"
   git push -u origin feature/12-autosave-indicator
   ```

7. **Open a PR** against `main`. The template will prompt you for what's needed.
   Link the issue with `Closes #12` so it closes automatically on merge.

8. **Address review comments** by pushing more commits to the same branch. Don't
   open a new PR.

---

## What "done" means

A ticket is done when all of these are true:

- [ ] Its test passes, and so does every other test
- [ ] `npm run build` passes with no TypeScript or lint errors
- [ ] It looks like the screenshot in the ticket
- [ ] It works in **all six themes** — check at least one light and one dark
- [ ] It works at **375px** (phone) and **1280px** (laptop) — use your browser's
      device toolbar
- [ ] You didn't break anything that used to work

That last one is why we run the whole test suite.

---

## Writing code that fits

A few rules that keep this codebase consistent. There's more detail in
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

**Never hardcode a colour.** Not `#fff`, not `text-gray-500`, not
`bg-[#1a1a1a]`. Use the theme tokens — `bg-card`, `text-muted-foreground`,
`border`, `text-success`, `text-warning`. Six themes come free if you do; a
hardcoded colour breaks five of them.

**Check whether the component already exists.** `src/components/ui/` has 20+
shadcn primitives, and several are installed but unused — `Accordion`, `Table`,
`Tabs`, `Tooltip`, `Skeleton`, `Popover`, `Badge`, `Separator`, `ScrollArea`.
Reach for those before writing your own.

**Reuse what's there.** `ScoreChip` and the badge components
(`src/components/badges.tsx`), the `api()` helper (`src/lib/client.ts`),
`useDebouncedSave`, `cn()`. If you're about to write something that feels like it
should already exist, search first.

**Match the surrounding style.** Same naming, same file layout, same way of
handling loading and errors as the component next door.

**Keep the PR to the ticket.** If you spot something else broken, say so in the
PR or open a new issue — don't fix it in the same branch. Small PRs get reviewed
faster.

---

## Using `reference/solutions`

There's a branch called `reference/solutions` with all of these tickets already
implemented.

It's there so you can compare approaches and unblock yourself — but you'll learn
roughly nothing by reading it first. The honest way to use it:

1. Attempt the ticket yourself.
2. Stuck for more than ~30 minutes? Ask.
3. Still stuck, or finished and curious? Look at the reference and compare.

Your solution being different isn't wrong. If yours passes the tests and reads
clearly, it's a good solution. There's usually more than one.

---

## Getting help

Ask early — being stuck for two hours isn't a badge of honour. When you ask,
include:

- what you're trying to do,
- what you tried,
- the actual error message (paste the text, not a screenshot of it).

Good questions are a skill worth practising.

---

## Commit messages

One line, present tense, describing what the change does:

```
Add autosave status indicator to the interview console
Fix candidate selection being lost when filters change
Migrate the candidates table to the shadcn Table primitive
```

Not `fix`, `update`, `changes`, or `wip`. In six months someone will read
`git log` to work out why something is the way it is — write for them.
