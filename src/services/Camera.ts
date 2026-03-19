import { inject, injectable } from '@joist/di';
import { Logger } from './Logger.js';
import { StillCamera } from '../lib/libcamera-still.js';

import type { StillOptions } from '../lib/libcamera-still.js';
export type { StillOptions } from '../lib/libcamera-still.js';

@injectable()
export class Camera {
  #logger = inject(Logger);

  options: StillOptions = {
    roi: '', // x,y,w,h
    // height: 1080,
  };

  #mutex: Promise<unknown> | false = false;
  get busy() {
    return this.#mutex;
  }

  async photo(output: string) {
    const logger = this.#logger();
    logger.time('photo');
    if (this.#mutex) {
      logger.timeLog('photo', 'mutex blocked');
      throw new Error('Camera is busy, cannot capture!');
    }
    try {
      const camera = new StillCamera({
        ...this.options,
        output, // TODO? maybe for a very fast capture, we might want to read the output into a buffer, but for now we just write to disk
      });
      this.#mutex = camera.takeImage();
      await this.#mutex;
      logger.timeLog('photo', 'image taken');
      return output;
    } catch (e) {
      logger.timeLog('photo', 'error', e);
      throw e;
    } finally {
      logger.timeEnd('photo');
      this.#mutex = false;
    }
  }
}
