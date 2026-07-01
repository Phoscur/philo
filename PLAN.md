# PLAN: philo-optic camera gatekeeper + staging + GitOps

**Branch:** `a0` (rebased onto `main` on 2026-07-01)
**Status:** WIP. Branch does **not** compile yet — see Phase 0.
**Owner goal:** learn Go, run a second (staging) instance on the same Pi, move deployment to GitOps.

---

## 0. Where we are after the rebase

`a0` was rebased onto `main`, so it now sits **on top of** the dropped-frames fix
(`libcamera-still` output-file check + consecutive-error retry loop; see
`docs`/investigation notes). The one real conflict was `Timelapse.ts`:

- `main` = retry-same-frame + **consecutive** error counting (fills holes, only a
  stuck camera aborts).
- `a0` = drift-corrected async loop (replaces `setInterval`), but it re-introduced the
  hole bug (`frame++` on error) and used a **cumulative** counter.

**Resolved** by keeping the drift-corrected loop **and** the frame-fix semantics:
frame advances only on success; a failed frame is retried; a separate `attempt` clock
drives the drift-corrected sleep so retries wait one interval instead of hammering the
camera. `camera.photo(output)` (stateless Camera) throws on a missing file, so the loop's
`catch` is now live.

### What the rebase did NOT fix (pre-existing WIP in `a0`'s own commits)

`npm run build` currently fails with 6 errors — all from the half-finished
"atomic session folder" refactor in `refactor (ai) director`:

| File:Line | Error | Cause |
|-----------|-------|-------|
| `Director.ts:102` | `camera.capture` does not exist | Camera method is `photo(output)`, not `capture` |
| `Director.ts:133` | `Directory.createDirectory` does not exist | `Directory` only has `mkdirp(string[]): void`; there is no child-dir factory |
| `Producer.ts:156` | `Director.setupPrivateRepo` removed | private-repo setup was deleted from `Director` |
| `Producer.ts:156` | `Director.repoTimelapse` removed | daily-folder getters were deleted |
| `test.ts:58` | `Camera.name` removed | scratch script uses the old stateful Camera API |
| `test.ts:104` | `Director.repoTimelapse` removed | scratch script uses a deleted getter |

Plus two self-flagged design holes in `Director.scheduleSunset`:
`onStart(events, {} as Repo)` (`// TODO: Fix Repo/Folder coordination`) and the removal of
`cancelSunset()`.

---

## Who is Philo (the soul)

Philo is the patient timelapse heron of the Hyphe-Myzelium `media-tier`: he stands still for
hours and records slow, macroscopic rhythms without ever disturbing the ecosystem. The code
must embody that: **stoic, fault-tolerant, resource-minimal.** Concretely this means —

- **No hectic polling / negligible footprint.** Idle between frames, tight timing on capture.
- **Graceful degradation, never `panic()`.** A missing camera / bad light / wobbly USB → log,
  skip the frame, wait for the next cycle. The timeline continues regardless of dropped frames.
- **State independence.** Each snapshot depends only on the immediate moment, never on memory
  of past frames.
- **Small static binary** on weak edge hardware, no memory leaks over months of uptime.
- **Zero-interference:** Philo's capture must never block other processes on the node.

## Guiding decisions (agreed 2026-07-01)

1. **The dropped-frames fix stays in TypeScript.** A ~10-line correctness fix, not a reason to
   rewrite anything. Go would not have prevented it "for free" — it still needs an exit-code +
   output-file check.
2. **`philo-optic` is the single owner of the camera device**, exposing an **API** shared by
   multiple consumers (the bot today, a staging instance tomorrow). Real **cross-process**
   mutual exclusion, which the in-process `Camera.#mutex` cannot give.
3. **Capture semantics = single-flight (agreed).** The service *tries for a few seconds* to
   land a frame; **concurrent requests share the same frame** rather than each triggering a
   shutter. This lets us **delete the TS `Camera.#mutex` entirely** — the device owner
   coalesces. See Phase 1.
4. **Scope now: Go = camera capture daemon only.** Orchestration (Timelapse loop, scheduling,
   publishing, inventory, i18n, sun/moon, stitching-trigger) **stays in the TS bot**, which
   becomes an HTTP client of philo-optic. Moving the *cadence* into Go is a deliberate **later
   milestone** — see "Milestone: cadence in Go".
5. **Control plane: Telegram for now.** Keep the existing Telegram publishing/appraisal stack.
   **Matrix/Element as C2 is Phase 3**, introduced behind the existing `ChatMessenger`
   interface so Telegram's public features are not lost.
6. **Go is a deliberate choice** (learning + self-contained systemd daemon), a preference not a
   necessity.
7. **Same-Pi staging + GitOps** is the medium-term target the service is being built for.

---

## Phase 0 — Make the branch green (independent of Go) — DONE ✅

Goal: `npm run build` exits 0, lint clean, tests pass, so the `a0` refactor is shippable.
Kept the atomic-session-folder design; finished the seams it left dangling.

- [x] **Camera call:** `Director.photo` uses `camera.photo(fullPath)` (stateless Camera).
- [x] **Folder layout:** dropped the half-baked `source/` subfolder — `Repo.upload`,
  `makeTimelapsePage`, and ffmpeg all expect the `.jpg` frames next to the `.mp4`. Frames +
  render now live directly in the unique event folder (still atomic/self-contained), so no
  `Directory.createDirectory` was needed after all.
- [x] **Repo coordination (Option B-ish):** `director.timelapse()` now creates the event
  folder + its public repo and returns `{ events, repo }`. `scheduleSunset` and
  `Producer.timelapse` consume that (the `{} as Repo` hack is gone), and `cancelSunset()` is
  restored (clears the reschedule timeout + stops the run).
- [x] **Frame naming:** `.jpg` now added in the Timelapse layer (was previously supplied by
  the old stateful `Camera.filename`); the `file` event emits the bare `<prefix>-<NNN>.jpg`
  filename (not a path), matching `onFile`/`repo.upload`/`getMedia`.
- [ ] **Scratch script `test.ts`:** update to the stateless Camera + new folder API (or drop
  the two dead lines). Note from the investigation: a broken `test.ts` blocks `tsc -b`
  entirely, so this must compile.
- [x] **Warn + copy-forward, bounded abort (SOUL decision).** `Timelapse.shoot` no longer
  aborts on a hiccup: on a failed capture it logs a warning and **fills the gap by copying the
  previous good frame** (`photoDir.copyFile`) so the sequence stays gap-free (ffmpeg would
  truncate at a real hole) and the run keeps its rhythm. Tolerates **up to 5 copies in a row**;
  a real capture resets the streak; the 6th consecutive failure ends the run with `error`.
  Frame 1 (no predecessor) retries in place on the same 5-strike budget. `timelapse-frames.test.ts`
  rewritten for this (and switched to real tiny intervals — the fake-timer approach was fragile
  with the new promise-based drift loop).
- [x] `npm run build` green, lint 0 warnings, `npm test` green (12/12).

> The dropped-frames fix already shipped: `main` was deployed on the evening of 2026-06-30,
> so the live capturer (TS bot `philopho`) already has it. Phase 0 is **only** about making
> the `a0` refactor (atomic folders, Stakeholder, philo-optic scaffold) compile — it does not
> gate the frame fix.

**Exit criteria:** branch builds, tests pass, the `a0` refactor is shippable via the existing
SFTP→dist→PM2 flow.

---

## Phase 1 — philo-optic: single-flight capture daemon

Turn the empty skeleton (`main.go` and `go.mod` are 0 bytes) into a runnable gatekeeper whose
core is the **single-flight** capture.

- [ ] `go.mod` (`module philo-optic`, Go 1.24) and a real `package main` in `main.go`:
  HTTP server on `PORT` (default 8080), graceful shutdown, structured logging.
- [ ] **Single-flight capture endpoint** — `GET /frame?maxAgeMs=&timeoutMs=` returning image
  **bytes** + metadata `{ capturedAt, frameId }`. Semantics:
  - Serve the cached last frame if younger than `maxAgeMs` (`0` = force fresh).
  - Otherwise **join an in-flight capture** if one is running (all waiters get the same result
    or the same error), else start a new one.
  - The capture **retries up to `timeoutMs`** ("try for a few seconds") and only counts as
    success when a **non-empty file actually lands** — the same guard as the TS fix. This is
    the one behaviour we must not lose.
  - **Return bytes, not paths.** Concurrent callers share the same bytes and each writes its
    own destination. Sequential timelapse frames are not concurrent, so they stay distinct.
  - Implementation: `golang.org/x/sync/singleflight` or a hand-rolled `captureCall` struct
    (`sync.Mutex` + `done chan struct{}` + shared result). Simplify/replace the semaphore
    `select` currently drafted in `camera/service.go`.
- [ ] **Hexagonal camera backend:** a `Capturer` interface so `libcamera`/`rpicam` (Pi),
  `gphoto2` (DSLR), `v4l2` (webcam), and `mock` are swappable without touching the HTTP/
  single-flight layer.
- [ ] **Graceful degradation:** capture failure never `panic()`s — it logs, returns a
  structured error to waiters, and the daemon stays up for the next request.
- [ ] **Mock backend:** `PHILO_MODE=mock` (already referenced in `philo-optic.service`) writes
  a placeholder JPEG, so the service runs on the dev machine and in CI with no camera.
- [ ] `/health` (and later `/status` for temperature/disk if we move that here).
- [ ] `Makefile` cross-compiles arm64 (already present); add a `mock`/dev target.
- [ ] Avoid the logging race the current code comments flag (`cmd.Wait()` vs. log goroutines) —
  `CombinedOutput()` already sidesteps it.

**Note for staging:** single-flight means a prod + staging request landing together share the
**same photons** — one shutter, both get the frame. This is the intended zero-interference
property, not a bug. If staging must ever be optically independent, revisit here.

**Exit criteria:** `PHILO_MODE=mock go run .` serves `/frame` and returns an image; two
concurrent requests get the same `frameId`; on the Pi, `systemctl start philo-optic` captures
a real frame and a mid-capture second request coalesces instead of blocking.

---

## Phase 2 — Point the bot at philo-optic (delete the TS mutex)

Make the TS `Camera` service an HTTP client of philo-optic instead of spawning `rpicam`
directly. The DI seam makes this a localized change; orchestration stays in TS.

- [ ] `Camera.photo(output)` → `GET {PHILO_OPTIC_URL}/frame?maxAgeMs=0`, write the returned
  bytes to `output`. Keep the same throw-on-failure contract so `Timelapse`'s retry loop is
  unchanged.
- [ ] **Delete `Camera.#mutex`** — serialization now lives in the daemon's single-flight owner.
- [ ] `/preview` and `/photo` can pass a non-zero `maxAgeMs` so a mid-timelapse preview reuses
  the latest frame instead of forcing an extra shutter.
- [ ] `CameraStub` keeps working for unit tests (no network).
- [ ] Config: `PHILO_OPTIC_URL` (default `http://localhost:8080`).
- [ ] Optional fallback flag so the bot can still spawn `rpicam` directly if the daemon is down.

**Exit criteria:** a full sunset timelapse runs through philo-optic and lands a complete
folder; `Camera.#mutex` is gone; a preview during a running timelapse returns instantly with
the current frame and no extra shutter.

---

## Milestone (later): move the cadence into Go

Not now — triggered when **staging + GitOps** make orchestrator-independence pay off. Moving
the Timelapse loop + scheduling into the daemon buys, beyond capture serialization:

1. **Timing without event-loop jitter** — a Go ticker on its own goroutine isn't contended by
   ffmpeg spawns / upload queue / GC (the reason drift-correction exists in `Timelapse.ts`).
2. **Survives orchestrator restarts** — a GitOps deploy or bot crash during golden hour no
   longer kills an in-progress session. Matches the soul's "the timeline continues".
3. **Resolves staging coordination** — one cadence owner instead of prod + staging both racing
   to "start capturing now"; both orchestrators just subscribe to the resulting frames/videos.

Cost: reimplement sun/moon scheduling in Go (suncalc port), and turn the in-process
`EventEmitter` (`started`/`file`/`captured`/`rendered`/`stopped`) into a network stream
(SSE/WS, later Matrix events). Stitching (ffmpeg) may move here too, so the daemon emits a
finished MP4 + thumbnail and rsyncs the big file to Phedora directly.

---

## Phase 3 — Staging on the same Pi + GitOps + Matrix C2

- [ ] **Staging instance** of the bot sharing the single camera via philo-optic (one camera
  owner, two API consumers — the core justification for the service). Separate config /
  storage / Telegram target; both talk to the same `philo-optic` on :8080.
- [ ] **systemd/units & ports** documented; decide prod vs. staging isolation (separate
  storage roots, separate PM2 apps or units).
- [ ] **GitOps:** today `~/philo` on the Pi is **not** a git checkout (copied via SFTP), so
  deployment is manual. Move to a git-based reconcile: the Pi pulls the repo, builds, and
  restarts. Define the source of truth (branch → environment), build-on-Pi vs. build-in-CI,
  and how the Go binary + TS `dist/` are delivered.
- [ ] **Matrix/Element as C2** behind the existing `ChatMessenger` interface (`context.ts`):
  commands (`/start`, `/pause`, `/interval 5m`), status/alerts, and small thumbnails/deltas go
  to a dedicated room; big videos still go to Phedora via rsync. Telegram's public
  publication/appraisal features stay until (and unless) explicitly migrated.
- [ ] **Archive offloading to Phedora** (Storage Owl, Unraid `Pholiere`): finished timelapses
  pushed via rsync/webhook so edge nodes never fill up. Maps onto the existing `moveBackups`
  concept — reuse, don't reinvent.

---

## Retroactive archive repair (Stakeholder) — high value, mostly independent

`Stakeholder` (already written, easy to forget) does retroactively what the live loop now does
on the fly: `getMissingFrames()` finds the holes in an event folder and `fixFrames()` fills each
by **copying the previous frame** (same copy-forward trick). Since the dropped-frames bug left
near-daily holes from ~Sep 2025 to Jun 2026 (see the investigation), we can repair a year of
timelapses and re-render complete videos.

Plan for a batch-repair command (`npm run testm -- check` already wires `checkPublications`):

- [ ] **Pick the source of truth.** Repair the **GitHub event repos** (the frames live there; the
  N:\SunsetBackup clones mirror them). Filling the holes and pushing re-triggers the repo's ffmpeg
  Action → a gap-free video, no local ffmpeg needed. Alternative: repair local clones + `stitchImages`
  locally. Decide which (GitHub-Action re-render is the least work and matches how videos are made).
- [ ] **Resolve the frame-count discrepancy first.** `Stakeholder` defaults to `expectedCount = 541`
  but `.env` sets `DAILY_TIMELAPSE_SUNSET_FRAME_COUNT = 540`. Using the wrong expected count would
  fabricate or miss a frame across the whole archive — confirm the real per-run count (and whether
  it varies by season/era) before any mass run.
- [ ] **Wire a real `fix` command.** The commented-out `fix()` in `test.ts` is a sketch and calls
  `getMissingFrames`/`fixFrames` with the wrong args. Implement: per folder → `dir.list()` →
  `getFramePrefixFromFiles` + counter length → `getMissingFrames(files, expectedCount)` →
  `fixFrames(folder, missing, prefix, counterLength)` → re-stitch / push.
- [ ] **Guard rails:** dry-run mode (report holes + planned copies without writing), skip
  double-run folders (>expectedCount files = two runs in one dir, per the investigation), and log
  every fabricated frame. A filled frame is a duplicate — acceptable per SOUL, but must be visible.
- [ ] **Backfill limitation:** a hole is only fillable if the *previous* frame exists in that
  folder; isolated single-frame holes (the common case) always have a predecessor, so they repair
  cleanly. Contiguous gaps at the very start of a run cannot be back-filled.

## Cross-cutting / open items (from the dropped-frames investigation)

- [x] **Active capturer:** `main` deployed 2026-06-30 evening → the TS bot `philopho` (PM2) is
  the live capturer and has the frame fix. Still worth a quick `systemctl status philo-optic`
  to confirm the empty scaffold isn't also running/interfering. (Investigation §9.1)
- [ ] **Per-frame GitHub upload has no retry/reconciliation** — `Git.upload` swallows errors,
  `uploadQueue` uses `retry=0`, nothing reconciles local files vs. committed. Can drop frames
  from the GitHub copy even with perfect capture. Fix: a reconcile pass on `captured` (diff
  local jpgs vs `git ls-files`, commit the missing), or one batched push at the end instead
  of 540 per-frame pushes. (Investigation §9.2)
- [ ] **`moveBackups` never compares against GitHub** — only local-vs-rsync — so it cannot
  detect upload gaps. (Investigation §9.3)
- [ ] **Reconsider `media-tier` Redis/BullMQ timing (open).** SOUL defers the central
  Redis/BullMQ + Kanban (`media:timelapse`) integration to "future", but we may want to pull it
  forward. To decide: does Philo *consume* jobs from the queue (myzelium dispatches "capture
  now"), *publish* progress/results onto it, or both? How does it relate to the Phase-3 Matrix
  C2 (queue = work dispatch, Matrix = human C2)? Revisit before finalizing Phase 3.
- [ ] **`/publications` duplication:** `Stakeholder.checkPublications` and the inline
  `/publications` command in `photoStage.ts` implement the same "list unpublished" logic
  twice. Consolidate on `Stakeholder` once Phase 0 is stable.

---

## Suggested order

1. Phase 0 (green branch) — DONE.
2. Verify the Pi's active capturer (cross-cutting #1) — largely answered (main is deployed).
3. Phase 1 (philo-optic single-flight, mock → real).
4. Phase 2 (bot → service, delete TS mutex).
5. Phase 3 (staging + GitOps + Matrix C2).
6. Later, when 5 lands: the cadence-in-Go milestone.

Parallel/independent track (no dependency on the Go work): **retroactive archive repair** via
Stakeholder — can be done any time after resolving the 540-vs-541 count.
