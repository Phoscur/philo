# Investigation: Missing frames in sunset timelapses

**Date:** 2026-07-01
**Status:** Root cause found + fixed (capture-side). One secondary build bug fixed. Two open questions noted.
**TL;DR:** `rpicam-still` occasionally fails and writes no file, but the shared `spawnPromise`
resolves on stdout-close **without checking the process exit code**, so the capture loop counted
the failure as a success and advanced past a missing frame. Result: isolated holes in the middle
of an otherwise-complete run, and `ffmpeg` renders that truncate at the first gap. The bug is
**latent and longstanding**; it only started producing holes when the **rpi5 camera hardware went
flaky around Sep 2025**. Fixed by verifying a non-empty output file landed after each capture and
retrying the same frame on failure (with consecutive-error counting so a few flaky frames no
longer abort the whole run).

---

## 1. Symptom as reported

- "Missing frames almost every sunset timelapse for about a year." Rare to get the full 540.
- Examples given: `sunset-2026-06-09` had 539 files, `sunset-2026-06-10` had 536.
- User later confirmed two crucial facts that steered the diagnosis:
  1. The frames were **not captured** (missing on the Pi's disk, not merely un-uploaded).
  2. The `ffmpeg` timelapse renders are **truncated** too.

Default run parameters (`.env`): `DAILY_TIMELAPSE_SUNSET_FRAME_COUNT=540`,
`DAILY_TIMELAPSE_SUNSET_INTERVAL_MS=15000`, scheduled ~1.2 h before sunset.

---

## 2. The decisive evidence

### 2a. Holes are in the *middle*, not the tail

Listing individual frame numbers in the GitHub-cloned backups (`N:\SunsetBackup`) showed the last
frame (540) present in every run, with **isolated single-frame gaps scattered through the middle**:

| Folder | Missing frame numbers |
|--------|-----------------------|
| `sunset-2026-06-27` | 001, 189, 211, 233, 324, 481, 484 |
| `sunset-2026-06-28` | 099, 444 |
| `sunset-2026-06-29` | 169, 332, 445, 448, 470 |

This immediately rules out the "run aborted early → tail truncation" class of explanations: every
run reaches frame 540, but with holes behind it.

### 2b. Onset timeline (this is the expensive-to-reproduce part)

Scanning **every** backup folder for real interior holes (see method in §7) gave a clear onset.
Note: folders with **>540** files are days with **two runs** in one directory (e.g. 916, 962,
1068 files) — those are false positives, not holes. Folders ending below their range are early
stops (manual cancel / crash), also not interior holes. Only genuine interior gaps are counted below.

| Period | Pattern |
|--------|---------|
| 2023 – Aug 2025 | **Essentially clean.** Only rare one-off bad days: `2025-01-21` (4), `2025-05-30` (2), `2025-07-30` (10). **All of August 2025 clean.** |
| **Sep 2025** | **First real onset** — `2025-09-16` (16 holes), `2025-09-19` (1), then intermittent. |
| Oct 2025 | Becomes **frequent** (`10-06`, `10-08`, `10-12`, `10-15`, `10-19`, `10-22`…`10-31`). |
| Nov 2025 → Jun 2026 | **Near-daily**, typically **2–8 holes per run**, occasional spikes (`2026-04-25`: 30, `2026-01-25`: 14). |

The near-daily pattern from Nov 2025 is what the user experienced as "about a year."

---

## 3. Hypotheses considered and eliminated

Documenting the dead ends so they aren't re-walked.

### H1 — Cumulative `errors > 3` abort → tail truncation. **REJECTED.**
`Timelapse.shoot` had `let errors = 0` incremented on every failure and never reset, aborting the
whole run at `errors > 3`. That would truncate the **tail** (contiguous 1..N). But the data shows
**isolated middle holes with the run still reaching 540** — impossible from a tail-truncating
abort. (This cumulative counter was still a real latent problem — see §5 — but it was not the
cause of the observed holes.)

### H2 — Frames lost during the per-frame GitHub upload. **PLAUSIBLE, BUT NOT THE CAUSE HERE.**
The capture loop *cannot* skip a frame number on its own: `frame` only increments **after** a
successful `await camera.photo()`, and on error it is **not** incremented, so the same number is
retried on the next tick. That logic produces a contiguous sequence. So a single-frame hole
*seemed* like it had to come from something that processes frames independently — i.e. the
per-frame upload (`Producer.onFile` → `uploadQueue` → `Repo.upload` → `Git.upload`), which:
- is fire-and-forget: `uploadQueue.enqueue(task)` with the default **`retry = 0`**;
- swallows all errors: `Git.upload` wraps `add → commit → push` in `try { … } catch { log('Failed to push!') }` and returns normally;
- has **no reconciliation** — `Repository.makeTimelapsePage` even has a `// TODO? jic add & commit files again?` and never re-adds the jpgs.

**Why it turned out not to be the cause:** the user confirmed the frames are missing **on the Pi's
disk** and the **ffmpeg render truncates** — both are capture-side symptoms. The upload fragility
is real but would only affect the *GitHub copy*, not the local disk or the render. See §6 (still
open) — it can independently drop frames from GitHub and is worth hardening separately.

> Data-source subtlety that matters for reading counts correctly:
> - The "**Storage has N files in <repo>**" log line is from `downloadBackups.ts`, which clones the
>   repos **from GitHub** (`depth: 1`, shallow) and counts files — so it reflects **GitHub**, not the Pi.
> - `N:\SunsetBackup\*` folders contain `.git` + `README.md`; `moveBackups` rsyncs with
>   `--exclude=.git`, so those folders are **git clones mirroring GitHub**, not raw local capture.
> - The shallow clone squashes history to 1 commit, so per-frame commit history is **not** available there.

### H3 — `rpicam-still` fails silently, capture loop advances. **CONFIRMED ROOT CAUSE.** See §4.

---

## 4. Root cause (confirmed)

### The mechanism
`StillCamera.takeImage` runs `rpicam-still --output <path>.jpg …` through the shared
`spawnPromise`. `spawnPromise` (in `src/lib/spawn.ts`):

```js
childProcess.stdout.on('close', () => {
  if (stderrData.length > 0 && !allowError) return reject(new Error(stderrData.toString()));
  if (stderrData.length > 0) { console.log('CMD stderr', …); }
  return resolve(stdoutData);          // resolves on stdout close — exit code NEVER inspected
});
```

- It **resolves on the stdout `close` event and never checks the process exit code.** The only
  `reject` paths are a spawn `'error'` (e.g. `ENOENT`) and the `!allowError` stderr branch.
- The camera calls it with **`allowError = true`**, so stderr is ignored too.
- rpicam writes the JPEG to a **file**, so stdout is empty regardless of success/failure.

When `rpicam-still` fails for a frame (sensor hiccup, timeout, "failed to start camera", buffer
allocation error), it prints to stderr, **exits non-zero, and writes no file** — yet
`spawnPromise` still resolves. So `Camera.photo()` returns "successfully," and the capture loop
does:

```js
await camera.photo();                 // "succeeded" but wrote nothing
events.emit('file', camera.filename); // emits a file that isn't on disk
frame++;                              // advances past the hole
```

→ a missing file at exactly that frame number, the run continues to 540, `errors` never
increments (so no retry, no abort), and `ffmpeg`'s numbered-sequence demuxer stops at the first gap.

### Why the loop's own retry logic didn't save it
The loop was actually written to be gap-safe — on a thrown error it does **not** advance `frame`,
so the next tick retries the same number. But that path was **dead code**, because a failed
capture never threw: `spawnPromise` reported it as success. Fixing the success detection is what
brings the retry logic to life.

### Why it manifested when it did (git-history correlation)
`git log` for the relevant files:

| Commit | Date | Change |
|--------|------|--------|
| `73d9e73` | 2021-07-24 | Original `raspistill & ffmpeg spawn promise wrappers` — **already resolves on stdout close, no exit-code check.** |
| `87820d8` | 2025-08-29 | "Update spawnPromise rejection logic" — briefly turned stderr→reject **on**. |
| `997b93c` | 2025-08-31 | "Fix spawnPromise" — added `allowError = true` default → stderr ignored again (**reverted to the long-standing lenient behavior**). |
| `05f21a9` | 2025-12-25 | "Fix rpi5 … switch to rpicam" — `libcamera-still` → `rpicam-still`; camera passes `allowError = true`. |

Conclusions:
- **Not the rpicam upgrade.** rpicam landed 2025-12-25, but near-daily holes were established from
  **Oct–Nov 2025**, ~2 months earlier. Holes predate rpicam.
- **Not the spawn edits.** The Aug 2025 churn netted out to the **same lenient behavior** that had
  run cleanly for years. It didn't introduce new failure-masking.
- **The bug is latent and longstanding** (no exit-code check since 2021). What changed in
  **Sep–Oct 2025** is that the **camera/Pi started failing intermittently** (~0.5–1.5 % of frames).
  This lines up with the **rpi5 migration troubles** that the Dec "Fix rpi5" commit was cleaning up
  after — the hardware went flaky in autumn, the code caught up in December. Flaky hardware +
  silent-failure path = permanent holes.

---

## 5. The fix

Scoped to the **capture path only** — `spawnPromise` was left untouched because it is shared by
`rpicam-still`, `rsync`, `ssh`, and `df`/`du`, and prior attempts to make it strict broke other
callers. (ffmpeg already uses its own wrapper, `spawnPromisePrependStdErr` in `lib/ffmpeg.ts`.)

### 5a. `src/lib/libcamera-still.ts` — verify a file actually landed
After `spawnPromise` resolves, stat the output file and throw if it is missing/empty:

```js
const out = this.options.output;
if (out && out !== '-') {
  const size = await stat(out).then((s) => s.size, () => 0);
  if (!size) {
    throw new Error(`rpicam-still produced no output file: ${out}`);
  }
}
```

This converts a silently-failed capture into a real rejection. `Camera.photo()` rethrows and still
unlocks its mutex in `finally`, so the timelapse loop's `catch` runs.

### 5b. `src/services/Timelapse.ts` — retry the same frame + consecutive-error counting + log
**This second change is not optional.** Once §5a makes failures throw, the *old* cumulative
`errors > 3` abort would trip on a normal flaky day (5+ failures) and **truncate** the run —
turning scattered holes into a hard cutoff, i.e. strictly worse. So the counter now resets on
success (counts **consecutive** failures) and logs each failure with running tallies:

```js
let consecutiveErrors = 0; // reset on success: only a stuck camera aborts
let totalErrors = 0;       // whole-run tally, for the log
// … on success, after the file is confirmed:
consecutiveErrors = 0;
// … in catch (frame is NOT advanced → same frame retried next tick):
consecutiveErrors++; totalErrors++;
logger.log(`Frame [${frame}] capture failed, retrying same frame ` +
           `(fail #${consecutiveErrors} in a row, ${totalErrors} total this run): ${error?.message}`);
if (consecutiveErrors > 3) { events.emit('error', error); abort(); }
```

Net behavior: a failed frame is retried on the next 15 s tick (filling the hole); only a genuinely
stuck camera (>3 in a row) aborts the run. The log line lets a night's failures be quantified:
grep `pm2 logs philopho` for `capture failed`; the `total this run` on the last such line is the
day's failure count.

### 5c. Verifying the fix in production
- Watch the first couple of sunsets' logs for `capture failed … retrying same frame` lines.
- Confirm the day's folder lands at a full **540**.
- (Could not be exercised off-Pi — there is no camera on the dev machine, so the file-stat check is
  the reliable guard; verify against real rpicam behavior on the next run.)

---

## 6. Secondary finding — build was broken (and why `dist/` was stale)

`npm run build` (`tsc -b`) **failed** on a pre-existing error:

```
src/test.ts(128,3): error TS2304: Cannot find name 'check'.
```

`src/test.ts` is a manual scratch script (`npm run testm`) but it is **in the build graph**, and
`tsc -b` emits **nothing** if any file fails to compile. So this single broken scratch line
silently blocked every production build and left `dist/` stale (its `dist/scenes/…` files were
still from a pre-refactor architecture that no longer exists in `src`). Line 128 called a
non-existent `check()`; the dead branch was removed. Build is green again (exit 0) and `dist/`
regenerated with the fix compiled in.

**Lesson:** keep `src/test.ts` compiling, or exclude scratch files from the build — a broken
scratch script blocks all deploys.

---

## 7. How to regenerate the gap analysis (so we never search the archives by hand again)

Run from the backup mount (`N:\SunsetBackup` on the dev machine). Flags only **real interior
holes**; ignores double-run days (files > range) and early stops.

```bash
cd "N:/SunsetBackup"
for d in $(ls -d sunset-2* | sort); do
  ls "$d" 2>/dev/null | grep -oE '[0-9]{3}\.jpg$' | grep -oE '^[0-9]{3}' | sort -n | awk -v D="$d" '
    {n=$1+0; if(NR==1)first=n; last=n; c++}
    END{ if(c>0){ gap=(last-first+1)-c; tag=(gap>0)?"  HOLES="gap:""; \
         printf "%-24s files=%-4d range=%03d-%03d%s\n", D, c, first, last, tag } }'
done
```

To list the exact missing frame numbers in one folder:

```bash
comm -23 <(seq 1 540 | awk '{printf "%03d\n",$1}') \
         <(ls "$FOLDER" | grep -oE '[0-9]{3}\.jpg$' | grep -oE '^[0-9]{3}' | sort -u)
```

> The full backup scan over the CIFS mount takes ~2 min and may time out; scope to a year range
> (`ls -d sunset-2025-*`) if needed.

---

## 8. Deployment reality discovered along the way

(Fuller version in `CLAUDE.md`; captured here because it blocked shipping the fix.)

- The Pi runs the **compiled `dist/main.js` under PM2** (`ecosystem.config.cjs`, app `philopho`,
  `watch: true`, watches `dist/`, **ignores `src/`**). So `src` changes do nothing until compiled.
- Code reaches the Pi via the **VS Code SFTP extension** (`.vscode/sftp.json`, `uploadOnSave`,
  default profile `pi5` = `pi@192.168.178.44:/home/pi/philo`).
- **`uploadOnSave` only fires on real editor saves** — files written by tooling or generated by
  `tsc` are not auto-uploaded; use Command Palette → **"SFTP: Sync Local → Remote"**.
- **The Pi's `~/philo` is not a git checkout** (no `.git`) — it was copied via SFTP, so `git pull`
  there fails.
- Ship flow used: `npm run build` locally → SFTP Sync `dist/` → Remote → PM2 auto-restarts →
  `pm2 logs philopho`.

---

## 9. Open questions / follow-ups

1. **`philo-optic` / `philo-optic.service` on the Pi (not in this repo).** Confirm what actually
   runs the sunset capture: `pm2 list` and `systemctl status philo-optic`. If `philo-optic` is the
   active capturer, the fixes in *this* repo won't take effect and the investigation needs to move
   to that codebase. **This is the single most important thing to verify before trusting the fix.**
2. **Per-frame GitHub upload has no retry/reconciliation** (§H2). Independent of the capture holes,
   `Git.upload` swallows errors, `uploadQueue` uses `retry = 0`, and nothing reconciles local files
   vs. what was committed. This can drop frames from the *GitHub* copy even when capture is perfect.
   Worth hardening: a reconcile pass on `captured` (diff local jpgs vs `git ls-files`, add+commit+push
   the missing ones), or one batched commit/push at the end instead of 540 per-frame pushes.
3. **`moveBackups` verification never compares against GitHub** — only local-vs-rsync-copy — so it
   cannot detect upload gaps.

---

## 10. Files changed this session

| File | Change |
|------|--------|
| `src/lib/libcamera-still.ts` | Post-capture file-exists/non-empty verification; throws on failure. |
| `src/services/Timelapse.ts` | Retry same frame on failure; **consecutive** (not cumulative) error counting; per-failure log with tallies. |
| `src/lib/dht11.ts` | Removed unused `readTemperatureSensor` import (lint). |
| `src/i18n.ts` | `published` → `_published` unused-param (lint). |
| `src/test.ts` | Removed dead `check()` branch that broke `tsc -b` (and thus all deploys). |

Verified: `npm run build` exit 0, `npm run lint` 0 warnings, fix strings present in
`dist/lib/libcamera-still.js` and `dist/services/Timelapse.js`.
