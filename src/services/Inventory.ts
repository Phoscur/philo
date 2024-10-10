import { inject, injectable } from '@joist/di';
import { Directory, FileSystem } from './FileSystem.js';
import { Logger } from './Logger.js';

const INVENTORY_SCHEMA_VERSION = 'Inventory-1';
export interface InventoryIndex {
  [folder: string]: string[];
  /* refs previous version (0):
  [folder: string]: { vault?: string, files: string[] };
  */
}

export interface MediaIndex {
  name: string;
  version: string;
  vault?: string;
  /** list of videos */
  media: InventoryIndex;
  /** list of photos */
  raw: InventoryIndex;
}

function emptyMediaIndex(
  name: string,
  vault?: string,
  version = INVENTORY_SCHEMA_VERSION
): MediaIndex {
  return {
    name,
    version,
    vault,
    media: {},
    raw: {},
  };
}

export class Inventory {
  constructor(
    /**
     * path from env: FOLDER_INVENTORY
     */
    readonly directory: Directory,
    readonly logger: Logger,
    readonly fileName: string,
    private mediaIndex: MediaIndex = emptyMediaIndex(fileName)
  ) {}

  get prettyIndex() {
    const { raw } = this.mediaIndex;
    const output: Record<string, number> = {};
    for (const folder in raw) {
      output[folder] = raw[folder].length;
    }
    return JSON.stringify(output, null, 2);
  }

  async addRaw(folder: string, name: string) {
    if (!this.mediaIndex.raw[folder]) {
      this.mediaIndex.raw[folder] = [];
    }
    this.mediaIndex.raw[folder].push(name);
    await this.writeIndex();
  }

  async addMedia(folder: string, name: string) {
    if (!this.mediaIndex.media[folder]) {
      this.mediaIndex.media[folder] = [];
    }
    this.mediaIndex.media[folder].push(name);
    await this.writeIndex();
  }

  private async writeIndex() {
    await this.directory.saveJSON(this.fileName, this.mediaIndex);
  }

  async readIndex(): Promise<MediaIndex> {
    const { logger, directory, fileName } = this;
    this.mediaIndex = (await directory.readJSON(fileName)) as MediaIndex;
    if (null === this.mediaIndex) {
      logger.log(
        `[${this.directory.path}/${fileName}}] Found non-existend, creating new inventory.`
      );
      this.mediaIndex = emptyMediaIndex(fileName);
    }
    if (INVENTORY_SCHEMA_VERSION !== this.mediaIndex.version) {
      throw new Error(
        `Parsing inventory schema version [${this.mediaIndex.version}] is not supported - current version [${INVENTORY_SCHEMA_VERSION}]`
      );
    }
    return this.mediaIndex;
  }
}

/**
 * Provide Inventory in JSON format (inventory.json) for generated video media and references to raw photo files
 */
@injectable
export class InventoryStorage {
  #fs = inject(FileSystem);
  #logger = inject(Logger);

  constructor(readonly folderName = `${process.env.FOLDER_INVENTORY}`) {}

  async loadOrCreate(fileName = 'inventory.json') {
    const fs = this.#fs();
    const logger = this.#logger();

    const path = this.folderName;
    const directory = await fs.createDirectory(path);
    const inventory = new Inventory(directory, logger, fileName);
    const mediaIndex = await inventory.readIndex();
    logger.log(
      `[Inventory: ${path}] Inventory loaded with ${Object.keys(mediaIndex.media).length} entries`
    );
    return inventory;
  }
}
