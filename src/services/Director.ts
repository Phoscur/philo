import { inject, injectable } from '@joist/di';
import { EventEmitter } from 'node:events';
import { Repository, Repo } from './Repository.js';
import { Logger } from './Logger.js';
import { Camera } from './Camera.js';
import { TimelapseEventMap, Timelapse } from './Timelapse.js';
import { Preset } from './Preset.js';
import { FileSystem } from './FileSystem.js';
import { SunMoonTime } from './SunMoonTime.js';
import { moveBackups } from '../moveBackups.js';

/**
 * In charge of directing captures and timelapses, and managing the repositories.
 * The director is busy orchestrating and NOT publishing (Telegram, Discord) or post-producing the content (on Github)
 */
@injectable()
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
    // These prefixes now serve as the "Base Type" for the folder name
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

  /** * Unique Timestamp: YYYY-MM-DD--HH-mm
   * This is the key to our unique folders.
   */
  get nameNow() {
    // 2026-01-23T18:45:00.000Z -> 2026-01-23--18-45
    return `${this.nameToday}--${this.#time.toISOString().slice(11, 16).replace(':', '-')}`;
  }

  // Photos can stay in a "Dump" folder or be daily,
  // but usually single shots are less critical to isolate.
  get repoPhoto() {
    return `${this.repoPhotoPrefix}`; // e.g., "photos"
  }

  // NOTE: removed get repoTimelapse() (Daily)
  // NOTE: removed get repoSunset() (Daily)

  resetTime() {
    this.#time = new Date();
    this.#sunMoonTime().resetToday(this.#time);
  }

  /**
   * Creates a Git Repo for a specific Event Folder
   */
  async setupPublicRepo(folderPath: string) {
    const repo = this.#repo();
    // repo.create now expects the folder path to already exist or be created
    const r = await repo.create(folderPath, false);
    await r.addReadme();
    return r;
  }

  async photo(presetName: string) {
    const logger = this.#logger();
    const camera = this.#camera();
    const preset = this.#preset();
    const fs = this.#fs();

    // Single photos go into a flat 'photos' folder (or maybe photos/YYYY-MM)
    // If you want atomic photos, change this to create a subfolder.
    const dir = await fs.createDirectory(this.repoPhoto);

    preset.setupPreset(presetName);
    // Camera is stateless now, we pass the full path
    const filename = `${this.nameNow}.jpg`;
    const fullPath = dir.join(filename);

    await camera.capture(fullPath);
    logger.log('Photo captured:', fullPath);

    return {
      filename,
      dir,
    };
  }

  async timelapse(
    presetName: string,
    options: { count: number; intervalMS: number; prefix?: string },
    // If null, we store the video INSIDE the source folder (Self-Contained)
    customOutFolder?: string,
    sleepMS = 0
  ) {
    const fs = this.#fs();
    const timelapse = this.#timelapse();
    const preset = this.#preset();

    // 1. GENERATE UNIQUE SESSION NAME
    // e.g. "timelapse-sunset-2026-01-23--18-45"
    const basePrefix = presetName === 'sunset' ? this.repoSunsetPrefix : this.repoTimelapsePrefix;
    const sessionName = `${basePrefix}-${this.nameNow}`;

    // 2. CREATE ATOMIC FOLDER
    // e.g. storage/timelapse-sunset-2026-01-23--18-45
    const sessionDir = await fs.createDirectory(sessionName);

    // 3. CREATE SOURCE SUBFOLDER (Optional, keeps root clean)
    // e.g. storage/timelapse-sunset.../source
    const photoDir = await sessionDir.createDirectory('source');

    // 4. DETERMINE VIDEO OUTPUT
    // Default: Store video in the session root (sessionDir)
    // Custom: Store in a "Best Of" monthly folder (repoTimelapseStitched)
    let videoDir = sessionDir;
    if (customOutFolder) {
      videoDir = await fs.createDirectory(customOutFolder);
    }

    preset.setupPreset(presetName);
    timelapse.count = options.count;
    timelapse.intervalMS = options.intervalMS;
    // The individual frames will just be named "frame-%04d" inside the source folder
    // No need for long prefixes on files if they are in a unique folder.
    timelapse.namePrefix = options.prefix ?? 'frame';

    return timelapse.shoot(photoDir, videoDir, sleepMS);
  }

  cancel() {
    return this.#timelapse().stop();
  }

  #sunsetTimeout: NodeJS.Timeout | undefined;

  scheduleSunset(onStart: (events: EventEmitter<TimelapseEventMap>, repo: Repo) => void) {
    const logger = this.#logger();
    const sunMoon = this.#sunMoonTime();

    const messageDelayMS = 1000;
    const rescheduleDelayMS = 15000;
    const rescheduleRepeatDelayMS = 60000 * 60 * 14;
    const goldenHourTimingMS = -60000 * 60 * 1.2;

    const sundownTimer = async () => {
      try {
        this.resetTime();
        let diff = sunMoon.getSunsetDiff(this.#time) + goldenHourTimingMS;

        if (!diff || diff < messageDelayMS) {
          logger.log('Too late for a timelapse today, scheduling for tomorrow!');
          diff = sunMoon.getSunsetDiff(sunMoon.addDay(this.#time), this.#time) + goldenHourTimingMS;
        }

        logger.log('Sunset timelapse scheduled in', (diff / 60000).toFixed(0), 'minutes');
        await sunMoon.sleep(diff - messageDelayMS);

        // START THE TIMELAPSE
        // Note: We don't setup the repo *before* anymore, because we need the folder first.
        // But timelapse() creates the folder.
        // We might want to refactor setupPublicRepo to take the folder created by timelapse?
        // OR: We predict the name here.

        // Let's rely on timelapse() to create the folder, and we return the path in the event?
        // For now, let's keep it simple:

        const events = await this.timelapse(
          'sunset',
          {
            count: this.dailySunsetFrameCount,
            intervalMS: this.dailySunsetTimelapseIntervalMS,
          },
          // Undefined = Store render inside the event folder
          undefined,
          messageDelayMS
        );

        // We hook into 'started' or 'stopped' to initialize the repo?
        // Or we just pass a dummy repo object for now and initialize it later via the UI buttons?
        // For the callback onStart, we might need to change the signature if Repo isn't ready yet.

        onStart(events, {} as Repo); // TODO: Fix Repo/Folder coordination
      } catch (error) {
        console.error(`Failed timelapse: ${error}`);
        logger.log('Sunset Timelapse Error:', error);
      }

      await moveBackups();
      this.#sunsetTimeout = setTimeout(sundownTimer, rescheduleDelayMS + rescheduleRepeatDelayMS);
    };

    this.#sunsetTimeout = setTimeout(sundownTimer, rescheduleDelayMS);
  }
}
