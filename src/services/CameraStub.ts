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

type Interface<T> = {
  // Workaround TS2720: Strip private fields - see https://github.com/microsoft/TypeScript/issues/471
  [P in keyof T]: T[P];
};

@injectable
export class CameraStub implements Interface<Camera> {
  #fs = inject(FileSystem);

  fileNamePrefix = 'test';
  options: PiCameraConfig = {};
  printOptions(timelapse?: number, count?: number): string {
    return '';
  }

  get timelapseOutput() {
    return this.#fs().joinPath(`${this.fileNamePrefix}-%02d.jpg`);
  }

  async timelapse(output: string, count = 9, pause = 10, copyFiles = false) {
    const fs = this.#fs();
    const fileNames = ascendingPaddedNumbers(count);
    for (const [index, fileName] of fileNames.entries()) {
      const file = this.timelapseOutput.replace('%d', fileName);
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

  async watchTimelapse(count = 15, interval = 1500, handler = (filename: string) => {}) {
    const timelapse = this.timelapse(this.timelapseOutput, count, interval);
    const ac = new AbortController();
    const { signal } = ac;
    return Promise.all([
      (async () => {
        await timelapse;
        ac.abort();
      })(),
      (async () => {
        try {
          const watcher = this.#fs().watch({ signal });
          for await (const event of watcher) {
            if ('change' === event.eventType) {
              // can't use await here, because it would block us from receiving events
              // don't need to wait for multiple events like with the real camera, files are written atomically here
              handler(event.filename || '');
            }
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
          throw err;
        }
      })(),
    ]);
  }
}
