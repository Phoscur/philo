import { inject, injectable } from '@joist/di';
import { FileSystem } from './FileSystem.js';
import { Camera, StillOptions } from './index.js';

export const cameraStubProvider = {
  provide: Camera,
  factory() {
    return new CameraStub();
  },
} as const;

export function padZero(s: string, length: number): string {
  return s.length >= length ? s : padZero('0' + s, length);
}
export function ascendingPaddedNumbers(max: number): string[] {
  // de- & recomposing the array fills it, so it is iterable
  return [...new Array(max)].map((_, i) => padZero((i + 1).toString(), max.toString().length));
}
export const jpegSignature = Buffer.from([0xff, 0xd8, 0xff, 0xe1]);
export const examples = [
  './data-example/42095079-1091-1.jpg',
  './data-example/42095079-1091-2.jpg',
  './data-example/42095079-1091-3.jpg',
  './data-example/42095079-1091-4.jpg',
  './data-example/42095079-1091-5.jpg',
  './data-example/42095079-1091-6.jpg',
  './data-example/42095079-1091-7.jpg',
  './data-example/42095079-1091-8.jpg',
  './data-example/42095079-1091-9.jpg',
  './data-example/42095079-1091-10.jpg',
];

function* exampleFiles(): Generator<string> {
  let i = 0;
  while (true) {
    yield examples[i++ % examples.length];
  }
}

const exampleStream = exampleFiles();

@injectable
export class CameraStub extends Camera {
  #fs = inject(FileSystem);

  name = 'still-test-stub';
  options: StillOptions = {};

  get filename() {
    return `${this.name}.jpg`;
  }

  copyMode = false;

  get dir() {
    return this.#fs().dir('', false);
  }

  async photo(output = this.filename) {
    if (this.copyMode) {
      await this.dir.copyFile(exampleStream.next().value, output);
      return output;
    }
    await this.dir.save(output, jpegSignature);
    return output;
  }

  /*getTimelapseName() {
    return `${this.name}-%d.jpg`;
  }

  async timelapse(output: string, count = 9, pause = 10, copyFiles = true) {
    const fs = this.#fs();
    const fileNames = ascendingPaddedNumbers(count);
    for (const [index, fileName] of fileNames.entries()) {
      const file = this.getTimelapseName().replace('%d', fileName);
      if (copyFiles) {
        await fs.copyFile(examples[index % examples.length], file);
        continue;
      }
      await fs.save(file, jpegSignature);
      await new Promise((res) => setTimeout(res, pause));
      // twice (in reality the event is emitted thrice or even four times)
      await fs.save(file, jpegSignature);
      await new Promise((res) => setTimeout(res, pause));
    }
    return 'stub-timelapse';
  }*/
}
