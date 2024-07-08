import { inject, injectable } from '@joist/di';
import { Logger } from './Logger.js';
import { Camera } from './Camera.js';
import stitchImages from '../lib/ffmpeg.js';
@injectable
export class Timelapse {
  #logger = inject(Logger);
  #cam = inject(Camera);

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
  #stopFlag = false;
  async shoot(
    { cwd, inFolder, outFolder }: { cwd: string; inFolder: string; outFolder: string },
    onFile = (filename: string) => {}
  ) {
    const logger = this.#logger();
    const camera = this.#cam();

    // manual interval capture (so libcamera won't crash beyond 370 frames)
    await new Promise<void>((resolve, reject) => {
      logger.time('timelapse');
      logger.timeLog('timelapse', 'Start with options:\n', this.prettyOptions);
      let frame = 1;
      let errors = 0;
      const stop = () => {
        logger.timeEnd('timelapse');
        clearInterval(this.#intervalId);
        this.#stopFlag = false;
      };
      this.#intervalId = setInterval(
        () =>
          (async () => {
            try {
              if (this.#stopFlag) {
                stop();
                return resolve();
              }
              camera.name = this.getFrameName(frame);
              logger.timeLog('timelapse', 'frame', frame, 'of', this.count);
              await camera.photo();
              logger.timeLog('timelapse', 'frame', frame, 'captured');
              onFile(camera.filename);

              if (frame >= this.count) {
                stop();
                return resolve();
              }
              frame++;
            } catch (error: any) {
              errors++;
              logger.log(`Frame [${frame}] Error: ${error?.message}`);
              if (errors > 3) {
                logger.log('Too many errors, stopped timelapse!');
                stop();
                reject(error);
              }
            }
          })(),
        this.intervalMS
      );
    });

    await stitchImages(this.namePrefix, cwd, { parts: this.count }, inFolder, outFolder);
    return this.output;
  }
  stop() {
    this.#stopFlag = true;
    // shoot promise will still resolve (or reject)
    return this.#cam().busy;
  }
}
