import { inject, injectable } from '@joist/di';
import { Logger } from './Logger.js';
import { Appraisement, Appraiser, CloudStudySymbol, LikeSymbol } from './Appraiser.js';
import { I18nService } from './I18n.js';
import { Markup } from 'telegraf';
import { PublicationInventory, PublicationInventoryStorage } from './PublicationInventory.js';
import { ChatMessenger } from '../context.js';

@injectable
export class Publisher {
  static ACTION = {
    PUBLISH: 'publish',
    LIKE: /like-.+/,
    STUDY: /study-.+/,
  } as const;

  /** YYYY slice from ISO */
  static year(date = new Date()) {
    return date.toISOString().slice(0, 4);
  }

  #logger = inject(Logger);
  #publications = inject(PublicationInventoryStorage);
  #appraiser = inject(Appraiser);
  #i18n = inject(I18nService);

  get publicationsFile() {
    return `publications-${Publisher.year()}.json`;
  }
  get appraisalsFile() {
    return `appraisals-${Publisher.year()}.json`;
  }

  get callbackMessageShare() {
    const { t } = this.#i18n();
    return t('message.sharingToChannel');
  }

  get markupRowLikes() {
    const appraiser = this.#appraiser();
    return appraiser.likesWithRatings.map(({ text, data }) => Markup.button.callback(text, data));
  }

  get markupRowCloudStudy() {
    const appraiser = this.#appraiser();
    return appraiser.cloudStudies.map(({ text, data }) => Markup.button.callback(text, data));
  }

  get markupPublished() {
    const { t } = this.#i18n();
    return Markup.inlineKeyboard([
      this.markupRowLikes,
      this.markupRowCloudStudy,
      [Markup.button.callback(t('action.publish'), Publisher.ACTION.PUBLISH)],
      // [Markup.button.callback('❌', ``)],
    ]);
  }

  async publish(group: ChatMessenger, messageId: number) {
    const publications = this.#publications();
    const channelMessage = await group.sendMessageCopy(messageId, this.markupPublished);
    const pubs = await publications.loadOrCreate(this.publicationsFile);
    await pubs.setPublication(channelMessage.message_id, messageId);

    return channelMessage.message_id;
  }

  async like(messageId: number, author: string, data: string) {
    const appraiser = this.#appraiser();
    const like = data.split('-')[1] as LikeSymbol; // split: like-$1
    const rating = appraiser.likeToRating(like);
    const newRating = await this.saveRating(messageId, author, rating, like);
    return appraiser.ratingToLike(newRating);
  }

  async saveCloudStudy(messageId: number, data: string) {
    const appraiser = this.#appraiser();
    const publications = this.#publications();

    const cloud = data.split('-')[1] as CloudStudySymbol; // split: cloud-$1

    const inventory = await publications.loadOrCreate(this.publicationsFile, true);
    const pub = inventory.getPublicationMessage(messageId) ?? inventory.getMessage(messageId);
    if (!pub) {
      return `Message Inventory [${messageId}] not found`;
    }

    const appraisement = await appraiser.loadOrCreate(this.appraisalsFile);
    await appraisement.setCloudStudy(pub.name, cloud);
    return cloud;
  }

  async readRating(
    messageId: number,
    openInventory?: PublicationInventory,
    openAppraisement?: Appraisement
  ): Promise<number> {
    const appraiser = this.#appraiser();

    const inventory =
      openInventory ?? (await this.#publications().loadOrCreate(this.publicationsFile, true));

    const pub = inventory.getPublicationMessage(messageId) ?? inventory.getMessage(messageId);
    if (!pub) {
      console.log('Failed to find publication', messageId, openInventory);
      return 0;
    }

    const appraisement = openAppraisement ?? (await appraiser.loadOrCreate(this.appraisalsFile));
    return appraisement.getRatingSum(pub.name);
  }

  async saveRating(messageId: number, author: string, rating: number, like: LikeSymbol) {
    const appraiser = this.#appraiser();
    const publications = this.#publications();

    const inventory = await publications.loadOrCreate(this.publicationsFile, true);
    const appraisement = await appraiser.loadOrCreate(this.appraisalsFile);

    const pub = inventory.getPublicationMessage(messageId) ?? inventory.getMessage(messageId);
    if (!pub) {
      console.log('Failed to find publication', messageId);
      return 0;
    }

    await appraisement.addAppraisal(pub.name, {
      author,
      rating,
      like,
    });

    return appraisement.getRatingSum(pub.name);
  }

  /*async enableAndWaitForPages(r) {
    const repo = this.#repo().checkout(r);
    await repo.makeTimelapsePage();
    const waitMS = 10000;
    await this.#sunMoonTime().sleep(waitMS);
    const checkIterations = 60;
    const delayMS = 5000;
    await repo.enablePages(checkIterations, 'index.html', delayMS);
  }*/
}
