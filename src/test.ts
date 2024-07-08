import { defineEnvironment, Injector } from '@joist/di';
import {
  Logger,
  consoleInjector,
  Camera,
  CameraStub,
  Git,
  Repository,
  Timelapse,
  FileSystem,
  Director,
} from './services/index.js';

const repoName = 'timelapse-test-2024-06-22';
const timelapseFile = 'timelapse.mp4';
const outFolder = 'timelapse-test-output';

defineEnvironment([]);
const injector = new Injector(
  [
    {
      provide: Camera,
      factory: () => new CameraStub(),
    },
  ],
  consoleInjector
);
const camera = injector.get(Camera);
(camera as CameraStub).copyMode = true;
const director = injector.get(Director);

const git = injector.get(Git);
const logger = injector.get(Logger);
const fs = injector.get(FileSystem);
const repo = injector.get(Repository);
//const camera = injector.get(CameraStub);
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

async function lapse() {
  //await fs.createDirectory(path);
  logger.log('Starting timelapse capture', camera instanceof CameraStub ? 'stub' : 'real');
  const photosFolder = director.repoTimelapse;
  const outFolder = director.repoTimelapseStitched;
  const output = await director.timelapse('default', {
    count: 20,
    intervalMS: 2000,
  });
  logger.log('Capture finished', outFolder, output);

  const images = await fs.dir(photosFolder).list();
  const videos = await fs.dir(outFolder).list();
  logger.log('Result', images, videos);
}

async function still() {
  const path = camera instanceof CameraStub ? camera.dir.path : 'storage-test';
  await fs.createDirectory(path);
  logger.log('Starting still capture');
  await camera.photo();
  logger.log('Capture finished');

  const files = await fs.dir(path).list();
  const jpegs = files.filter((f) => f.endsWith('jpg'));
  logger.log('Result', jpegs);
}

switch (process.argv[2]) {
  case 'upload':
    upload();
    break;
  case 'lapse':
    lapse();
    break;
  case 'still':
    still();
    break;
  default:
    lapse();
    break;
    console.log(
      'Unknown argument:',
      process.argv[2],
      'use "upload", "lapse" or "still" - e.g. "npm test -- still'
    );
}
