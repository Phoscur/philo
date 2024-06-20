import { inject, injectable, ProviderToken } from '@joist/di';
import { FileSystem } from './FileSystem.js';

@injectable
export class Assets {
  // use an independent instance of FileSystem
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
        source: fs.readStream(this.spinnerImagePath),
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
