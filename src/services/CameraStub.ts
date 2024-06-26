import { inject, injectable } from '@joist/di';
import { FileSystem } from './FileSystem.js';
import { Camera, PiCameraConfig } from './Camera.js';

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

@injectable
export class CameraStub extends Camera {
  #fs = inject(FileSystem);

  fileNamePrefix = 'test';
  options: PiCameraConfig = {};
  printOptions(timelapse?: number, count?: number): string {
    return `stub-options ${timelapse} ${count}`;
  }

  get filename() {
    return `${this.fileNamePrefix}.jpg`;
  }

  get output() {
    return this.#fs().joinPath(this.filename);
  }

  async photo(output: string) {
    await this.#fs().save(output, jpegSignature);
    return 'stub-photo';
  }

  getTimelapseName() {
    return `${this.fileNamePrefix}-%d.jpg`;
  }

  getTimelapseOutput() {
    return this.#fs().joinPath(this.getTimelapseName());
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
  }
}
