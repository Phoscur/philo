import { inject, injectable } from '@joist/di';
import { Directory, FileSystem } from './FileSystem.js';
import { Logger } from './Logger.js';

const APPRAISAL_SCHEMA_VERSION = 'Appraisals-1';

export interface Appraisal {
  author: string;
  rating: number;
  assessment: string;
}

export interface AppraisalList {
  [name: string]: Appraisal[];
}

export interface AppraisalIndex {
  name: string;
  version: string;
  appraisals: AppraisalList;
}

function emptyAppraisals(name: string, version = APPRAISAL_SCHEMA_VERSION): AppraisalIndex {
  return {
    name,
    version,
    appraisals: {},
  };
}

export class Appraisement {
  constructor(
    /**
     * path from env: FOLDER_INVENTORY
     */
    readonly directory: Directory,
    readonly logger: Logger,
    readonly fileName: string,
    private index: AppraisalIndex = emptyAppraisals(fileName)
  ) {}

  get prettyIndex() {
    const { appraisals } = this.index;
    const output: Record<string, number> = {};
    for (const folder in appraisals) {
      output[folder] = appraisals[folder].length;
    }
    return JSON.stringify(output, null, 2);
  }

  async addAppraisal(name: string, data: Appraisal) {
    if (!this.index.appraisals[name]) {
      this.index.appraisals[name] = [];
    }
    this.index.appraisals[name].push(data);
    await this.writeIndex();
  }

  private async writeIndex() {
    await this.directory.save(
      this.fileName,
      Buffer.from(JSON.stringify(this.index, null, 2), 'utf8')
    );
  }

  async readIndex(): Promise<AppraisalIndex> {
    const { logger, directory, fileName } = this;
    try {
      const inv = await directory.read(fileName);
      logger.log(`[Inventory: ${fileName}] Loaded!`);
      this.index = JSON.parse(inv.toString()) as AppraisalIndex;
    } catch (error: any) {
      if ('ENOENT' !== error.code) {
        throw error;
      }
      logger.log(`[Inventory: ${fileName}}] Non-existend, creating new index.`);
      this.index = emptyAppraisals(fileName);
    }
    if (APPRAISAL_SCHEMA_VERSION !== this.index.version) {
      throw new Error(
        `Parsing appraisal schema version [${this.index.version}] is not supported - current version [${APPRAISAL_SCHEMA_VERSION}]`
      );
    }
    return this.index;
  }
}

/**
 * Provide Appraisals ontop of Inventory in JSON format (appraisals.json)
 */
@injectable
export class Appraiser {
  #fs = inject(FileSystem);
  #logger = inject(Logger);

  constructor(readonly folderName = `${process.env.FOLDER_INVENTORY}`) {}

  async loadOrCreate(fileName = 'appraisals.json') {
    const fs = this.#fs();
    const logger = this.#logger();

    const path = this.folderName;
    const directory = await fs.createDirectory(path);
    const inventory = new Appraisement(directory, logger, fileName);
    const index = await inventory.readIndex();
    logger.log(
      `[Inventory: ${path}] Appraisals loaded with ${
        Object.keys(index.appraisals).length
      } file entries`
    );
    return inventory;
  }
}
