import { Injector } from '@joist/di';
import { Logger, consoleInjector, Repository, FileSystem } from './services/index.js';

// defineEnvironment
const injector = new Injector([], consoleInjector);
const logger = injector.get(Logger);
const fs = injector.get(FileSystem);
const repo = injector.get(Repository);

const DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  // TODO? restore await InventoryStorage.create(`${process.env.CONTENT_STORAGE_NAME_PREFIX}`);
  for (let d = 7; d > 0; d--) {
    const yesterday = new Date(Date.now() - DAY_MS * d).toISOString().slice(0, 10);
    const repoName = `${process.env.CONTENT_STORAGE_NAME_PREFIX}-${yesterday}`;
    try {
      await repo.checkout(repoName);
      await fs.setupPath(repoName);
      logger.log('Storage has', (await fs.list()).length - 1, 'files in', repoName);
    } catch (error: any) {
      logger.log('Failed to checkout repo:', repoName, error?.message);
    }
  }
}

main();
