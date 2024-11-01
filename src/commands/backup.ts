import { Archiver, FileSystem, Logger, injectable, inject } from '../services/index.js';
export const defaultTargetFolder = process.env.BACKUP_TARGET_FOLDER || 'data-archive';

@injectable
export class BackupCommand {
  #fs = inject(FileSystem);
  #logger = inject(Logger);
  #archiver = inject(Archiver);

  constructor(readonly defaultTargetFolder = process.env.BACKUP_TARGET_FOLDER || 'data-archive') {}

  async run(folderName: string, fileName: string, targetFolderName = this.defaultTargetFolder) {
    const logger = this.#logger();
    const fs = this.#fs();
    const archiver = this.#archiver();

    logger.log(`[Backup] Folder: ${folderName} Name: ${fileName} Target: ${targetFolderName}`);

    const directory = await fs.createDirectory(folderName);
    const targetDirectory = await fs.createDirectory(targetFolderName);
    const outputFilePath = targetDirectory.join(`${fileName}.tar.gz`);

    try {
      logger.log('Compressing', directory.path);
      await archiver.compressFolder(directory.path, outputFilePath);
      process.exit(0);

      //const vaultName = 'your-glacier-vault';
      //await uploadToGlacier(vaultName, outputFilePath);
    } catch (error) {
      logger.log('Error:', error);
      process.exit(1);
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

    try {
      logger.log('Decompressing', file, 'into', targetDirectory.path);
      await archiver.extract(file, targetDirectory.path);
      process.exit(0);
    } catch (error) {
      logger.log('Error:', error);
      process.exit(1);
    }
  }
}
