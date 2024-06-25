import { inject, injectable } from '@joist/di';
import { Repository } from './Repository.js';
import { Logger } from './Logger.js';
import { Camera } from './Camera.js';
import { Timelapse } from './Timelapse.js';
import { Preset } from './Preset.js';
import { FileSystem } from './FileSystem.js';
import { SunMoonTime } from './SunMoonTime.js';

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
    readonly timezone = `${process.env.LOCATION_TIMEZONE}`,
    readonly repoPhotoPrefix = `${process.env.FOLDER_PREFIX_PHOTO}`,
    readonly repoTimelapsePrefix = `${process.env.FOLDER_PREFIX_TIMELAPSE}`,
    readonly repoSunsetPrefix = `${process.env.FOLDER_PREFIX_DAILY_TIMELAPSE_SUNSET}`,
    readonly enableSunsetTimelapse = process.env.ENABLE_DAILY_TIMELAPSE_SUNSET === 'true',
    readonly dailySunsetFrameCount = Number(process.env.DAILY_TIMELAPSE_SUNSET_FRAME_COUNT),
    readonly dailySunsetTimelapseIntervalMS = Number(process.env.DAILY_TIMELAPSE_SUNSET_INTERVAL_MS)
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
    return `${this.repoTimelapsePrefix}-${this.today}`;
  }
  get repoSunset() {
    return `${this.repoSunsetPrefix}-${this.today}`;
  }

  resetTime() {
    this.#time = new Date();
    this.#sunMoonTime().resetToday(this.#time);
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

  async switchRepo(name: string, checkout = true) {
    if (checkout) await this.#repo().checkout(name);
    return this.#switchPath(name);
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
    camera.fileNamePrefix = this.now;
    const { filename } = camera;
    const co = await camera.photo();
    logger.log('Photo captured, libcamera output:\n- - -', co, '\n- - -');

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

  async enableAndWaitForPages() {
    const repo = this.#repo();
    await repo.makeTimelapsePage();
    const waitMS = 10000;
    await this.#sunMoonTime().sleep(waitMS);
    const checkIterations = 60;
    const delayMS = 5000;
    await repo.enablePages(checkIterations, 'index.html', delayMS);
  }

  #sunsetTimeout: NodeJS.Timeout | undefined;
  async scheduleSunset(onStart = () => {}, onEnd = () => {}) {
    if (!this.enableSunsetTimelapse) return;
    const logger = this.#logger();
    const sunMoon = this.#sunMoonTime();

    // TODO? move to config or preset
    const messageDelayMS = 1000;
    const rescheduleDelayMS = 15000;
    const rescheduleRepeatDelayMS = 60000 * 60 * 14; // 14h (< 24h)
    const goldenHourTimingMS = -60000 * 60 * 1.2; // 1.2 hours before

    const sundownTimer = async () => {
      try {
        this.resetTime();
        let diff = sunMoon.getSunsetDiff(this.#time) + goldenHourTimingMS;
        if (!diff || diff < messageDelayMS) {
          logger.log('Too late for a timelapse today, scheduling for tomorrow instead!');
          diff = sunMoon.getSunsetDiff(sunMoon.addDay(this.#time), this.#time) + goldenHourTimingMS;
        }
        logger.log('Sunset timelapse scheduled in', (diff / 60 / 60000).toFixed(2), 'hours');
        await sunMoon.sleep(diff - messageDelayMS);
        await this.setupPublicRepo(this.repoSunset);
        onStart();
        await sunMoon.sleep(messageDelayMS);
        await this.timelapse('sunset', {
          count: this.dailySunsetFrameCount,
          intervalMS: this.dailySunsetTimelapseIntervalMS,
        });
        await this.enableAndWaitForPages();
      } catch (error) {
        console.error(`Failed timelapse: ${error}`);
        logger.log('Sunset Timelapse Error:', error);
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
