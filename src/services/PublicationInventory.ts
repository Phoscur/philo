import { inject, injectable } from '@joist/di';
import { Directory, FileSystem } from './FileSystem.js';
import { Logger } from './Logger.js';

const SCHEMA_VERSION = 'Publication-1';
export interface PublicationMessage {
  id: number;
  name: string;
  created: number;
  shared?: boolean;
  channelId?: number;
}

export interface MessageCollection {
  [messageId: number]: PublicationMessage;
}
/** channelMessageId => messageId */
export interface PublicationCollection {
  [messageId: number]: number;
}
export interface PublicationIndex {
  name: string;
  version: string;
  messages: MessageCollection;
  publications: PublicationCollection;
}

function emptyPublications(name: string, version = SCHEMA_VERSION): PublicationIndex {
  return {
    name,
    version,
    messages: {},
    publications: {},
  };
}

export class PublicationInventory {
  constructor(
    /**
     * path from env: FOLDER_INVENTORY
     */
    readonly directory: Directory,
    readonly logger: Logger,
    readonly fileName: string,
    private index: PublicationIndex = emptyPublications(fileName)
  ) {}

  get prettyIndex() {
    const { messages, publications } = this.index;
    const output: Record<string, string> = {};
    for (const messageId in messages) {
      output[messageId] = `${messages[messageId].shared ? 'shared' : ''}`;
    }
    for (const messageId in publications) {
      output[messageId] = `${messages[publications[messageId]].shared ? 'shared' : '??!'} (${
        publications[messageId]
      })`;
    }
    return JSON.stringify(output, null, 2);
  }

  async setMessage(messageId: number, publicationStatus: PublicationMessage) {
    this.index.messages[messageId] = publicationStatus;
    await this.writeIndex();
  }

  getMessage(messageId: number): PublicationMessage | undefined {
    return this.index.messages[messageId];
  }

  getPublicationMessage(channelMessageId: number): PublicationMessage | undefined {
    const messageId = this.index.publications[channelMessageId];
    return this.getMessage(messageId);
  }

  async setPublication(channelMessageId: number, messageId: number) {
    this.index.publications[channelMessageId] = messageId;
    await this.writeIndex();
  }

  private async writeIndex() {
    await this.directory.save(
      this.fileName,
      Buffer.from(JSON.stringify(this.index, null, 2), 'utf8')
    );
  }

  async readIndex(): Promise<PublicationIndex> {
    const { logger, directory, fileName } = this;
    try {
      const inv = await directory.read(fileName);
      logger.log(`[Inventory: ${fileName}] Loaded!`);
      this.index = JSON.parse(inv.toString()) as PublicationIndex;
    } catch (error: any) {
      if ('ENOENT' !== error.code) {
        throw error;
      }
      logger.log(`[Inventory: ${fileName}}] Non-existend, creating new inventory.`);
      this.index = emptyPublications(fileName);
    }
    if (SCHEMA_VERSION !== this.index.version) {
      throw new Error(
        `Parsing inventory schema version [${this.index.version}] is not supported - current version [${SCHEMA_VERSION}]`
      );
    }
    return this.index;
  }
}

/**
 * Provide Publication Storage on top of Inventory in JSON format (publications.json)
 * to save the state of publications and references to their controlling messages
 */
@injectable
export class PublicationInventoryStorage {
  #fs = inject(FileSystem);
  #logger = inject(Logger);

  constructor(readonly folderName = `${process.env.FOLDER_INVENTORY}`) {}

  async loadOrCreate(fileName = 'publications.json') {
    const fs = this.#fs();
    const logger = this.#logger();

    const path = this.folderName;
    const directory = await fs.createDirectory(path);
    const inventory = new PublicationInventory(directory, logger, fileName);
    const index = await inventory.readIndex();
    logger.log(
      `[Inventory: ${path}] Inventory loaded with ${Object.keys(index.messages).length} entries`
    );
    return inventory;
  }
}
