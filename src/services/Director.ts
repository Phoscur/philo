import { inject, injectable } from '@joist/di';
import { Repository } from './Repository.js';
import { Logger } from './Logger.js';
import { Camera } from './Camera.js';
import { Timelapse } from './Timelapse.js';
import { Preset } from './Preset.js';
import { FileSystem } from './FileSystem.js';
import { SunMoonTime } from './SunMoonTime.js';
import { on } from 'events';

/**
 * In charge of directing captures and timelapses, and managing the repositories.
 * Holds the mutex to access the camera (TODO? move it to the camera service?).
 */
@injectable
export class Director {
  #logger = inject(Logger);
  #fs = inject(FileSystem);
  #repo = inject(Repository);
  #camera = inject(Camera);
  #preset = inject(Preset);
  #timelapse = inject(Timelapse);
  #sunMoonTime = inject(SunMoonTime);

  #cameraMutex = false;
  #time = new Date();

  constructor(
    readonly repoPhotoPrefix = `${process.env.FOLDER_PREFIX_PHOTO}`,
    readonly repoTimelapsePrefix = `${process.env.FOLDER_PREFIX_TIMELAPSE}`,
    readonly repoSunsetPrefix = `${process.env.FOLDER_PREFIX_SUNSET_DAILY}`,
    readonly timezone = `${process.env.LOCATION_TIMEZONE}`
  ) {}

  /** YYYY-MM-DD slice from ISO */
  get today() {
    return this.#time.toISOString().slice(0, 10);
  }

  /** YYYY-MM-DD--HH-mm date string */
  get now() {
    return `${this.today}--${this.#time.toISOString().slice(11, 16).replace(':', '-')}`;
  }

  get repoPhoto() {
    return `${this.repoPhotoPrefix}`;
  }
  get repoTimelapse() {
    return `${this.repoTimelapsePrefix}_${this.today}`;
  }
  get repoSunset() {
    return `${this.repoSunsetPrefix}_${this.today}`;
  }

  resetTime() {
    this.#time = new Date();
  }

  async setupPublicRepo(name: string) {
    const repo = this.#repo();
    await repo.setup(name, false);
    await repo.addReadme();
  }

  async setupPrivateRepo(name: string) {
    const repo = this.#repo();
    await repo.setup(name, true);
  }

  async #switchPath(name: string) {
    return this.#fs().setupPath(name);
  }

  async photo(presetName: string) {
    const logger = this.#logger();
    const camera = this.#camera();
    const preset = this.#preset();

    if (this.#cameraMutex) {
      logger.log('Camera is busy, skipping capture');
      return false;
    }
    this.#cameraMutex = true;
    await this.#switchPath(this.repoPhoto); // TODO? init repo?

    preset.setupPreset(presetName);
    const filename = camera.output;
    const p = await camera.photo(filename);
    logger.log('Photo captured:', p);

    this.#cameraMutex = false;
    return {
      filename,
      // TODO use path instead?
      source: this.#fs().readStream(filename) as unknown as NodeJS.ReadableStream,
    };
  }

  async timelapse(
    presetName: string,
    options: { count: number; intervalMS: number; prefix?: string }
  ) {
    const logger = this.#logger();
    const timelapse = this.#timelapse();
    const preset = this.#preset();

    if (this.#cameraMutex) {
      logger.log('Camera is busy, skipping timelapse');
      return false;
    }
    this.#cameraMutex = true;
    if (presetName === 'sunset') {
      await this.#switchPath(this.repoSunset);
    } else {
      await this.#switchPath(this.repoTimelapse);
    }

    preset.setupPreset(presetName);
    await timelapse.shoot(
      options.count,
      options.intervalMS,
      (filename: string) => {},
      (filename: string) => {},
      options.prefix
    );
    logger.log('Timelapse completed');

    this.#cameraMutex = false;
    return true;
  }

  #sunsetTimeout: NodeJS.Timeout | undefined;
  async scheduleSunset(onStart = () => {}, onEnd = () => {}) {
    const sunMoon = this.#sunMoonTime();

    const messageDelayMS = 1000;
    const rescheduleDelayMS = 15000;
    const rescheduleRepeatDelayMS = 60000 * 60 * 14; // 14h (< 24h)
    const goldenHourTimingMS = -60000 * 60 * 1.2; // 1.2 hours before
    const minutelyCount = 5;
    const count = minutelyCount * 110;
    const intervalMS = 12000; // 12s

    const sundownTimer = async () => {
      try {
        let diff = sunMoon.getSunsetDiff() + goldenHourTimingMS;
        if (!diff || diff < 0) {
          console.log('Too late for a timelapse today, scheduling for tomorrow instead!');
          diff = sunMoon.getSunsetDiff(sunMoon.tomorrow) + goldenHourTimingMS;
        }
        await sunMoon.sleep(diff - messageDelayMS);
        onStart();
        await sunMoon.sleep(messageDelayMS);
        await this.timelapse('sunset', { count, intervalMS });
      } catch (error) {
        console.error(`Failed timelapse: ${error}`);
        console.log('Error:', error);
      }
      onEnd();
      this.#sunsetTimeout = setTimeout(sundownTimer, rescheduleDelayMS + rescheduleRepeatDelayMS);
    };
    this.#sunsetTimeout = setTimeout(sundownTimer, rescheduleDelayMS);
  }
  cancelSunset() {
    clearTimeout(this.#sunsetTimeout);
  }
}
