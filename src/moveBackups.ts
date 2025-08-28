import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnPromise } from './lib/spawn.js';
import { Logger, createInjector, Director } from './services/index.js';

const injector = createInjector();
const logger = injector.inject(Logger);

const DAY_MS = 24 * 60 * 60 * 1000;

async function hashFile(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

async function hashDir(dir: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  async function walk(base: string) {
    const entries = await fs.readdir(base, { withFileTypes: true });
    for (const entry of entries) {
      const p = path.join(base, entry.name);
      if (entry.isDirectory()) {
        await walk(p);
      } else {
        const rel = path.relative(dir, p);
        result.set(rel, await hashFile(p));
      }
    }
  }
  await walk(dir);
  return result;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function moveAndVerify(localDir: string, backupDir: string, destructive = true) {
  // Step 1: copy only (preserve everything in backup)
  await spawnPromise('rsync', ['-a', localDir + '/', backupDir + '/']);

  // Step 2: verify
  const [localHashes, backupHashes] = await Promise.all([hashDir(localDir), hashDir(backupDir)]);

  if (localHashes.size !== backupHashes.size) {
    throw new Error(`File count mismatch: ${localHashes.size} vs ${backupHashes.size}`);
  }
  for (const [rel, h] of localHashes.entries()) {
    if (backupHashes.get(rel) !== h) {
      throw new Error(`Checksum mismatch in file ${rel}`);
    }
  }

  if (!destructive) return;
  // Step 3: remove local only after passing verification
  await fs.rm(localDir, { recursive: true, force: true });
}

async function main() {
  for (let d = 14; d > 0; d--) {
    const date = new Date(Date.now() - DAY_MS * d);
    const repoName = `${process.env.FOLDER_PREFIX_DAILY_TIMELAPSE_SUNSET}-${Director.yyyymmdd(
      date
    )}`;

    const localDir = path.join(process.cwd(), repoName);
    const backupDir = path.join(
      process.env.FOLDER_BACKUP_MOUNT ?? 'missing-FOLDER_BACKUP_MOUNT',
      repoName
    );
    const destructive = d > 6;

    try {
      if (!(await exists(localDir))) continue;
      await moveAndVerify(localDir, backupDir, destructive);
      logger.log('Moved + verified', destructive ? '+ deleted' : '', repoName);
    } catch (err: any) {
      logger.log('Failed moving/verifying', repoName, err.message);
    }
  }
}

main();
