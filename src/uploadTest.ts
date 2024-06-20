import { Injector } from '@joist/di';
import {
  Logger,
  consoleInjector,
  Camera,
  CameraStub,
  Git,
  Repository,
  Timelapse,
} from './services/index.js';

const repoPrefix = `${process.env.GITHUB_REPO_NAME_PREFIX}`;
const repoName = repoPrefix + '-2024-06-20s';
const timelapseFile = 'timelapse.mp4';

// defineEnvironment
const injector = new Injector([], consoleInjector);
const git = injector.get(Git);
const logger = injector.get(Logger);
const repo = injector.get(Repository);
const camera = injector.get(Camera);
const timelapse = injector.get(Timelapse);

async function main() {
  /*const isNew = await fs.setupPath(repoName)
  if (!isNew) {
    await fs.destroy()
    logger.log('Folder cleaned up')
  }*/

  if (await git.checkPage(repoName, timelapseFile)) {
    // TODO? maybe we need a token that can delete the repo
    logger.log('Page with timelapse is up already! (Change the repo name.)');
    return;
  }
  logger.log('Creating and checking out repository', repoName);
  camera.fileNamePrefix = 'frame';
  await repo.setup(repoName, false);
  await repo.addReadme();

  const count = 3 * 18; // 3-5 times framerate
  const interval = 2000;
  logger.log('Starting timelapse', count, 'frames with', interval, 'ms interval');
  console.time('timelapse');
  await timelapse.shoot(
    count,
    interval,
    (filename: string) => {
      console.timeLog('timelapse', 'captured frame', filename);
    },
    (filename: string) => {
      console.timeLog('timelapse', 'still uploading - now', filename);
    }
  );
  console.timeEnd('timelapse');
  console.time('githubrender');
  await repo.makeTimelapsePage();
  console.timeLog('githubrender', 'actions added');
  logger.log('Added GH Timelapse Action! Waiting 10s ...');
  await new Promise((r) => setTimeout(r, 10000));

  await repo.enablePages(60, repoName);
  console.timeEnd('githubrender');
}

main(); //.catch((e) => {  console.error(e.message, e.code, Object.keys(e)); });
