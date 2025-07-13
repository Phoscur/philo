import { Logger, createInjector, Repository, Director } from './services/index.js';

// defineEnvironment
const injector = createInjector();
const logger = injector.get(Logger);
const repo = injector.get(Repository);

const DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  for (let d = 7; d > 0; d--) {
    const yesterday = Director.yyyymmdd(new Date(Date.now() - DAY_MS * d));
    const repoName = `${process.env.FOLDER_PREFIX_DAILY_TIMELAPSE_SUNSET}-${yesterday}`;
    try {
      const r = await repo.checkout(repoName);
      logger.log('Storage has', (await r.dir.list()).length - 1, 'files in', repoName);
    } catch (error: any) {
      logger.log('Failed to checkout repo:', repoName, error?.message);
    }
  }
}

main();
