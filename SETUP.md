# Setup guide (Windows)

Get the Interview Console running on your machine. Should take about 15 minutes.

These instructions are written for **Windows 10/11 with PowerShell**. macOS and
Linux notes are at the bottom.

---

## 1. Install Node.js 20 or newer

Check whether you already have it:

```powershell
node -v
```

If that prints `v20.x` or higher, skip ahead. Otherwise install **nvm-windows**,
which lets you switch Node versions later without reinstalling:

1. Download `nvm-setup.exe` from
   <https://github.com/coreybutler/nvm-windows/releases>
2. Run it, then **close and reopen PowerShell** (the PATH changes won't apply to
   an already-open window).
3. Install and select Node 22:

```powershell
nvm install 22
nvm use 22
node -v
```

> Plain installer instead? <https://nodejs.org> → LTS. nvm is recommended because
> you will eventually need a different Node version for some other project.

---

## 2. Get the code

```powershell
git clone https://github.com/nitesh-khatri/interview-console.git
cd interview-console
npm ci
```

`npm ci` installs the exact dependency versions from `package-lock.json`. Use it
rather than `npm install` so your setup matches everyone else's.

### If `npm ci` fails on `better-sqlite3`

This is the one dependency that isn't plain JavaScript — it's a native module
that talks to SQLite. It normally downloads a prebuilt binary for Windows and
just works, but if you see errors mentioning `node-gyp`, `MSBuild`, or
`Visual Studio`, it couldn't find one for your Node version and tried to compile
it instead.

Fix it by installing the C++ build tools:

1. Download **Visual Studio Build Tools** from
   <https://visualstudio.microsoft.com/visual-cpp-build-tools/>
2. In the installer, tick **"Desktop development with C++"**.
3. Reboot, then:

```powershell
npm ci
```

Still stuck? Two fallbacks:
- Switch to a Node version with prebuilt binaries: `nvm install 20; nvm use 20`,
  delete `node_modules`, then `npm ci` again.
- Use **WSL2** (Ubuntu) and follow the macOS/Linux instructions below. Native
  modules build painlessly there.

---

## 3. Create the database and load demo data

The app stores everything in a local SQLite file — there's no database server to
install.

One command creates the database, loads the question banks, and fills it with
12 fictional candidates with full interview histories plus an account for every
role:

```powershell
npm run seed:demo
```

This writes your logins to **`demo-credentials.txt`** in the project root. That
file is gitignored, so it never gets committed. Every account uses the same
password.

> Already have data and want to start over?
> `npm run seed:demo -- --reset`

---

## 4. Run it

```powershell
npm run dev
```

Open <http://localhost:3000> and sign in with any account from
`demo-credentials.txt`.

Try signing in as each of them — they see genuinely different things:

| Account | What it's for |
|---|---|
| `admin` | Everything: user management, settings, question bank |
| `priya.hr` | HR: adds candidates, assigns rounds, reads reports. Cannot score interviews |
| `alex.dev` | Interviewer: conducts the rounds assigned to them |
| `sam.dev` | A second interviewer — use this to test handing a candidate between people |
| `jordan.pm` | Product interviewer |

---

## 5. Run the tests

Every ticket you pick up has a test that must pass before it's done.

```powershell
npm test          # run once 
npm run test:watch  # re-run automatically as you edit
```

Right now most ticket tests are **skipped**. When you start a ticket, you remove
the `.skip` from its test file and make it pass — see [CONTRIBUTING.md](./CONTRIBUTING.md).

Sanity check: `npm test` should pass immediately after setup. If it doesn't,
something is wrong with your install, not with your code — ask before continuing.

---

## Common problems

**`npm run dev` says the port is in use**
Another copy is already running. Find and stop it:
```powershell
netstat -ano | findstr :3000
taskkill /PID <the-number-from-the-last-column> /F
```

**"running scripts is disabled on this system"**
PowerShell is blocking npm's script. Allow local scripts for your user:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

**Changes don't show up in the browser**
Stop the server, delete the `.next` folder, start again:
```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

**Everything is broken and you don't know why**
Reset your dependencies:
```powershell
Remove-Item -Recurse -Force node_modules, .next
npm ci
```

**You want a completely clean database**
Delete the `data` folder, then repeat step 3. You'll lose local data only —
nothing on the server is affected.

---

## macOS / Linux / WSL2

Same steps, different shell:

```bash
nvm install 22 && nvm use 22
git clone https://github.com/nitesh-khatri/interview-console.git
cd interview-console
npm ci
npm run dev          # once, to create the DB, then Ctrl+C
npm run seed:demo
npm run dev
```

To point the app at a different database directory:

```bash
DATA_DIR=/tmp/scratch npm run dev
```

The PowerShell equivalent is:

```powershell
$env:DATA_DIR="C:\temp\scratch"; npm run dev
```

---

## What next

- [CONTRIBUTING.md](./CONTRIBUTING.md) — how to pick up a ticket, branch, and open a PR
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — how the app is put together
- The [issue board](https://github.com/nitesh-khatri/interview-console/issues) — your work queue
