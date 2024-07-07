import { Injector } from '@joist/di';
import { Logger, consoleInjector, Repository, Director } from './services/index.js';

// defineEnvironment
const injector = new Injector([], consoleInjector);
const logger = injector.get(Logger);
const repo = injector.get(Repository);

const DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  for (let d = 7; d > 0; d--) {
    const yesterday = Director.yyyymmdd(new Date(Date.now() - DAY_MS * d));
    const repoName = `${process.env.CONTENT_STORAGE_NAME_PREFIX}-${yesterday}`;
    try {
      const r = await repo.checkout(repoName);
      logger.log('Storage has', (await r.dir.list()).length - 1, 'files in', repoName);
    } catch (error: any) {
      logger.log('Failed to checkout repo:', repoName, error?.message);
    }
  }
}

main();
