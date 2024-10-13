import { inject, injectable } from '@joist/di';
import { Directory, FileSystem } from './FileSystem.js';
import { Logger } from './Logger.js';
import { MediaType } from './Producer.js';

const PUBLICATION_SCHEMA_VERSION = 'Publication-1';
export interface PublicationMessage {
  messageId: number;
  name: string;
  type: MediaType;
  created: number;
  channelMessageId?: number;
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

function emptyPublications(name: string, version = PUBLICATION_SCHEMA_VERSION): PublicationIndex {
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
      const id = messages[messageId].channelMessageId;
      output[messageId] = id ? `shared as ${id}` : 'not shared';
    }
    for (const messageId in publications) {
      const id = messages[publications[messageId]].channelMessageId;
      output[messageId] = `shared from ${publications[messageId]}`;
    }
    return JSON.stringify(output, null, 2);
  }

  async setMessage(messageId: number, publicationStatus: PublicationMessage) {
    await this.readIndex();
    this.index.messages[messageId] = publicationStatus;
    await this.writeIndex();
  }

  getMessage(messageId: number): PublicationMessage | undefined {
    return this.index.messages[messageId];
  }

  getCaptionDate(messageId: number) {
    const message = this.getMessage(messageId);
  }

  getPublicationMessage(channelMessageId: number): PublicationMessage | undefined {
    const messageId = this.index.publications[channelMessageId];
    return this.getMessage(messageId);
  }

  async setPublication(channelMessageId: number, messageId: number) {
    await this.readIndex();
    this.index.messages[messageId].channelMessageId = channelMessageId;
    this.index.publications[channelMessageId] = messageId;
    await this.writeIndex();
  }

  private async writeIndex() {
    await this.directory.saveJSON(this.fileName, this.index);
  }

  async readIndex(): Promise<PublicationIndex> {
    const { logger, directory, fileName } = this;
    this.index = (await directory.readJSON(fileName)) as PublicationIndex;
    if (null === this.index) {
      logger.log(`[${this.directory.path}/${fileName}] Found non-existend, creating new indexes!`);
      this.index = emptyPublications(fileName);
    }
    if (PUBLICATION_SCHEMA_VERSION !== this.index.version) {
      throw new Error(
        `Parsing inventory schema version [${this.index.version}] is not supported - current version [${PUBLICATION_SCHEMA_VERSION}]`
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

  async loadOrCreate(fileName = 'publications.json', readIndex = false) {
    const fs = this.#fs();
    const logger = this.#logger();

    const path = this.folderName;
    const directory = await fs.createDirectory(path);
    const inventory = new PublicationInventory(directory, logger, fileName);
    if (readIndex) {
      const index = await inventory.readIndex();
      logger.log(`[${path}/${fileName}] Loaded with ${Object.keys(index.messages).length} entries`);
    }
    return inventory;
  }
}
