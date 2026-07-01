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
  folder + its **private backup repo** (`setupBackupRepo`) and returns `{ events, repo }`.
  `scheduleSunset` and `Producer.timelapse` consume that (the `{} as Repo` hack is gone), and
  `cancelSunset()` is restored (clears the reschedule timeout + stops the run). Daily/event
  repos are private (backup); `setupPublicRepo` is kept for the future publish flow.
- [x] **Frame naming:** `.jpg` now added in the Timelapse layer (was previously supplied by
  the old stateful `Camera.filename`); the `file` event emits the bare `<prefix>-<NNN>.jpg`
  filename (not a path), matching `onFile`/`repo.upload`/`getMedia`.
- [x] **Scratch script `test.ts`:** updated to the stateless Camera + `{ events, repo }` return
  (`camera.name`/`repoTimelapse` gone); wired the existing `check` command into the dispatch.
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

## Phase 1 — philo-optic: single-flight capture daemon — DONE (dev) ✅

The empty skeleton is now a runnable, tested Go daemon (stdlib only, zero external deps —
heron minimalism). Verified with `PHILO_MODE=mock` + Go unit tests; not yet run on the Pi.

- [x] `go.mod` (`module philo-optic`, go 1.24) + real `package main` in `main.go`: HTTP server
  on `PORT` (default 8080), graceful shutdown (SIGINT/SIGTERM), `slog` structured logging.
- [x] **Single-flight capture endpoint** — `GET /frame?maxAgeMs=&timeoutMs=` returns JPEG
  **bytes** + metadata headers (`X-Frame-Id`, `X-Captured-At`, `X-Attempts`). Serves the cached
  last frame if younger than `maxAgeMs` (`0` = force fresh); otherwise joins an in-flight
  capture (shared result/error) or starts one; retries up to `timeoutMs` and counts only a
  **non-empty image** as success (same guard as the TS fix). Hand-rolled (`sync.Mutex` +
  `done chan` `call`) — replaced the drafted semaphore `select`, no external dep.
- [x] **Hexagonal camera backend:** `Capturer` interface (`camera/capturer.go`) with
  `RpicamCapturer` (rpicam-still → temp file → non-empty check → bytes) and `MockCapturer`;
  `gphoto2`/`v4l2` slot in later without touching the service/HTTP layer.
- [x] **Graceful degradation:** capture never `panic()`s (a `recover` in `captureOnce` turns a
  panicking backend into an error); failures are logged and shared with all waiters.
- [x] **Mock backend:** `PHILO_MODE=mock` serves a synthetic, time-varying JPEG (no camera).
- [x] `/health` returns `{status, backend}`.
- [x] `Makefile`: arm64 cross-compile kept; added `mock` (dev run), `test`, `vet`, `fmt`.
- [x] Go unit tests (`camera/service_test.go`): force-fresh, cache reuse, concurrent
  coalescing (20 callers → 1 shutter, shared id), retry-until-success, timeout.

Deferred to Phase 2 / on-Pi: preset/ROI args on `/frame` (Producer passes them), `/status`
(temp/disk), and a real on-Pi run (`systemctl start philo-optic` → capture + mid-capture
coalescing against real rpicam).

**Note for staging:** single-flight means a prod + staging request landing together share the
**same photons** — one shutter, both get the frame. Intended zero-interference, not a bug.

**Exit criteria (dev): met.** `PHILO_MODE=mock` serves `/frame` (valid JPEG), force-fresh gives
distinct frame ids, `maxAgeMs` reuses the cache, and the concurrency test proves coalescing.
Remaining: verify on the Pi against real rpicam.

---

## Phase 2 — Point the bot at philo-optic (delete the TS mutex) — DONE (dev) ✅

`Camera` is now a thin HTTP client of philo-optic; orchestration stays in TS. Verified with the
mock daemon end-to-end (TS `Camera.photo` → daemon → valid JPEG on disk) and full TS + Go suites.

- [x] `Camera.photo(output)` → `POST {PHILO_OPTIC_URL}/frame?maxAgeMs=0&timeoutMs=`, writes the
  returned bytes to `output`. Same throw-on-failure contract (non-ok status or empty body throws)
  so `Timelapse`'s copy-forward loop is unchanged.
- [x] **Deleted `Camera.#mutex`** — the daemon serialises the device (single-flight per args +
  global device lock). `busy` now just tracks the in-flight request (for `Timelapse.stop`), it no
  longer throws "Camera is busy".
- [x] **Preset/ROI preserved without duplication:** extracted `buildStillArgs()` in
  `libcamera-still.ts` (single source of truth for rpicam args, `--nopreview`, defaults, minus
  `--output`); `Camera` forwards `buildStillArgs(this.options)` as `{ "args": [...] }`. Daemon is
  a generic executor; single-flight is keyed by args so different presets don't share a frame,
  and the global device lock still guarantees one shutter at a time.
- [x] `CameraStub` unaffected (overrides `photo`, no network).
- [x] Config: `PHILO_OPTIC_URL` (default `http://localhost:8080`), `PHILO_OPTIC_TIMEOUT_MS`
  (default 4000).
- [ ] Deferred: `/preview`/`/photo` passing a non-zero `maxAgeMs` (mid-timelapse preview reuse) —
  currently every `Camera.photo` uses `maxAgeMs=0`. Small refinement, do when wiring preview UX.
- [ ] Deferred: optional direct-rpicam fallback if the daemon is down (kept simple; `StillCamera`
  + `buildStillArgs` remain, so a fallback is a small addition later).

**Exit criteria (dev): met.** `Camera.#mutex` gone; presets forwarded; end-to-end mock capture
writes a valid JPEG. Remaining: run a full sunset through philo-optic on the Pi (real rpicam),
which also covers the mid-timelapse-preview coalescing behaviour.

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

## Full publishing (epic — later)

The content lifecycle is **private capture → Telegram moderation → public on demand**. Today
capture + the Telegram preview/appraisal loop exist; the "go public" step is stubbed
(`Publisher.publish` is a TODO, `markupRowPublish` is commented out).

- [ ] **Private by default.** Daily/event repos are private backups (done in Phase 0 via
  `setupBackupRepo`). Nothing is public until a human approves it.
- [ ] **Moderate in Telegram.** The existing likes / cloud-study / share flow is the review
  surface. A run is only publishable after it has been looked at.
- [ ] **Publish button → GitHub Pages.** Wire `markupRowPublish` + `Publisher.publish`: make the
  repo public, run `makeTimelapsePage` (readme + index.html + ffmpeg action), `enablePages`.
  `setupPublicRepo` / `Repository` already have most of the pieces.
- [ ] **Higher video quality for published renders.** The Telegram preview can stay a quick,
  low-overhead stitch; the *published* render should be higher quality (resolution / crf /
  framerate). Decide the published-render profile separately from the preview.
- [ ] **Use GitHub Actions compute for the public render.** Instead of rendering high-quality on
  the Pi, let the repo's ffmpeg Action (`ffmpegActionString`) do the heavy render in CI on
  publish — offloads the edge node and matches "compute in GitHub pipelines". The Pi only needs
  the quick preview render locally.
- [ ] Relationship to the throwback: the "one year ago" post is a *preview-quality* memory in
  Telegram; if the user then hits publish, it follows this same public-on-demand path.

---

## Inventory & Gallery (epic — later)

Philo needs one source of truth for **what he has captured** and a public **gallery** of what has
been published. Much of the inventory already exists; the gallery is greenfield.

**Inventory** (extend `PublicationInventory` + `Stakeholder`):

- [ ] **One source of truth.** Yearly `publications-YYYY.json` / `appraisals-YYYY.json` already
  track drafts, shares, likes, and cloud-study ratings. Consolidate the two "list unpublished"
  implementations (`Stakeholder.checkPublications` vs. the inline `/publications` in
  `photoStage.ts`) onto `Stakeholder` so there is a single query path.
- [ ] **Enrich each entry with health + provenance:** frame count, missing/repaired frames (from
  `getMissingFrames`), backup locations (private GitHub repo / Phedora / Glacier), and lifecycle
  state (draft → moderated → published). This is what the repair pass and the gallery both read.
- [ ] **Make it queryable:** "which runs have holes?", "which are unpublished?", "what did we
  shoot in month X?", "what is publishable?" — the shared basis for repair, throwback, and gallery.

**Gallery** (public presentation of published works):

- [ ] **Aggregate index of published events** (never the private backups) — by year/month, each
  with a thumbnail + link to that timelapse's GitHub Pages video. Only published items appear, so
  it respects the private-by-default model.
- [ ] **Generated from the inventory** (published entries): a top-level GitHub Pages "gallery"
  repo rebuilt on each publish, or a static site pushed to Phedora. Reuses `indexString`/Pages
  machinery already in `Repository`.
- [ ] **Thumbnails / deltas:** a small preview per entry (a representative frame or a short gif)
  so the gallery is browsable without loading full videos — also what Matrix C2 would post.
- [ ] Feeds: the publish button (Full publishing epic) adds an entry; the throwback can surface
  "on this day" entries; both draw from the same inventory.

---

## "One year ago today" — daily throwback + on-the-fly repair (Stakeholder)

The heron remembers. Each day, Philo re-posts the timelapse from the same date **last year** as
a memory in Telegram — repairing it first if the dropped-frames bug left holes. This reuses
almost everything that already exists (`downloadBackups`, `Stakeholder.fixFrames`,
`stitchImages`, `redraftByName`, `fs.destroy`) and it heals the archive as a side effect.

Daily pipeline (one date at a time, ephemeral on disk):

- [ ] **Pick the date & find the repo.** Today − 1 year → look for that day's event repo on
  GitHub. Naming evolves across eras (`sunset-YYYY-MM-DD`, and the atomic
  `timelapse-sunset-YYYY-MM-DD--HH-mm`); reuse `downloadBackups.ts`' enumeration/clone logic.
  Gracefully **skip** dates with no run (clone fails → catch → nothing to post).
- [ ] **Shallow-pull the frames.** `git clone --depth 1` gives the final tree = all frames
  present (they were committed per-frame, but HEAD has the full set). ~540 jpgs / ~1–2 GB.
- [ ] **Detect holes.** `dir.list()` → derive prefix + counter length → find interior gaps.
  **Prefer inferring the expected count from the highest frame present** rather than a fixed
  540 — the count/interval differed across eras, and holes are by definition *interior*
  (between frame 1 and the max), so range-based detection is robust and sidesteps 540-vs-541.
- [ ] **Repair if needed.** `fixFrames` copies the previous good frame into each hole (a filled
  frame is a duplicate — fine per SOUL, but log each one). If no holes, skip straight to render.
- [ ] **Re-render locally** with `stitchImages` (ffmpeg) → a gap-free MP4. (The GitHub Action's
  original render is truncated at the first hole, which is exactly why we re-render.)
- [ ] **Post to Telegram** as a memory, e.g. caption "🕰️ Vor einem Jahr — {date}". Extend the
  existing `Stakeholder.redraft*` (which already builds an animation message from an MP4).
- [ ] **Clean up.** `fs.destroy(folder)` deletes the local clone so the Pi never fills up.
- [ ] **Scheduling.** A daily timer (hang off `Director.scheduleSunset`, or a separate ticker /
  the future Redis/BullMQ `media:timelapse` job). Keep it sequential and quiet (heron).

Open choices:

- [x] **Heal the GitHub backup (decided).** When a date is repaired, **push the filled frames
  back** to its private backup repo before deleting the local clone. The hole is then gone for
  good: the backup is complete again and future throwbacks of that date need no repair. The local
  clone is still deleted afterwards (the fix lives in the private repo, not on the Pi).
- [x] **Fill every hole from the nearest neighbour (decided).** Repair copies the **previous**
  good frame into interior/trailing holes and, for a **leading** gap (frame 1..k missing before
  the first real frame — we have such a case), copies the **next** existing frame *backwards*.
  This also covers **multiple consecutive** missing frames — each is filled from its nearest
  neighbour. So any run with ≥1 real frame heals completely; only a totally empty run is
  unrepairable. Extend `Stakeholder.fixFrames` (currently previous-only, breaks on a missing
  frame 1) to fall back to the next frame when there is no predecessor. NB: this is the *repair*
  path; the *live* loop still retries frame 1 in place, since during capture no later frame
  exists yet.
- [ ] **One-off mass repair** is just this pipeline run over a date range instead of one day —
  useful to heal the whole Sep 2025 – Jun 2026 backlog in one pass (with a dry-run mode first).

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

Parallel/independent track (no dependency on the Go work): the **"one year ago today"** daily
throwback + on-the-fly repair via Stakeholder — reuses existing download/repair/stitch/redraft,
heals the archive as a side effect, and can ship any time.
