import { describe, it, expect } from 'vitest';
import { Injector } from '@joist/di';
import type { Provider } from '@joist/di';
// Import directly (not via services/index barrel) to avoid the Director -> moveBackups
// -> index circular import, which otherwise TDZ-crashes under Vite.
import { Camera } from './services/Camera.js';
import { Logger } from './services/Logger.js';
import { Timelapse } from './services/Timelapse.js';
import { rendererStubProvider } from './services/TimelapseVideoRendererStub.js';

/**
 * Regression tests for the dropped-frames fix (see docs/dropped-frames-investigation.md)
 * plus Philo's SOUL capture policy (see SOUL.md / PLAN.md).
 *
 * On a failed capture the loop must keep its rhythm and never leave a hole (ffmpeg truncates
 * a numbered sequence at the first gap):
 *  - a frame that fails is filled by COPYING the previous good frame, and the run continues;
 *  - up to 5 such copies in a row are tolerated (a real capture resets the streak);
 *  - only a camera blind for >5 frames in a row ends the run with an error;
 *  - frame 1 has no predecessor to copy, so it is retried in place instead.
 *
 * We drive Timelapse with a fake Camera whose `photo()` outcome is scripted per call.
 * `stitch=false` keeps ffmpeg out; a fake Directory records copies instead of touching disk.
 * Real (tiny) intervals are used and the run is awaited via its own events, so the test
 * verifies capture *logic* without depending on fake-timer control of the drift loop.
 */

type Outcome = 'ok' | 'fail';

function setup(outcomes: Outcome[]) {
  const state = { calls: 0 };
  const cameraProvider: Provider<Camera> = [
    Camera,
    {
      factory() {
        return new (class extends Camera {
          async photo(output: string) {
            const outcome = outcomes[state.calls] ?? 'ok';
            state.calls++;
            if (outcome === 'fail') {
              // mirrors StillCamera.takeImage's "no file landed" failure
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
  timelapse.intervalMS = 1; // tiny real interval (the >=1500 guard only runs in the constructor)
  return { timelapse, state };
}

// Timelapse needs `join` (frame path), `joinAbsolute` + `copyFile` (gap-fill copy), and `path`.
// The fake records copies as (dest) so a gap-fill is observable without touching disk.
function fakeDir() {
  const copies: string[] = [];
  const dir = {
    join: (n: string) => n,
    joinAbsolute: (n: string) => n,
    copyFile: async (_source: string, name: string) => {
      copies.push(name);
    },
    path: '.',
  } as never;
  return { dir, copies };
}

async function run(timelapse: Timelapse, dir = fakeDir()) {
  const files: string[] = [];

  const events = timelapse.shoot(dir.dir, dir.dir, 0, false); // stitch=false
  events.on('file', (name: string) => files.push(name));

  const ended = await new Promise<'captured' | 'error'>((resolve) => {
    events.once('captured', () => resolve('captured'));
    events.once('error', () => resolve('error'));
  });
  return { files, ended, copies: dir.copies };
}

describe('Timelapse capture loop', () => {
  it('fills a single failed frame by copying the previous one (no gap)', async () => {
    const { timelapse, state } = setup(['ok', 'ok', 'fail', 'ok', 'ok']); // frame 3 fails once
    timelapse.count = 5;

    const { files, ended, copies } = await run(timelapse);

    expect(ended).toBe('captured');
    expect(files).toEqual(['f-1.jpg', 'f-2.jpg', 'f-3.jpg', 'f-4.jpg', 'f-5.jpg']);
    expect(copies).toEqual(['f-3.jpg']); // f-2 copied into f-3's slot
    expect(state.calls).toBe(5); // one capture attempt per frame; the failure is filled, not retried
  });

  it('keeps going through several scattered failures without ever aborting', async () => {
    const { timelapse } = setup([
      'ok', // f1
      'fail', // f2 -> copy f1
      'ok', // f3
      'fail', // f4 -> copy f3
      'ok', // f5
      'fail', // f6 -> copy f5
      'ok', // f7
      'fail', // f8 -> copy f7
    ]);
    timelapse.count = 8;

    const { files, ended, copies } = await run(timelapse);

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
    expect(copies).toEqual(['f-2.jpg', 'f-4.jpg', 'f-6.jpg', 'f-8.jpg']);
  });

  it('retries frame 1 in place (no predecessor to copy)', async () => {
    const { timelapse, state } = setup(['fail', 'ok', 'ok', 'ok']); // frame 1 fails once, then ok
    timelapse.count = 3;

    const { files, ended, copies } = await run(timelapse);

    expect(ended).toBe('captured');
    expect(files).toEqual(['f-1.jpg', 'f-2.jpg', 'f-3.jpg']);
    expect(copies).toEqual([]); // nothing to copy for frame 1
    expect(state.calls).toBe(4); // frame 1 retried once
  });

  it('aborts only after >5 blind frames in a row (copies up to five, then gives up)', async () => {
    // frame 3 onward the camera is blind: 5 copies get made, the 6th failure ends the run.
    const { timelapse } = setup([
      'ok',
      'ok',
      'fail',
      'fail',
      'fail',
      'fail',
      'fail',
      'fail',
    ]);
    timelapse.count = 10; // two-digit padding: f-01.jpg ...

    const { files, ended, copies } = await run(timelapse);

    expect(ended).toBe('error');
    expect(files).toEqual([
      'f-01.jpg',
      'f-02.jpg',
      'f-03.jpg',
      'f-04.jpg',
      'f-05.jpg',
      'f-06.jpg',
      'f-07.jpg',
    ]);
    expect(copies).toEqual(['f-03.jpg', 'f-04.jpg', 'f-05.jpg', 'f-06.jpg', 'f-07.jpg']); // five copies
  });
});
