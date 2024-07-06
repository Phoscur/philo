import { inject, injectable } from '@joist/di';
import { FileSystem } from './FileSystem.js';
@injectable
export class Assets {
  // use an independent instance of FileSystem, so the path cannot be manipulated
  static providers = [{ provide: FileSystem, use: FileSystem }];

  #fs = inject(FileSystem);

  constructor(
    public randomImageUrl = `${
      process.env.RANDOM_IMAGE_URL || 'https://picsum.photos/600/400/?random'
    }`,
    public spinnerImagePath = '../assets/cool-loading-animated-gif-3.gif'
  ) {}

  get spinnerAnimation() {
    const fs = this.#fs();
    return {
      media: {
        // telegraf also accepts a ReadStream as source
        source: fs.readStream(this.spinnerImagePath) as unknown as NodeJS.ReadableStream,
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
