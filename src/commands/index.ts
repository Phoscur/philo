import { createInjector, Logger } from '../services/index.js';
import { BackupCommand, BackupRestoreCommand } from './backup.js';

const di = createInjector();
const logger = di.get(Logger);

// <node|npm> <script> <command>
const args = process.argv.slice(3);
const command = process.argv[2];

if ('backup' === command) {
  const backup = di.get(BackupCommand);
  // <command> <folder> <name> [<target>]
  const [folderName, fileName, targetFolderName] = args;
  await backup.run(folderName, fileName, targetFolderName);
}

if ('backup-restore' === command) {
  const backupRestore = di.get(BackupRestoreCommand);
  // <command> <name> [<target>]
  const [fileName, targetFolderName] = args;
  await backupRestore.run(fileName, targetFolderName);
}

logger.log(
  'Unknown argument(s):',
  process.argv.slice(2),
  'use "upload" or "backup" - e.g. "npm run command backup source archive'
);
