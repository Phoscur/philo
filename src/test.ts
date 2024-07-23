import {
  Logger,
  createInjector,
  Camera,
  CameraStub,
  Git,
  Repository,
  Timelapse,
  FileSystem,
  Director,
  createInjectorWithStubbedDependencies,
} from './services/index.js';

const repoName = 'timelapse-test-2024-06-22';
const timelapseFile = 'timelapse.mp4';
const outFolder = 'timelapse-test-output';

const useNoStub = process.argv.includes('--no-stub');
const injector = useNoStub ? createInjector() : createInjectorWithStubbedDependencies();
const camera = injector.get(Camera);
//const camera = injector.get(CameraStub);
(camera as CameraStub).copyMode = true;
const timelapse = injector.get(Timelapse);
const director = injector.get(Director);
const git = injector.get(Git);
const logger = injector.get(Logger);
const fs = injector.get(FileSystem);
const repo = injector.get(Repository);

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

  const photoDir = await fs.createDirectory(repoName);
  const videoDir = await fs.createDirectory(outFolder);

  timelapse.count = 3 * 18; // 3-5 times framerate
  timelapse.intervalMS = 2000;
  await timelapse.shoot(photoDir, videoDir, (filename: string) => {
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

async function lapse(count = 20, intervalMS = 2000) {
  //await fs.createDirectory(path);
  logger.log('Starting timelapse capture', camera instanceof CameraStub ? 'stub' : 'real');
  const photosFolder = director.repoTimelapse;
  const { output, dir } = await director.timelapse('default', {
    prefix: 'timelapse',
    count,
    intervalMS,
  });
  logger.log('Capture finished', dir.path, output);

  const images = await fs.dir(photosFolder).list();
  const videos = await dir.list();
  logger.log('Images:', photosFolder, images, 'Videos:', dir, videos);
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

if (process.argv.includes('upload')) {
  upload();
} else if (process.argv.includes('lapse')) {
  const intervalMS = useNoStub ? 3000 : 200;
  lapse(10, intervalMS);
} else if (process.argv.includes('still')) {
  still();
} else {
  console.log(
    'Unknown argument(s):',
    process.argv.slice(2),
    'use "upload", "lapse" or "still" - e.g. "npm test -- still'
  );
}
