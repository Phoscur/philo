import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Injector } from '@joist/di';
import type { Provider } from '@joist/di';
// Import directly (not via services/index barrel) to avoid the Director -> moveBackups
// -> index circular import, which otherwise TDZ-crashes under Vite.
import { Camera } from './services/Camera.js';
import { Logger } from './services/Logger.js';
import { Timelapse } from './services/Timelapse.js';
import { rendererStubProvider } from './services/TimelapseVideoRendererStub.js';

/**
 * Regression tests for the dropped-frames fix (see docs/dropped-frames-investigation.md).
 *
 * The capture loop must:
 *  - retry the SAME frame number on a failed capture (so a hiccup leaves no hole), and
 *  - only abort on >3 CONSECUTIVE failures (a stuck camera), NOT on a handful of scattered
 *    failures across a run (the old cumulative `errors > 3` would truncate the whole run).
 *
 * We drive Timelapse with a fake Camera whose `photo()` outcome is scripted per call, so we
 * can simulate flaky captures deterministically. `stitch=false` keeps ffmpeg/FileSystem out.
 */

type Outcome = 'ok' | 'fail';

function setup(outcomes: Outcome[]) {
  const state = { calls: 0 };
  const cameraProvider: Provider<Camera> = [
    Camera,
    {
      factory() {
        return new (class extends Camera {
          name = 'f';
          get filename() {
            return `${this.name}.jpg`;
          }
          async photo(output = this.filename) {
            const outcome = outcomes[state.calls] ?? 'ok';
            state.calls++;
            if (outcome === 'fail') {
              // mirrors StillCamera.takeImage's new "no file landed" failure
              throw new Error('rpicam-still produced no output file');
            }
            return output;
          }
        })();
      },
    },
  ];
  // keep the console quiet during the run
  const silentLogger: Provider<Logger> = [Logger, { factory: () => new Logger() }];

  const injector = new Injector({
    providers: [silentLogger, cameraProvider, rendererStubProvider],
  });
  const timelapse = injector.inject(Timelapse);
  timelapse.namePrefix = 'f';
  timelapse.intervalMS = 20;
  return { timelapse, state };
}

// Timelapse only needs `join` (to build the frame path) and is otherwise passed straight through.
const fakeDir = { join: (n: string) => n, path: '.' } as never;

async function run(timelapse: Timelapse) {
  const files: string[] = [];
  let ended: 'captured' | 'error' | null = null;

  const events = timelapse.shoot(fakeDir, fakeDir, 0, false); // stitch=false
  events.on('file', (name: string) => files.push(name));
  events.once('captured', () => (ended = 'captured'));
  events.once('error', () => (ended = 'error'));

  for (let i = 0; i < 80 && !ended; i++) {
    await vi.advanceTimersByTimeAsync(20);
  }
  return { files, ended };
}

describe('Timelapse capture loop', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('retries the same frame on failure and leaves no gap', async () => {
    const { timelapse, state } = setup(['ok', 'ok', 'fail', 'ok', 'ok', 'ok']); // frame 3 fails once
    timelapse.count = 5;

    const { files, ended } = await run(timelapse);

    expect(ended).toBe('captured');
    expect(files).toEqual(['f-1.jpg', 'f-2.jpg', 'f-3.jpg', 'f-4.jpg', 'f-5.jpg']);
    expect(state.calls).toBe(6); // 5 frames + 1 retry
  });

  it('does NOT abort for several non-consecutive failures (regression: was cumulative)', async () => {
    // 4 total failures, never more than 1 in a row. The old cumulative `errors > 3`
    // would have aborted the run before the end, truncating it.
    const { timelapse } = setup([
      'ok', // f1
      'fail', 'ok', // f2
      'ok', // f3
      'fail', 'ok', // f4
      'ok', // f5
      'fail', 'ok', // f6
      'ok', // f7
      'fail', 'ok', // f8
    ]);
    timelapse.count = 8;

    const { files, ended } = await run(timelapse);

    expect(ended).toBe('captured');
    expect(files).toEqual([
      'f-1.jpg',
      'f-2.jpg',
      'f-3.jpg',
      'f-4.jpg',
      'f-5.jpg',
      'f-6.jpg',
      'f-7.jpg',
      'f-8.jpg',
    ]);
  });

  it('aborts with an error only after >3 CONSECUTIVE failures (stuck camera)', async () => {
    const { timelapse } = setup(['ok', 'ok', 'fail', 'fail', 'fail', 'fail']); // frame 3 stuck
    timelapse.count = 6;

    const { files, ended } = await run(timelapse);

    expect(ended).toBe('error');
    expect(files).toEqual(['f-1.jpg', 'f-2.jpg']); // stopped at the stuck frame, nothing after
  });
});
