import { inject, injectable } from '@joist/di';
import { Logger } from './Logger.js';
import { Camera } from './Camera.js';
import { stitchImages, StitchOptions } from '../lib/ffmpeg.js';
import { Directory } from './FileSystem.js';
import EventEmitter from 'node:events';

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

@injectable
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

  #intervalId: NodeJS.Timeout | undefined = undefined;
  #intervalAbortController: AbortController | undefined = undefined;
  shoot(photoDir: Directory, videoDir: Directory, sleepMS = 0, stitch = true) {
    const logger = this.#logger();
    const camera = this.#cam();
    const renderer = this.#renderer();

    // manual interval capture (so libcamera won't crash beyond 370 frames)
    logger.time('timelapse');
    const events = new EventEmitter<TimelapseEventMap>();

    this.#intervalAbortController = new AbortController();
    const { signal } = this.#intervalAbortController;
    const abort = () => {
      clearInterval(this.#intervalId);
      signal.removeEventListener('abort', abort);
      return events.emit('stopped', photoDir);
    };
    signal.addEventListener('abort', abort);

    let frame = 1;
    let errors = 0;
    const intervalCapture = async () => {
      try {
        const name = this.getFrameName(frame);
        camera.name = photoDir.join(name);
        logger.timeLog('timelapse', 'frame', frame, 'of', this.count);
        await camera.photo();
        logger.timeLog('timelapse', 'frame', camera.filename, 'captured');
        camera.name = name; // remove folder from name after capture

        if (signal.aborted) {
          return abort();
        }
        events.emit('file', camera.filename, photoDir);

        if (frame >= this.count) {
          clearInterval(this.#intervalId);
          return events.emit('captured');
        }
        frame++;
      } catch (error: any) {
        logger.log(`Frame [${frame}] Error: ${error?.message}`);
        errors++;
        if (errors > 3) {
          events.emit('error', error);
          abort();
        }
      } finally {
        logger.timeEnd('timelapse');
      }
    };
    setTimeout(() => {
      logger.timeLog('timelapse', 'Start with options:\n', this.prettyOptions);
      events.emit('started');
      this.#intervalId = setInterval(intervalCapture, this.intervalMS);
    }, sleepMS);

    if (!stitch) {
      return events;
    }

    events.once('captured', async () => {
      try {
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
        events.emit('rendered', this.output, videoDir);
      } catch (error) {
        events.emit('error', error);
      }
      signal.removeEventListener('abort', abort);
    });

    return events;
  }

  stop() {
    this.#intervalAbortController?.abort();
    // shoot promise will still resolve (or reject)
    return this.#cam().busy;
  }
}
