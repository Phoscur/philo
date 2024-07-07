import { inject, injectable } from '@joist/di';
import { StillCamera } from '../lib/libcamera-still.js';
import { FileSystem } from './FileSystem.js';

import type { StillOptions } from '../lib/libcamera-still.js';
export type { StillOptions } from '../lib/libcamera-still.js';

@injectable
export class Camera {
  #fs = inject(FileSystem);

  #mutex: Promise<unknown> | false = false;
  get busy() {
    return this.#mutex;
  }

  name = 'still-test';
  options: StillOptions = {
    roi: '', // x,y,w,h
    height: 1080,
  };

  get filename() {
    return `${this.name}.jpg`;
  }

  async photo(filename: string = this.filename) {
    if (this.#mutex) {
      throw new Error('Camera is busy, cannot capture!');
    }
    const output = this.#fs().joinPath(filename);
    const camera = new StillCamera({
      ...this.options,
      output, // TODO? maybe for a very fast capture, we might want to read the output into a buffer, but for now we just write to disk
    });
    this.#mutex = camera.takeImage();
    await this.#mutex;
    this.#mutex = false;
  }
}
