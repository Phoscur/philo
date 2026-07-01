import { describe, it, expect, vi, afterEach } from 'vitest';
import { writeFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Regression test for the dropped-frames fix (see docs/dropped-frames-investigation.md).
 *
 * `spawnPromise` resolves on stdout-close and never checks the exit code, so a failed
 * `rpicam-still` (which writes NO file) still "succeeds". `StillCamera.takeImage` must
 * therefore verify a non-empty output file actually landed and throw otherwise, so the
 * capture loop retries instead of advancing past a hole.
 *
 * We mock the (shared) spawn wrapper to simulate rpicam exiting without writing anything.
 */
vi.mock('./spawn.js', () => ({
  spawnPromise: vi.fn(async () => Buffer.alloc(0)),
}));

import { StillCamera } from './libcamera-still.js';

describe('StillCamera.takeImage output verification', () => {
  const cleanup: string[] = [];
  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  it('throws when rpicam-still "succeeds" but wrote no file', async () => {
    const missing = join(tmpdir(), `philo-missing-${Date.now()}.jpg`);
    const cam = new StillCamera({ output: missing });
    await expect(cam.takeImage()).rejects.toThrow(/produced no output file/);
  });

  it('resolves when a non-empty file is present', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'philo-cap-'));
    cleanup.push(dir);
    const out = join(dir, 'frame.jpg');
    await writeFile(out, Buffer.from([0xff, 0xd8, 0xff, 0xe1])); // jpeg signature

    const cam = new StillCamera({ output: out });
    await expect(cam.takeImage()).resolves.toBeDefined();
  });

  it('does not verify when output goes to stdout ("-")', async () => {
    const cam = new StillCamera({ output: '-' });
    await expect(cam.takeImage()).resolves.toBeDefined();
  });
});
