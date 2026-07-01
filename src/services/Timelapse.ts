import { inject, injectable } from '@joist/di';
import { setTimeout } from 'node:timers/promises'; // Native promise-based timeout
import EventEmitter from 'node:events';
import { Logger } from './Logger.js';
import { Camera } from './Camera.js';
import { stitchImages, StitchOptions } from '../lib/ffmpeg.js';
import { Directory } from './FileSystem.js';

export interface TimelapseEventMap {
  started: [];
  file: [photoFileName: string, photoDir: Directory];
  captured: [];
  frame: [frame: string, fps: string];
  rendered: [videoFileName: string, videoDir: Directory];
  stopped: [photoDir: Directory];
  error: [any];
}

/**
 * Renders a video from a series of images with ffmpeg
 */
export class VideoRenderer {
  async stitchImages(
    name: string,
    cwd: string,
    options: StitchOptions = {},
    inFolder: string = '.',
    outFolder: string = '.',
    onData = (_frame: string, _fps: string) => {},
    logger = { log: console.log }
  ) {
    return stitchImages(name, cwd, options, inFolder, outFolder, onData, logger);
  }
}

/**
 * Timelapse taken one frame at a time with the Camera service
 * Manual interval capture (rpicam may crash beyond 370 frames) with Drift-Corrected Sleep
 */
@injectable()
export class Timelapse {
  #logger = inject(Logger);
  #cam = inject(Camera);
  #renderer = inject(VideoRenderer);

  constructor(public count = 420, public intervalMS = 2000) {
    if (intervalMS < 1500) {
      throw new Error(
        'Interval must be at least 1.5 seconds, for the camera to be able to write the file'
      );
    }
  }

  namePrefix = 'timelapse-test';

  get name() {
    const len = this.count.toString().length;
    return `${this.namePrefix}-%0${len}d`;
  }

  getFrameName(i: number) {
    return `${this.namePrefix}-${this.padZero(i.toString(), this.count.toString().length)}`;
  }

  get output() {
    return `${this.namePrefix}.mp4`;
  }

  get prettyOptions() {
    const { intervalMS, count } = this;
    const duration = `Duration: ~${((count * intervalMS) / 60 / 1000).toFixed(1)}min(s) -`;
    const minutely = intervalMS ? `images per minute: ~${(60000 / intervalMS).toFixed(1)}` : '';
    const interval = intervalMS ? `- Milliseconds between images: ${intervalMS}` : '';
    const c = count ? `- Total image count: ${count}` : '';
    return `${duration} ${minutely}\n${interval}\n${c}`;
  }

  padZero(s: string, length: number): string {
    return s.length >= length ? s : this.padZero('0' + s, length);
  }

  // Replaced #intervalId with a generic AbortController for the loop
  #abortController: AbortController | undefined = undefined;

  shoot(photoDir: Directory, videoDir: Directory, sleepMS = 0, stitch = true) {
    const logger = this.#logger();
    const camera = this.#cam();
    const renderer = this.#renderer();

    logger.time('timelapse');
    const events = new EventEmitter<TimelapseEventMap>();

    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    const stop = () => {
      signal.removeEventListener('abort', stop);
      logger.timeEnd('timelapse');
      return events.emit('stopped', photoDir);
    };
    signal.addEventListener('abort', stop);

    // THE MAIN LOOP
    const runLoop = async () => {
      try {
        // Initial start delay (if requested)
        if (sleepMS > 0) {
          await setTimeout(sleepMS, undefined, { signal });
        }

        logger.timeLog('timelapse', 'Start with options:\n', this.prettyOptions);
        events.emit('started');

        const startTime = Date.now();
        let frame = 1;
        let attempt = 0; // intervals elapsed; advances per attempt so retries don't corrupt the schedule
        let consecutiveFails = 0; // reset on success; a run only aborts after >5 blind frames in a row
        let totalErrors = 0; // whole-run tally, just for the log so failures can be quantified

        // Loop until count reached or aborted
        while (frame <= this.count && !signal.aborted) {
          // 1. Metric: how late did this attempt start vs its scheduled slot?
          const targetTime = startTime + attempt * this.intervalMS;
          const startLag = Date.now() - targetTime;
          if (startLag > 100) {
            logger.log(
              `[Metric] Frame ${frame} started ${startLag}ms late (CPU/Event Loop busy?!)`
            );
          }

          // 2. Capture. camera.photo() throws if rpicam wrote no file (see libcamera-still),
          //    so a silent failure becomes a real error instead of a hole.
          let captured = false;
          const fileName = `${this.getFrameName(frame)}.jpg`;
          try {
            logger.timeLog('timelapse', 'frame', frame, 'of', this.count);

            // This await holds the loop. No overlapping calls possible.
            await camera.photo(photoDir.join(fileName));

            logger.timeLog('timelapse', 'frame', fileName, 'captured');

            if (signal.aborted) break;
            events.emit('file', fileName, photoDir);
            consecutiveFails = 0; // a real file landed, so the frame is good
            captured = true;
          } catch (error: any) {
            // Graceful degradation (SOUL): never abort on a hiccup. Tolerate up to 5 blind
            // frames in a row; only a camera that stays blind beyond that ends the run.
            consecutiveFails++;
            totalErrors++;
            if (consecutiveFails > 5) {
              logger.log(
                `Frame [${frame}] failed ${consecutiveFails} times in a row ` +
                  `(${totalErrors} total this run) - the eye is blind, aborting: ${error?.message}`
              );
              events.emit('error', error);
              this.#abortController?.abort();
              break;
            }
            if (frame > 1) {
              // Fill the gap with the previous good frame so the sequence stays gap-free
              // (ffmpeg truncates a numbered sequence at the first hole) and the rhythm
              // continues. A single repeated frame is invisible in a timelapse.
              const prevName = `${this.getFrameName(frame - 1)}.jpg`;
              await photoDir.copyFile(photoDir.joinAbsolute(prevName), fileName);
              logger.log(
                `Frame [${frame}] capture failed (#${consecutiveFails} in a row, ` +
                  `${totalErrors} total this run) - copied previous frame to keep the rhythm: ${error?.message}`
              );
              events.emit('file', fileName, photoDir);
              captured = true; // gap filled, advance to the next frame
            } else {
              // Frame 1 has no predecessor to copy - retry the same frame next tick.
              logger.log(
                `Frame [1] capture failed (#${consecutiveFails} in a row) - retrying same frame: ${error?.message}`
              );
            }
          }

          // 3. Advance when the frame landed (captured or gap-filled); otherwise retry it.
          if (captured) {
            frame++;
            if (frame > this.count) break;
          }

          // 4. Drift-Corrected Sleep. The schedule clock advances one interval per
          //    attempt (success or retry), so a retry waits a full interval rather than
          //    hammering the camera, while a slow capture still gets caught up on.
          attempt++;
          const nextTarget = startTime + attempt * this.intervalMS;
          const delay = nextTarget - Date.now();
          if (delay > 0) {
            // Wait for the remaining time in the interval
            await setTimeout(delay, undefined, { signal });
          } else {
            // We are lagging behind! Loop immediately to catch up.
            logger.log(`[Drift] Lagging by ${Math.abs(delay)}ms - skipping sleep`);
          }
        }

        // Loop finished normally or aborted
        if (!signal.aborted) {
          events.emit('captured');
        }
      } catch (err: any) {
        if (err.code === 'ABORT_ERR') {
          // Expected if we abort during setTimeout
          // stop() listener will handle the event emit
        } else {
          events.emit('error', err);
        }
      }
    };

    // Start the loop asynchronously
    runLoop();

    // Stitching Logic (mostly unchanged, just attached to 'captured')
    if (!stitch) {
      return events;
    }

    events.once('captured', async () => {
      if (signal.aborted) return; // Don't stitch if we stopped

      try {
        logger.timeLog('timelapse', 'render', 'started');
        await renderer.stitchImages(
          this.namePrefix,
          videoDir.fs.cwd,
          { parts: this.count },
          photoDir.path,
          videoDir.path,
          (frameProcessed: string, fps: string) => {
            events.emit('frame', frameProcessed, fps);
          },
          logger
        );
        logger.timeLog('timelapse', 'render', 'finished');
        events.emit('rendered', this.output, videoDir);
      } catch (error) {
        events.emit('error', error);
      } finally {
        this.#abortController?.abort(); // Cleanup listeners
      }
    });

    return events;
  }

  stop() {
    this.#abortController?.abort();
    return this.#cam().busy;
  }
}
