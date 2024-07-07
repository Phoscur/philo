import { Injector } from '@joist/di';
import {
  Logger,
  consoleInjector,
  Camera,
  CameraStub,
  Git,
  Repository,
  Timelapse,
  FileSystem,
} from './services/index.js';

const repoName = 'timelapse-test-2024-06-22';
const timelapseFile = 'timelapse.mp4';
const outFolder = 'timelapse-test-output';

// defineEnvironment
const injector = new Injector([], consoleInjector);
const git = injector.get(Git);
const logger = injector.get(Logger);
const fs = injector.get(FileSystem);
const repo = injector.get(Repository);
//const camera = injector.get(Camera);
const camera = injector.get(CameraStub);
const timelapse = injector.get(Timelapse);

async function upload() {
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
  camera.name = 'frame';
  const r = await repo.create(repoName, false);
  await r.addReadme();

  timelapse.count = 3 * 18; // 3-5 times framerate
  timelapse.intervalMS = 2000;
  await timelapse.shoot({ cwd: fs.cwd, inFolder: repoName, outFolder }, (filename: string) => {
    console.log('captured frame', filename);
  });
  console.timeEnd('timelapse');
  console.time('githubrender');
  await r.makeTimelapsePage();
  console.timeLog('githubrender', 'actions added');
  logger.log('Added GH Timelapse Action! Waiting 10s ...');
  await new Promise((r) => setTimeout(r, 10000));

  await r.enablePages(60);
  console.timeEnd('githubrender');
}

async function still() {
  const path = camera.dir.path;
  await fs.createDirectory(path);
  logger.log('Starting still capture');
  await camera.photo();
  logger.log('Capture finished');

  const files = await camera.dir.list();
  const jpegs = files.filter((f) => f.endsWith('jpg'));
  logger.log('Result', jpegs);
}

switch (process.argv[2]) {
  case 'upload':
    upload();
    break;
  case 'still':
    still();
    break;
  default:
    console.log(
      'Unknown argument:',
      process.argv[2],
      'use "upload" or "still" - e.g. "npm test -- still'
    );
}
