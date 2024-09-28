import { inject, injectable } from '@joist/di';
import { Directory, FileSystem } from './FileSystem.js';
import { Logger } from './Logger.js';
import { Markup } from 'telegraf';

const APPRAISAL_SCHEMA_VERSION = 'Appraisals-1';

export const CLOUD = {
  LESS: '☀️',
  Y: '⛅',
  ONLY: '☁️',
  RAINY: '🌦️',
  RAIN: '🌧️',
  SNOW: '🌨️',
  THUNDER: '🌩️',
  THUNDERAR: '⛈️',
} as const;
// more emojis: 🌞🌝🌙🌚🌛🌜🌃 🌑🌒🌓🌔🌕🌖🌗🌘 // TODO moon infos
export type CloudStudySymbol = (typeof CLOUD)[keyof typeof CLOUD];

export const LIKE = {
  MINUS: '🖤', //     -1
  NONE: '', //         0
  HEART: '❤️', //     +1
  GROWING: '💗', //   +2
  BRILLIANT: '💖', // >3
  FIRE: '❤️‍🔥', //      >5
  STAR: '⭐', //      >7
  FAVORITE: '🌟', //  >9
} as const;
// more emojis: 💙💚💜🤍
export type LikeSymbol = (typeof LIKE)[keyof typeof LIKE];

export function likeToRating(l: LikeSymbol) {
  switch (l) {
    case LIKE.MINUS:
      return -1;
    case LIKE.HEART:
      return 1;
    case LIKE.GROWING:
      return 2;
    default:
      return 0;
  }
}

export function ratingToLike(rating: number): LikeSymbol {
  if (rating > 9) {
    return LIKE.FAVORITE;
  }
  if (rating > 7) {
    return LIKE.STAR;
  }
  if (rating > 5) {
    return LIKE.FIRE;
  }
  if (rating > 3) {
    return LIKE.BRILLIANT;
  }
  if (rating > 1) {
    return LIKE.GROWING;
  }
  if (rating > 0) {
    return LIKE.HEART;
  }
  if (rating < 0) {
    return LIKE.MINUS;
  }
  return LIKE.NONE;
}

export interface Appraisal {
  author: string;
  rating: number;
  like: LikeSymbol;
}

export interface AppraisalList {
  [name: string]: Appraisal[];
}

export interface AppraisalIndex {
  name: string;
  version: string;
  cloudStudy?: CloudStudySymbol;
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

  get markupRowLike() {
    return [
      Markup.button.callback(`${LIKE.HEART} (+1)`, `like-${LIKE.HEART}`),
      Markup.button.callback(`${LIKE.GROWING} (+2)`, `like-${LIKE.GROWING}`),
      Markup.button.callback(`${LIKE.MINUS} (-1)`, `like-${LIKE.GROWING}`),
    ];
  }

  get markupRowCloudStudy() {
    return [
      Markup.button.callback(CLOUD.LESS, `study-${CLOUD.LESS}`),
      Markup.button.callback(CLOUD.Y, `study-${CLOUD.Y}`),
      Markup.button.callback(CLOUD.ONLY, `study-${CLOUD.ONLY}`),
      Markup.button.callback(CLOUD.RAINY, `study-${CLOUD.RAINY}`),
      Markup.button.callback(CLOUD.RAIN, `study-${CLOUD.RAIN}`),
      Markup.button.callback(CLOUD.THUNDER, `study-${CLOUD.THUNDER}`),
      Markup.button.callback(CLOUD.THUNDERAR, `study-${CLOUD.THUNDERAR}`),
      // 8 is max in a row, rather 7 for Telegram Desktop
    ];
  }

  get markup() {
    return Markup.inlineKeyboard([
      this.markupRowLike,
      this.markupRowCloudStudy,
      // [Markup.button.callback('❌', ``)],
    ]);
  }

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
