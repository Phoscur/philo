import { inject, injectable } from '@joist/di';
import { FileSystem } from './FileSystem.js';
import { Input } from 'telegraf';
import { InputFile } from 'telegraf/types';

const ASSETS_FOLDER = 'assets';
@injectable()
export class Assets {
  #fs = inject(FileSystem);

  constructor(
    public randomImageUrl = `${
      process.env.RANDOM_IMAGE_URL || 'https://picsum.photos/600/400/?random'
    }`,
    public spinnerImagePath = 'cool-loading-animated-gif-3.gif'
  ) {}

  get randomImage(): InputFile | string {
    return Input.fromURL(this.randomImageUrl);
  }

  get telegramSpinner() {
    const assets = this.#fs().dir(ASSETS_FOLDER);
    return Input.fromLocalFile(assets.joinAbsolute(this.spinnerImagePath));
  }
}
