import { inject, injectable } from '@joist/di';
import { libcamera } from 'libcamera';
import { FileSystem } from './FileSystem.js';

// TODO? mhh, this type is quite generic, maybe we want to make it more specific?!?
// we had stronger typing previously (check other libcamera packages again)
// import type { PiCameraConfig } from 'libcamera/dist/types.js';
// export type { PiCameraConfig } from 'libcamera/dist/types.js';
export interface PiCameraConfig {
  [key: string]: string | number | boolean;
}

@injectable
export class Camera {
  #fs = inject(FileSystem);

  fileNamePrefix = 'test';
  options: PiCameraConfig = {
    roi: '', // x,y,w,h
    framestart: 1,
    height: 1080,
    // width: false,
  };

  printOptions(timelapse = 0, count = 0) {
    const p = this.options;
    const roi = p.roi ? `Region of interest: ${p.roi}` : '';
    const widthAndHeight =
      p.width || p.height ? `Width: ${p.width || '*'}, height: ${p.height || '*'}` : '';
    const duration = timelapse
      ? `Duration: ~${((count * timelapse) / 60 / 1000).toFixed(1)}min(s) -`
      : ''; // TODO? use dayjs.humanize
    const minutely = timelapse ? `images per minute: ~${(60000 / timelapse).toFixed(1)}` : '';
    const interval = timelapse ? `- Milliseconds between images: ${timelapse}` : '';
    const c = p.count ? `- Total image count: ${p.count}` : '';
    return `${roi}\n${widthAndHeight}\n${duration} ${minutely}\n${interval}\n${c}`;
  }

  get filename() {
    return `${this.fileNamePrefix}.jpg`;
  }

  get output() {
    return this.#fs().joinPath(this.filename);
  }

  async photo(output: string = this.output) {
    return libcamera.still({
      config: {
        ...this.options,
        output,
      },
    });
  }

  getTimelapseName(count = 420) {
    const len = count.toString().length;
    return `${this.fileNamePrefix}-%0${len}d.jpg`;
  }

  getTimelapseOutput(count = 420) {
    return this.#fs().joinPath(this.getTimelapseName(count));
  }

  async timelapse(output: string, count = 420, timelapse = 12000) {
    // if (timelapse < 1200) throw new Error('Interval must be at least 1200ms (camera is slow)')
    //console.time('still')
    const timeout = count * timelapse + 500; // need up to 400ms extra for an extra image
    //console.log('settings', timeout, timelapse)
    // takes about 2s to start
    const r = await libcamera.still({
      config: {
        ...this.options,
        timelapse, // also as initial delay
        timeout,
        output,
      },
    });
    //console.timeEnd('still')
    return r;
  }

  /**
   * Run a file watcher informing about timelapse progress
   * @param count
   * @param interval
   * @param handler
   * @returns
   */
  async watchTimelapse(count = 420, interval = 12000, handler = (filename: string) => {}) {
    const timelapse = this.timelapse(this.getTimelapseOutput(count), count, interval);
    const ac = new AbortController();
    return Promise.all([
      (async () => {
        await timelapse;
        ac.abort();
      })(),
      (async () => {
        let lastFile: string | null = '';
        try {
          const watcher = this.#fs().watch(ac);
          for await (const event of watcher) {
            //console.timeLog('still', event.filename)
            if (lastFile === event.filename) continue;
            // when a new file is started, the previous one is ready for upload
            if (lastFile) handler(lastFile);
            lastFile = event.filename;
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            // the very last file is now ready too
            handler(lastFile ?? '');
            return;
          }
          throw err;
        }
      })(),
    ]);
  }
}
