import { inject, injectable } from '@joist/di';
import { VideoRenderer } from './Timelapse.js';
import { FileSystem } from './FileSystem.js';
import type { StitchOptions } from '../lib/ffmpeg.js';

const example = './data-example/2021-12-21--16-01.42095079-1278.mp4';

@injectable
export class StubRenderer implements VideoRenderer {
  #fs = inject(FileSystem);
  async stitchImages(
    name: string,
    cwd: string,
    { parts }: StitchOptions = {},
    inFolder: string = '.',
    outFolder: string = '.',
    _onData = (_frame: string, _fps: string) => {},
    logger = { log: console.log }
  ) {
    const dir = this.#fs().dir('');
    const out = await this.#fs().createDirectory(outFolder);
    await dir.copyFile(example, out.join(`${name}.mp4`));
    const log = `Stubbed ffmpeg rendering of ${name} with ${parts} parts in ${inFolder} to ${outFolder} [${cwd}]`;
    logger.log(log);
    return Buffer.from(log);
  }
}

export const rendererStubProvider = {
  provide: VideoRenderer,
  factory() {
    return new StubRenderer();
  },
} as const;
