import { inject, injectable } from '@joist/di';
import { EventEmitter } from 'node:events';
import { Repository } from './Repository.js';
import { Logger } from './Logger.js';
import { Camera } from './Camera.js';
import { TimelapseEventMap, Timelapse } from './Timelapse.js';
import { Preset } from './Preset.js';
import { FileSystem } from './FileSystem.js';
import { SunMoonTime } from './SunMoonTime.js';

/**
 * In charge of directing captures and timelapses, and managing the repositories.
 * The director is busy orchestrating and NOT publishing (Telegram, Discord) or post-producing the content (on Github)
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
  static yyyymmdd(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  get nameToday() {
    return Director.yyyymmdd(this.#time);
  }

  /** YYYY-MM slice from ISO */
  get nameMonth() {
    return this.#time.toISOString().slice(0, 7);
  }

  /** YYYY-MM-DD--HH-mm date string */
  get nameNow() {
    return `${this.nameToday}--${this.#time.toISOString().slice(11, 16).replace(':', '-')}`;
  }

  get repoPhoto() {
    return `${this.repoPhotoPrefix}`;
  }
  get repoTimelapse() {
    return `${this.repoTimelapsePrefix}-${this.nameToday}`;
  }
  get repoTimelapseStitched() {
    return `${this.repoTimelapsePrefix}-${this.nameMonth}`;
  }
  get repoSunset() {
    return `${this.repoSunsetPrefix}-${this.nameToday}`;
  }
  get repoSunsetStitched() {
    return `${this.repoSunsetPrefix}-${this.nameMonth}`;
  }

  resetTime() {
    this.#time = new Date();
    this.#sunMoonTime().resetToday(this.#time);
  }

  async setupPublicRepo(name: string) {
    const repo = this.#repo();
    const r = await repo.create(name, false);
    await r.addReadme();
    return r;
  }

  async setupPrivateRepo(name: string) {
    const repo = this.#repo();
    return repo.create(name, true);
  }

  async photo(presetName: string) {
    const logger = this.#logger();
    const camera = this.#camera();
    const preset = this.#preset();
    const fs = this.#fs();

    const dir = await fs.createDirectory(this.repoPhoto);

    preset.setupPreset(presetName);
    camera.name = this.nameNow;
    const { filename } = camera;
    const co = await camera.photo(dir.join(filename));
    logger.log('Photo captured, libcamera output:\n- - -', co, '\n- - -');

    return {
      filename,
      dir,
    };
  }

  async timelapse(
    presetName: string,
    options: { count: number; intervalMS: number; prefix?: string },
    outFolder = this.repoTimelapseStitched,
    sleepMS = 0
  ) {
    const fs = this.#fs();
    const timelapse = this.#timelapse();
    const preset = this.#preset();

    const photoDir =
      presetName === 'sunset'
        ? await fs.createDirectory(this.repoSunset)
        : await fs.createDirectory(this.repoTimelapse);
    const videoDir = await fs.createDirectory(outFolder);

    preset.setupPreset(presetName);
    timelapse.count = options.count;
    timelapse.intervalMS = options.intervalMS;
    timelapse.namePrefix = options.prefix ?? presetName + this.nameNow;
    return timelapse.shoot(photoDir, videoDir, sleepMS);
  }

  cancel() {
    return this.#timelapse().stop();
  }

  #sunsetTimeout: NodeJS.Timeout | undefined;
  scheduleSunset(onStart: (events: EventEmitter<TimelapseEventMap>) => void) {
    //if (!this.enableSunsetTimelapse) return;
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
        const events = await this.timelapse(
          'sunset',
          {
            count: this.dailySunsetFrameCount,
            intervalMS: this.dailySunsetTimelapseIntervalMS,
            prefix: 'sunset-timelapse-' + this.nameNow,
          },
          this.repoSunsetStitched,
          messageDelayMS
        );
        onStart(events);
      } catch (error) {
        console.error(`Failed timelapse: ${error}`);
        logger.log('Sunset Timelapse Error:', error);
      }
      this.#sunsetTimeout = setTimeout(sundownTimer, rescheduleDelayMS + rescheduleRepeatDelayMS);
    };
    this.#sunsetTimeout = setTimeout(sundownTimer, rescheduleDelayMS);
  }

  cancelSunset() {
    clearTimeout(this.#sunsetTimeout);
    return this.#timelapse().stop();
  }
}
