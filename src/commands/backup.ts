import {
  Archiver,
  FileSystem,
  Logger,
  injectable,
  inject,
  GlacierBackup,
} from '../services/index.js';
export const defaultTargetFolder = process.env.BACKUP_TARGET_FOLDER || 'data-archive';

@injectable
export class BackupCommand {
  #fs = inject(FileSystem);
  #logger = inject(Logger);
  #backup = inject(GlacierBackup);
  #archiver = inject(Archiver);

  constructor(readonly defaultTargetFolder = process.env.BACKUP_TARGET_FOLDER || 'data-archive') {}

  async run(
    folderName: string,
    fileName: string,
    targetFolderName = this.defaultTargetFolder,
    vaultName = '',
    vaultDescription = ''
  ) {
    const logger = this.#logger();
    const fs = this.#fs();
    const archiver = this.#archiver();
    const backup = this.#backup();

    logger.log(`[Backup] Folder: ${folderName} Name: ${fileName} Target: ${targetFolderName}`);

    const directory = await fs.createDirectory(folderName);
    const targetDirectory = await fs.createDirectory(targetFolderName);
    const file = `${fileName}.tar.gz`;
    const outputFilePath = targetDirectory.join(file);

    logger.log('Compressing', directory.path);
    await archiver.compressFolder(directory.path, outputFilePath);

    if (vaultName) {
      const vault = await backup.createVault(vaultName);
      await vault.uploadArchive(targetDirectory.readStream(file), vaultDescription || file);
    }
  }
}

@injectable
export class BackupRestoreCommand {
  #fs = inject(FileSystem);
  #logger = inject(Logger);
  #archiver = inject(Archiver);

  constructor(
    readonly defaultTargetFolder = process.env.BACKUP_RESTORE_TARGET_FOLDER || 'data-restore'
  ) {}

  async run(fileName: string, targetFolderName = this.defaultTargetFolder) {
    const logger = this.#logger();
    const fs = this.#fs();
    const archiver = this.#archiver();

    const file = fileName.includes('.tar.gz') ? fileName : `${fileName}.tar.gz`;

    logger.log(`[Backup-Restore] Name: ${file} Target: ${targetFolderName}`);

    //const vaultName = 'your-glacier-vault';
    const targetDirectory = await fs.createDirectory(targetFolderName);

    logger.log('Decompressing', file, 'into', targetDirectory.path);
    await archiver.extract(file, targetDirectory.path);
  }
}
