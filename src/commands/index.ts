import { createInjector, Logger } from '../services/index.js';
import { BackupCommand, BackupRestoreCommand } from './backup.js';

const di = createInjector();
const logger = di.get(Logger);

// <node|npm> <script> <command>
const args = process.argv.slice(3);
const command = process.argv[2];
/*
Full backup & restore

1. Tar/Gzip & Upload 

npm run command backup sunset-karlsruhe-2024-10-02 sunset-karlsruhe-2024-10-02 data-archive command-upload

2. Download via aws cli: https://docs.aws.amazon.com/amazonglacier/latest/dev/downloading-an-archive-using-cli.html
- first, `aws configure` with credentials

2.1. find the vault
aws glacier list-vaults --account-id <account-number-vault-prefix=111122223333>
2.2. find the archive (if it's not too new - got an empty list the next day when trying this)
aws glacier initiate-job --vault-name command-upload --account-id 111122223333 --job-parameters="{\"Type\":\"inventory-retrieval\"}"
aws glacier describe-job --vault-name command-upload --account-id 111122223333 --job-id *** jobid ***
aws glacier get-job-output --vault-name command-upload --account-id 111122223333 --job-id *** jobid *** output.json
2.3. get the archive (the next day - takes a while to restore...)
aws glacier initiate-job --vault-name command-upload --account-id 111122223333 --job-parameters="{\"Type\":\"archive-retrieval\",\"ArchiveId\":\"*** archiveId ***\"}"
aws glacier describe-job --vault-name command-upload --account-id 111122223333 --job-id *** jobid ***
aws glacier get-job-output --vault-name command-upload --account-id 111122223333 --job-id *** jobid *** sunset-karlsruhe-2024-10-02

3. decompress/extract

npm run command backup-restore sunset-karlsruhe-2024-10-02-restored

*/
try {
  if ('backup' === command) {
    const backup = di.get(BackupCommand);
    // <command> <folder> <name> [<target>] [<vault>] [<description>]
    const [folderName, fileName, targetFolderName, vaultName, vaultDescription] = args;
    await backup.run(folderName, fileName, targetFolderName, vaultName, vaultDescription);
    process.exit(0);
  }

  if ('backup-restore' === command) {
    const backupRestore = di.get(BackupRestoreCommand);
    // <command> <name> [<target>]
    const [fileName, targetFolderName] = args;
    await backupRestore.run(fileName, targetFolderName);
    process.exit(0);
  }
} catch (error) {
  logger.log('Error:', error);
  process.exit(1);
}

logger.log(
  'Unknown argument(s):',
  process.argv.slice(2),
  'use "upload" or "backup" - e.g. "npm run command backup source archive'
);
