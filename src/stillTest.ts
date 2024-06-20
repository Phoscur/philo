import { Injector } from '@joist/di';
import { Logger, consoleInjector, FileSystem, Camera, CameraStub } from './services/index.js';

const repoName = 'data-still-test-2024-06-01';

// defineEnvironment
const injector = new Injector([], consoleInjector);
const logger = injector.get(Logger);
const fs = injector.get(FileSystem);
const camera = injector.get(Camera);

async function main() {
  const isNew = await fs.setupPath(repoName);
  if (!isNew) {
    await fs.destroy();
    await fs.setupPath(repoName);
  }
  logger.log('Starting timelapse');
  await camera.watchTimelapse(4, 3000, (filename: string) => {
    logger.log('File done:', filename);
  });
  logger.log('Timelapse finished');

  const files = await fs.list();
  const jpegs = files.filter((f) => f.endsWith('jpg'));
  logger.log('Adding', jpegs.length, 'images...');
}
main(); //.catch((e) => {  console.error(e.message, e.code, Object.keys(e)); });
