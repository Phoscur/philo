import { inject, injectable } from '@joist/di';
import { writeFile } from 'node:fs/promises';
import { Logger } from './Logger.js';
import { buildStillArgs } from '../lib/libcamera-still.js';

import type { StillOptions } from '../lib/libcamera-still.js';
export type { StillOptions } from '../lib/libcamera-still.js';

const OPTIC_URL = process.env.PHILO_OPTIC_URL || 'http://localhost:8080';
const CAPTURE_TIMEOUT_MS = Number(process.env.PHILO_OPTIC_TIMEOUT_MS) || 4000;

/**
 * Camera is a thin client of the philo-optic daemon (Philo's eyes). It no longer touches
 * the hardware: `photo()` asks the daemon for a frame over HTTP and writes the returned
 * JPEG bytes to `output`. The daemon owns the device and serialises captures (single-flight
 * + device lock), so the old in-process `#mutex` is gone. Preset/ROI options are forwarded
 * as ready-made rpicam args via {@link buildStillArgs} (single source of truth).
 */
@injectable()
export class Camera {
  #logger = inject(Logger);

  options: StillOptions = {
    roi: '', // x,y,w,h
  };

  baseUrl = OPTIC_URL;

  // Tracks the in-flight capture so a caller (e.g. Timelapse.stop) can await it. This is
  // NOT a lock: the daemon serialises the device, so overlapping requests are allowed.
  #inflight: Promise<string> | false = false;
  get busy() {
    return this.#inflight;
  }

  async photo(output: string) {
    const p = this.#capture(output);
    this.#inflight = p;
    try {
      return await p;
    } finally {
      this.#inflight = false;
    }
  }

  async #capture(output: string): Promise<string> {
    const logger = this.#logger();
    logger.time('photo');
    try {
      // maxAgeMs=0: every capture is a fresh frame (timelapse frames must be distinct).
      const url = `${this.baseUrl}/frame?maxAgeMs=0&timeoutMs=${CAPTURE_TIMEOUT_MS}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ args: buildStillArgs(this.options) }),
        // client-side guard slightly beyond the daemon's own capture timeout
        signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS + 2000),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`philo-optic /frame ${res.status}: ${detail}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      // Same guard as before: an empty frame is a failed capture, not a success.
      if (!buf.length) {
        throw new Error('philo-optic returned an empty frame');
      }
      await writeFile(output, buf);
      logger.timeLog('photo', 'frame written', output);
      return output;
    } catch (e) {
      logger.timeLog('photo', 'error', e);
      throw e;
    } finally {
      logger.timeEnd('photo');
    }
  }
}
