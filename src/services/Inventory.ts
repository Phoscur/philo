import { inject, injectable } from '@joist/di';
import { Directory, FileSystem } from './FileSystem.js';
import { Logger } from './Logger.js';

interface Entry {
  vault?: string;
  files: string[];
}

interface InventoryIndex {
  [folder: string]: Entry;
}

interface MediaIndex {
  name: string;
  media: InventoryIndex;
  raw: InventoryIndex;
}

function newMediaIndex(name: string): MediaIndex {
  return {
    name,
    media: {},
    raw: {},
  };
}

function newEntry(vault?: string): Entry {
  return {
    vault,
    files: [],
  };
}

class Inventory {
  constructor(
    /**
     * path from env: FOLDER_INVENTORY
     */
    readonly directory: Directory,
    readonly logger: Logger,
    private mediaIndex: MediaIndex = newMediaIndex('initial')
  ) {}

  get prettyIndex() {
    const { raw } = this.mediaIndex;
    const output: Record<string, number> = {};
    for (const folder in raw) {
      output[folder] = raw[folder].files.length;
    }
    return JSON.stringify(output, null, 2);
  }

  async addRaw(folder: string, name: string, vault?: string) {
    if (!this.mediaIndex.raw[folder]) {
      this.mediaIndex.raw[folder] = newEntry(vault);
    }
    this.mediaIndex.raw[folder].files.push(name);
    await this.writeIndex();
  }

  async addMedia(folder: string, name: string, vault?: string) {
    if (!this.mediaIndex.media[folder]) {
      this.mediaIndex.media[folder] = newEntry(vault);
    }
    this.mediaIndex.media[folder].files.push(name);
    await this.writeIndex();
  }

  private async writeIndex() {
    const fileName = InventoryStorage.INVENTORY_JSON_FILE;
    await this.directory.save(
      fileName,
      Buffer.from(JSON.stringify(this.mediaIndex, null, 2), 'utf8')
    );
  }

  async readIndex(): Promise<MediaIndex> {
    const { logger, directory } = this;
    const fileName = InventoryStorage.INVENTORY_JSON_FILE;
    try {
      const inv = await directory.read(fileName);
      logger.log(`[Inventory: ${fileName}] Loaded!`);
      return (this.mediaIndex = JSON.parse(inv.toString()) as MediaIndex);
    } catch (error: any) {
      if ('ENOENT' === error.code) {
        logger.log(`[Inventory: ${fileName}}] Non-existend, creating new inventory.`);
        return (this.mediaIndex = newMediaIndex(fileName));
      }
      throw error;
    }
  }
}

/**
 * Provide Inventory in JSON format (infos.json) for media and references to raw files
 */
@injectable
export class InventoryStorage {
  static INVENTORY_JSON_FILE = 'inventory.json';
  #fs = inject(FileSystem);
  #logger = inject(Logger);

  constructor(readonly folderName = `${process.env.FOLDER_INVENTORY}`) {}

  async loadOrCreate(path: string) {
    const fs = this.#fs();
    const logger = this.#logger();

    const directory = await fs.createDirectory(path);
    const inventory = new Inventory(directory, logger);
    const mediaIndex = await inventory.readIndex();
    logger.log(
      `[Inventory: ${path}] Inventory loaded with ${Object.keys(mediaIndex.media).length} entries`
    );
    return inventory;
  }
}
