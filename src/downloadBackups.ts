import { spawnPromise } from './lib/spawn.js';
import { Logger, createInjector, Repository, Director } from './services/index.js';

// defineEnvironment
const injector = createInjector();
const logger = injector.inject(Logger);
const repo = injector.inject(Repository);

const DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  for (let d = 14; d > 0; d--) {
    const yesterday = Director.yyyymmdd(new Date(Date.now() - DAY_MS * d));
    const repoName = `${process.env.FOLDER_PREFIX_DAILY_TIMELAPSE_SUNSET}-${yesterday}`;
    try {
      const r = await repo.checkout(repoName);
      logger.log('Storage has', (await r.dir.list()).length - 1, 'files in', repoName);
    } catch (error: any) {
      logger.log('Failed to checkout repo:', repoName, error?.message);
      continue;
    }
    if (d < 6) continue;
    const ssh = process.env.CLEAN_SSH_TARGET;
    const home = process.env.CLEAN_SSH_FOLDER;
    if (!ssh) continue;
    try {
      //const output =
      await spawnPromise('ssh', [ssh, `cd ${home} && rm -rf ${repoName} && exit`]);
      //console.log('Output:\n' + output?.toString());
      logger.log('Removed', repoName, 'from', ssh);
    } catch (error: any) {
      logger.log('Failed to clean folder:', repoName, error?.message);
    }
  }
}

main();
