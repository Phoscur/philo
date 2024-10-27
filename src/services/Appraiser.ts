import { inject, injectable } from '@joist/di';
import { Directory, FileSystem } from './FileSystem.js';
import { Logger } from './Logger.js';

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
  // 8 is max in a row, rather 7 for Telegram Desktop
} as const;
// more emojis: 🌞🌝🌙🌚🌛🌜🌃 🌑🌒🌓🌔🌕🌖🌗🌘 // TODO moon infos
export type CloudStudySymbol = (typeof CLOUD)[keyof typeof CLOUD];

export const LIKE = {
  MINUS: '🖤', //     -1
  NONE: '💟', //       0
  HEART: '❤️', //     +1
  GROWING: '💗', //   +2
  BRILLIANT: '💖', // >3
  FIRE: '❤️‍🔥', //      >5
  STAR: '⭐', //      >7
  FAVORITE: '🌟', //  >9
} as const;
// more emojis: 💙💚💜🤍💟
export type LikeSymbol = (typeof LIKE)[keyof typeof LIKE];

export function likeToRating(l: LikeSymbol | string) {
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
  [name: string]: {
    votes: Appraisal[];
    cloudStudy?: CloudStudySymbol;
  };
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
    const output: Record<string, number | string | undefined> = {};
    for (const folder in appraisals) {
      const voteCount = appraisals[folder].votes.length;
      const cloudStudy = appraisals[folder].cloudStudy ?? '';
      output[folder] = `${cloudStudy}#${voteCount}`;
    }
    return JSON.stringify(output, null, 2);
  }

  async addAppraisal(name: string, data: Appraisal) {
    await this.readIndex();
    if (!this.index.appraisals[name]) {
      this.index.appraisals[name] = { votes: [] };
    }
    this.index.appraisals[name].votes.push(data);
    await this.writeIndex();
  }

  getRatingSum(name: string) {
    return this.index.appraisals[name].votes.reduce((sum, { rating }) => sum + rating, 0);
  }

  getLike(name: string) {
    const hasVotes = this.index.appraisals[name]?.votes.length > 0;
    return hasVotes ? ratingToLike(this.getRatingSum(name)) : '';
  }

  async setCloudStudy(name: string, cloud: CloudStudySymbol) {
    await this.readIndex();
    if (!this.index.appraisals[name]) {
      this.index.appraisals[name] = { votes: [] };
    }
    this.index.appraisals[name].cloudStudy = cloud;
    await this.writeIndex();
  }

  getCloudStudy(name: string) {
    return this.index.appraisals[name]?.cloudStudy ?? '';
  }

  private async writeIndex() {
    await this.directory.saveJSON(this.fileName, this.index);
  }

  async readIndex(): Promise<AppraisalIndex> {
    const { logger, directory, fileName } = this;
    this.index = (await directory.readJSON(fileName)) as AppraisalIndex;
    if (null === this.index) {
      logger.log(`[${this.directory.path}/${fileName}] Found non-existend, creating new index!`);
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
  static LIKE_CHOICES = [LIKE.HEART, LIKE.GROWING, LIKE.MINUS] as const;

  #fs = inject(FileSystem);
  #logger = inject(Logger);

  likeToRating = likeToRating;
  ratingToLike = ratingToLike;

  constructor(readonly folderName = `${process.env.FOLDER_INVENTORY}`) {}

  likeText(like: LikeSymbol) {
    return likeToRating(like) < 0 ? likeToRating(like) : '+' + likeToRating(like);
  }

  get likesWithRatings() {
    return Appraiser.LIKE_CHOICES.map((like) => ({
      text: `${like} (${this.likeText(like)})`,
      data: `like-${like}`,
    }));
  }

  get cloudStudies() {
    return Object.values(CLOUD).map((cloud) => ({
      text: cloud,
      data: `study-${cloud}`,
    }));
  }

  async loadOrCreate(fileName = 'appraisals.json', readIndex = false) {
    const fs = this.#fs();
    const logger = this.#logger();

    const path = this.folderName;
    const directory = await fs.createDirectory(path);
    const inventory = new Appraisement(directory, logger, fileName);
    if (readIndex) {
      const index = await inventory.readIndex();
      logger.log(
        `[${path}/${fileName}] Loaded with ${Object.keys(index.appraisals).length} entries`
      );
    }
    return inventory;
  }
}
