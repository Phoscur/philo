import { inject, injectable } from '@joist/di';
import { FileSystem } from './FileSystem.js';

const ASSETS_FOLDER = 'assets';
@injectable
export class Assets {
  #fs = inject(FileSystem);

  constructor(
    public randomImageUrl = `${
      process.env.RANDOM_IMAGE_URL || 'https://picsum.photos/600/400/?random'
    }`,
    public spinnerImagePath = 'cool-loading-animated-gif-3.gif'
  ) {}

  get spinnerAnimation() {
    const assets = this.#fs().dir(ASSETS_FOLDER);
    return {
      media: {
        // telegraf also accepts a ReadStream as source
        source: assets.readStream(this.spinnerImagePath) as unknown as NodeJS.ReadableStream,
        filename: 'spinner.gif',
      },
      type: 'animation',
    };
  }
  get randomImage() {
    return {
      media: {
        url: this.randomImageUrl,
      },
      type: 'photo',
    };
  }
}
