#!/usr/bin/env node
/**
 * Seeds the database with realistic DEMO data so there's something to build
 * against: users for every account type, candidates at every pipeline stage,
 * rounds in every state, scored questions, rating notes, and a share link.
 *
 *   npm run seed:demo            # only if the DB has no candidates yet
 *   npm run seed:demo -- --reset # wipe demo data and re-seed
 *
 * Every person in here is fictional. Never point this at a database holding
 * real interview data — use a separate DATA_DIR.
 *
 * Generated logins are written to demo-credentials.txt, which is gitignored.
 */
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { SCHEMA } from "../src/lib/schema.mjs";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");
const RESET = process.argv.includes("--reset");
const PASSWORD = "demo1234";

// Create the database if it doesn't exist yet, so this works on a fresh clone
// without having to start the app first. Uses the same schema the app does.
fs.mkdirSync(path.join(DATA_DIR, "uploads"), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA);

// Everything the app itself would create on first boot, so this script works on
// a fresh clone: the built-in admin account and the built-in question banks.
function ensureBaseData() {
  if (db.prepare("SELECT COUNT(*) AS c FROM users").get().c === 0) {
    db.prepare(
      `INSERT INTO users (username, display_name, password_hash, role, must_change_password)
       VALUES ('admin', 'Admin', ?, 'admin', 0)`
    ).run(bcrypt.hashSync("admin123", 10));
  }

  const have = db.prepare("SELECT COUNT(*) AS c FROM questions").get().c;
  if (have > 0) return;

  const seedDir = path.join(process.cwd(), "src", "lib", "seed");
  const read = (f) =>
    JSON.parse(fs.readFileSync(path.join(seedDir, f), "utf8"));

  const banks = [
    {
      name: "Frontend Core",
      description:
        "Built-in bank covering HTML, CSS, JavaScript, React and Web Fundamentals across easy/medium/hard levels.",
      files: ["html.json", "css.json", "javascript.json", "react.json", "web-fundamentals.json"],
    },
    {
      name: "Telephonic Screening",
      description:
        "Questions for phone screens: background, technical screening, collaboration, ownership and culture fit.",
      files: ["telephonic.json"],
    },
  ];

  const insertBank = db.prepare(
    "INSERT INTO question_banks (name, description, is_seed) VALUES (?, ?, 1)"
  );
  const insertQ = db.prepare(
    `INSERT INTO questions (bank_id, category, difficulty, qtype, question, answer_hints, follow_ups)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  for (const bank of banks) {
    if (db.prepare("SELECT id FROM question_banks WHERE name = ?").get(bank.name)) continue;
    const info = insertBank.run(bank.name, bank.description);
    const questions = bank.files.flatMap(read);
    const tx = db.transaction(() => {
      for (const q of questions) {
        insertQ.run(
          info.lastInsertRowid,
          q.category,
          q.difficulty,
          q.qtype,
          q.question,
          q.answer_hints ?? null,
          q.follow_ups?.length ? JSON.stringify(q.follow_ups) : null
        );
      }
    });
    tx();
  }

  // Defaults the app expects to find.
  const setSetting = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
  );
  setSetting.run(
    "rating_params",
    JSON.stringify(["Attitude", "Problem Solving", "Communication", "Fundamental Knowledge"])
  );
  setSetting.run(
    "round_presets",
    JSON.stringify(["Telephonic Round", "Tech Round 1", "Tech Round 2"])
  );
  setSetting.run("default_theme", "graphite");
  setSetting.run("telephonic_preset_added", "1");
}

ensureBaseData();

// ---------------------------------------------------------------- guard rails
const existing = db.prepare("SELECT COUNT(*) AS c FROM candidates").get().c;
if (existing > 0 && !RESET) {
  console.error(
    `This database already has ${existing} candidate(s).\n` +
      `Re-run with --reset to replace them:  npm run seed:demo -- --reset`
  );
  process.exit(1);
}

if (RESET && existing > 0) {
  console.log(`Removing ${existing} existing candidate(s) and their rounds…`);
  // rounds / round_questions / round_ratings / batch items cascade from candidates
  db.prepare("DELETE FROM candidates").run();
  db.prepare("DELETE FROM candidate_batches").run();
  db.prepare("DELETE FROM users WHERE username != 'admin'").run();
}

// --------------------------------------------------------------------- users
const USERS = [
  { username: "priya.hr",   display_name: "Priya Raman",  role: "hr",          department: "Human Resources" },
  { username: "alex.dev",   display_name: "Alex Chen",    role: "interviewer", department: "Developer" },
  { username: "sam.dev",    display_name: "Sam Okafor",   role: "interviewer", department: "Developer" },
  { username: "jordan.pm",  display_name: "Jordan Blake", role: "interviewer", department: "Product" },
];

const upsertUser = db.prepare(
  `INSERT INTO users (username, display_name, password_hash, role, department, must_change_password)
   VALUES (?, ?, ?, ?, ?, 0)
   ON CONFLICT(username) DO UPDATE SET
     display_name = excluded.display_name,
     password_hash = excluded.password_hash,
     role = excluded.role,
     department = excluded.department,
     must_change_password = 0`
);

const hash = bcrypt.hashSync(PASSWORD, 10);
for (const u of USERS) {
  upsertUser.run(u.username, u.display_name, hash, u.role, u.department);
}

// Make sure the built-in admin has a known demo password too.
db.prepare(
  "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE username = 'admin'"
).run(hash);

const userId = (username) =>
  db.prepare("SELECT id FROM users WHERE username = ?").get(username).id;

const ids = {
  admin: userId("admin"),
  hr: userId("priya.hr"),
  alex: userId("alex.dev"),
  sam: userId("sam.dev"),
  jordan: userId("jordan.pm"),
};

// ---------------------------------------------------------------- candidates
/** @type {Array<object>} */
const CANDIDATES = [
  { name: "Nadia Fernandes", role: "Senior Frontend Engineer", company: "Northwind Labs", exp: 6,   status: "selected",   hr: "Very strong portfolio. Led a design-system rebuild end to end." },
  { name: "Tomás Delgado",   role: "Frontend Engineer",        company: "Brightside",     exp: 3,   status: "in_process", hr: "Good energy on the screening call. Keen on React internals." },
  { name: "Mei Lin Zhao",    role: "Senior Frontend Engineer", company: "Foldspace",      exp: 7.5, status: "in_process", hr: "Deep accessibility experience — rare and useful for us." },
  { name: "Ravi Chandran",   role: "Frontend Engineer",        company: "Kitewire",       exp: 4,   status: "on_hold",    hr: "Strong technically, but notice period is 3 months." },
  { name: "Béatrice Morel",  role: "Full Stack Engineer",      company: "Lumen & Co",     exp: 5,   status: "in_process", hr: null },
  { name: "Oluwaseun Adeyemi", role: "Frontend Engineer",      company: "Palmtree Tech",  exp: 2,   status: "rejected",   hr: "Enthusiastic but quite junior for this role." },
  { name: "Hana Kobayashi",  role: "UI Engineer",              company: "Studio Kome",    exp: 4.5, status: "in_process", hr: "Design-leaning engineer. Excellent CSS." },
  { name: "Marcus Webb",     role: "Frontend Engineer",        company: "Ironvale",       exp: 3.5, status: "in_process", hr: null },
  { name: "Ana Sofía Rojas", role: "Senior Frontend Engineer", company: "Cascada",        exp: 8,   status: "selected",   hr: "Best candidate we've seen this quarter. Move fast." },
  { name: "Dmitri Volkov",   role: "Frontend Engineer",        company: "Northgate",      exp: 5,   status: "rejected",   hr: "Struggled with the practical exercise." },
  { name: "Grace Mwangi",    role: "Frontend Engineer",        company: "Safari Digital", exp: 3,   status: "in_process", hr: "Self-taught, very impressive side projects." },
  { name: "Liam O'Sullivan", role: "UI Engineer",              company: "Harbour Studio", exp: 6,   status: "on_hold",    hr: "Waiting on their current offer to resolve." },
];

const insertCandidate = db.prepare(
  `INSERT INTO candidates
     (name, email, phone, current_company, experience_years, applied_role,
      notes, hr_notes, resume_url, status, created_by, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`
);

const slug = (n) => n.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");

const candidateIds = [];
CANDIDATES.forEach((c, i) => {
  const info = insertCandidate.run(
    c.name,
    `${slug(c.name)}@example.com`,
    `+44 7700 9000${String(i).padStart(2, "0")}`,
    c.company,
    c.exp,
    c.role,
    null,
    c.hr,
    // Fictional link — intentionally not a real host.
    `https://example.com/resumes/${slug(c.name)}.pdf`,
    c.status,
    i % 3 === 0 ? ids.hr : ids.admin,
    `-${CANDIDATES.length - i} days`
  );
  candidateIds.push(Number(info.lastInsertRowid));
});

// -------------------------------------------------------------------- rounds
const bankQuestions = db
  .prepare(
    `SELECT id, question, category, difficulty, qtype
       FROM questions WHERE archived = 0 ORDER BY RANDOM()`
  )
  .all();

if (bankQuestions.length === 0) {
  console.error("No questions in the bank — start the app once so it seeds them.");
  process.exit(1);
}

const RATING_PARAMS = db
  .prepare("SELECT value FROM settings WHERE key = 'rating_params'")
  .get();
const params = RATING_PARAMS ? JSON.parse(RATING_PARAMS.value) : [
  "Attitude", "Problem Solving", "Communication", "Fundamental Knowledge",
];

const QUESTION_NOTES = [
  "Clear, well-structured answer with a concrete example.",
  "Got there in the end, needed a nudge on the edge case.",
  "Confident on the theory, less sure how it applies in practice.",
  "Excellent — went beyond what was asked.",
  "Partial answer; missed the performance implication.",
  "Talked through the trade-offs unprompted. Strong.",
  "Hesitant at first, recovered well once they started drawing it out.",
];

const RATING_NOTES = {
  "Attitude": ["Engaged throughout, asked good questions about the team.", "Positive and curious. Took feedback on the spot."],
  "Problem Solving": ["Broke the problem down methodically before coding.", "Jumped to a solution quickly; reasoning was sound."],
  "Communication": ["Explained trade-offs clearly without jargon.", "Occasionally rambled, but the substance was there."],
  "Fundamental Knowledge": ["Solid grasp of the underlying model, not just the API.", "Knows the framework well; shakier on the platform beneath it."],
};

// Rounds are inserted inside makeRound() rather than from a shared prepared
// statement, because their timestamps are SQLite datetime() expressions that
// have to be interpolated into the SQL.
const insertRoundQuestion = db.prepare(
  `INSERT INTO round_questions
     (round_id, question_id, question_text, category, difficulty, qtype, score, notes, sort_order)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const insertRating = db.prepare(
  `INSERT INTO round_ratings (round_id, param_name, score, note, is_custom)
   VALUES (?, ?, ?, ?, 0)`
);

const pick = (arr, n) => arr.slice(n % Math.max(1, arr.length - 8), (n % Math.max(1, arr.length - 8)) + 8);
const interviewers = [ids.alex, ids.sam, ids.jordan];

/**
 * Build one round, optionally fully scored.
 *
 * `outcome` is the candidate's pipeline status, so recommendations and scores
 * tell a coherent story — a "selected" candidate shouldn't have a round
 * recommending "strong no". Aggregations built on this data then look sane.
 */
function makeRound(candidateId, roundNumber, title, interviewerId, status, seed, outcome) {
  // Interviews run under an hour, so these timestamps sit minutes apart, not
  // days. An in-progress round has to have started recently or the live timer
  // in the console reads as thousands of minutes.
  const durationMins = 45 + (seed % 4) * 8; // 45–69 min
  const started =
    status === "pending"
      ? null
      : status === "in_progress"
        ? `datetime('now', '-${18 + (seed % 5) * 7} minutes')` // 18–46 min ago
        : `datetime('now', '-${seed + 1} days')`;
  const completed =
    status === "completed"
      ? `datetime('now', '-${seed + 1} days', '+${durationMins} minutes')`
      : null;

  const positive = outcome === "selected";
  const negative = outcome === "rejected";
  const recommendation =
    status !== "completed"
      ? null
      : positive
        ? ["strong_yes", "yes"][seed % 2]
        : negative
          ? ["no", "strong_no"][seed % 2]
          : ["yes", "yes", "no"][seed % 3];

  /** Scores skew high for strong candidates, low for rejected ones. */
  const scoreFor = (i) =>
    positive ? 4 + ((candidateId + i) % 2)          // 4–5
    : negative ? 1 + ((candidateId + i) % 2)        // 1–2
    : 2 + ((candidateId + i) % 3);                  // 2–4

  const info = db
    .prepare(
      `INSERT INTO rounds
         (candidate_id, round_number, title, interviewer_id, status, recommendation,
          overall_notes, created_by, created_at, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), ${started ?? "NULL"}, ${completed ?? "NULL"})`
    )
    .run(
      candidateId,
      roundNumber,
      title,
      interviewerId,
      status,
      recommendation,
      status === "completed"
        ? "Overall a solid conversation. Would be comfortable pairing with them on real work."
        : null,
      ids.hr,
      `-${seed + 2} days`
    );

  const roundId = Number(info.lastInsertRowid);

  // Questions — completed rounds fully scored, in-progress partially.
  if (status !== "pending") {
    const qs = pick(bankQuestions, candidateId * 3 + roundNumber);
    const count = status === "completed" ? qs.length : Math.max(2, Math.floor(qs.length / 2));
    qs.slice(0, count).forEach((q, i) => {
      const scored = status === "completed" || i < count - 1;
      insertRoundQuestion.run(
        roundId,
        q.id,
        q.question,
        q.category,
        q.difficulty,
        q.qtype,
        scored ? scoreFor(i) : null,
        scored ? QUESTION_NOTES[(candidateId + i) % QUESTION_NOTES.length] : null,
        i
      );
    });
  }

  // Ratings — seeded for every round; scored once it's underway.
  params.forEach((p, i) => {
    const notes = RATING_NOTES[p];
    insertRating.run(
      roundId,
      p,
      status === "pending" ? null : scoreFor(i),
      status === "completed" && notes ? notes[(candidateId + i) % notes.length] : null
    );
  });

  return roundId;
}

// Give each candidate a plausible history based on their status.
candidateIds.forEach((cid, i) => {
  const status = CANDIDATES[i].status;
  const iv = interviewers[i % interviewers.length];
  const iv2 = interviewers[(i + 1) % interviewers.length];

  if (status === "rejected") {
    makeRound(cid, 1, "Telephonic Round", ids.hr, "completed", i, status);
  } else if (status === "selected") {
    makeRound(cid, 1, "Telephonic Round", ids.hr, "completed", i + 4, status);
    makeRound(cid, 2, "Tech Round 1", iv, "completed", i + 2, status);
    makeRound(cid, 3, "Tech Round 2", iv2, "completed", i, status);
  } else if (status === "on_hold") {
    makeRound(cid, 1, "Telephonic Round", ids.hr, "completed", i + 2, status);
    makeRound(cid, 2, "Tech Round 1", iv, "in_progress", i, status);
  } else {
    // in_process — spread across the pipeline
    makeRound(cid, 1, "Telephonic Round", ids.hr, "completed", i + 3, status);
    if (i % 3 === 0) {
      makeRound(cid, 2, "Tech Round 1", iv, "in_progress", i, status);
    } else if (i % 3 === 1) {
      makeRound(cid, 2, "Tech Round 1", iv, "completed", i + 1, status);
      makeRound(cid, 3, "Tech Round 2", iv2, "pending", i, status);
    } else {
      makeRound(cid, 2, "Tech Round 1", iv, "pending", i, status);
    }
  }
});

// ------------------------------------------------- share links + a batch link
const selected = candidateIds.filter((_, i) => CANDIDATES[i].status === "selected");
const shareStmt = db.prepare("UPDATE candidates SET share_token = ? WHERE id = ?");
for (const cid of selected) {
  shareStmt.run(crypto.randomBytes(24).toString("base64url"), cid);
}

const batchToken = crypto.randomBytes(24).toString("base64url");
const batch = db
  .prepare("INSERT INTO candidate_batches (token, title, created_by) VALUES (?, ?, ?)")
  .run(batchToken, "Frontend shortlist — final two", ids.hr);
const addItem = db.prepare(
  "INSERT INTO candidate_batch_items (batch_id, candidate_id, sort_order) VALUES (?, ?, ?)"
);
selected.forEach((cid, i) => addItem.run(Number(batch.lastInsertRowid), cid, i));

// -------------------------------------------------------------- credentials
const rows = db
  .prepare("SELECT username, display_name, role, department FROM users ORDER BY role, username")
  .all();

const credText = `Interview Console — demo logins
================================
Generated ${new Date().toISOString()}

Every account below uses the same password:

    ${PASSWORD}

${rows
  .map(
    (u) =>
      `  ${u.username.padEnd(12)} ${PASSWORD.padEnd(10)} ${u.display_name.padEnd(15)} ${
        u.role === "admin" ? "Admin" : u.department ?? u.role
      }`
  )
  .join("\n")}

What each account is for
------------------------
  admin        Full access: user management, settings, question bank.
  priya.hr     HR view: adds candidates, assigns rounds, reads reports.
               Cannot score interviews or edit the question bank.
  alex.dev     Developer/interviewer: conducts rounds assigned to them.
  sam.dev      A second interviewer, so you can test the hand-off between
               interviewers and the "assigned to me" filter.
  jordan.pm    Product interviewer — same permissions as a developer.

Data seeded
-----------
  ${CANDIDATES.length} candidates across every status (in process / selected /
  rejected / on hold), each with a plausible round history: telephonic screens,
  tech rounds, some completed with scores and notes, some in progress, some not
  started. ${selected.length} public share links plus one batch link.

This file is gitignored — it is not committed. Everyone here is fictional.
`;

fs.writeFileSync(path.join(process.cwd(), "demo-credentials.txt"), credText);

const counts = {
  users: db.prepare("SELECT COUNT(*) c FROM users").get().c,
  candidates: db.prepare("SELECT COUNT(*) c FROM candidates").get().c,
  rounds: db.prepare("SELECT COUNT(*) c FROM rounds").get().c,
  questions: db.prepare("SELECT COUNT(*) c FROM round_questions").get().c,
};

console.log(`
Demo data seeded.

  users        ${counts.users}
  candidates   ${counts.candidates}
  rounds       ${counts.rounds}
  scored Qs    ${counts.questions}

Logins written to demo-credentials.txt (gitignored).
Every account's password is: ${PASSWORD}

Start the app with:  npm run dev
`);
