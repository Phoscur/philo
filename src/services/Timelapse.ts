import { inject, injectable } from '@joist/di';
import { Repository } from './Repository.js';
import { Logger } from './Logger.js';
import { Camera } from './Camera.js';

@injectable
export class Timelapse {
  #logger = inject(Logger);
  #repo = inject(Repository);
  #cam = inject(Camera);

  async setup(name: string) {
    const repo = this.#repo();
    await repo.setup(name, false);
    await repo.addReadme();
  }

  async shoot(
    count: number,
    intervalMS: number,
    onFrame: (filename: string) => void = () => {},
    onUpload: (filename: string) => void = () => {},
    prefix = 'frame'
  ) {
    const logger = this.#logger();
    const repo = this.#repo();
    const camera = this.#cam();

    camera.fileNamePrefix = prefix;

    const uploads: (() => Promise<void>)[] = [];
    let running: Promise<void> | undefined = undefined;
    const queue = () => {
      logger.log('Queued uploads:', uploads.length);
      const n = uploads.shift();
      if (!n) return (running = undefined);
      running = n().then(queue);
    };

    await camera.watchTimelapse(count, intervalMS, (filename: string) => {
      logger.log('Timelapse frame created:', filename);
      onFrame(filename);
      // given file written events, we can start uploading (sequentially) in parallel
      uploads.push(() => repo.upload(filename).then(() => onUpload(filename)));
      //if (running && running.isPending) return
      if (!running) {
        queue();
      }
    });

    while (running) {
      await running;
    }
  }
}
