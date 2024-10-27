import { inject, injectable } from '@joist/di';
import { Logger } from './Logger.js';
import { Appraisement, Appraiser, CloudStudySymbol, LikeSymbol } from './Appraiser.js';
import { I18nService } from './I18n.js';
import { Markup } from 'telegraf';
import { PublicationInventory, PublicationInventoryStorage } from './PublicationInventory.js';
import { ChatAnimationMessage, ChatMessenger } from '../context.js';
import { MediaType } from './Producer.js';

@injectable
export class Publisher {
  static ACTION = {
    SHARE: 'share',
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

  get markupShare() {
    const { t } = this.#i18n();
    return Markup.inlineKeyboard([
      [Markup.button.callback(t('action.shareToChannel'), Publisher.ACTION.SHARE)],
    ]);
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

  #openInventory: PublicationInventory | null = null;
  async getInventory(skipReadIndex = false) {
    if (this.#openInventory) {
      return this.#openInventory;
    }
    this.#openInventory = await this.#publications().loadOrCreate(
      this.publicationsFile,
      !skipReadIndex
    );
    return this.#openInventory;
  }
  #openAppraisment: Appraisement | null = null;
  async getAppraisement(skipReadIndex = false) {
    if (this.#openAppraisment) {
      return this.#openAppraisment;
    }
    this.#openAppraisment = await this.#appraiser().loadOrCreate(
      this.appraisalsFile,
      !skipReadIndex
    );
    return this.#openAppraisment;
  }

  async getCaption(messageId: number) {
    const { t } = this.#i18n();

    const inventory = await this.getInventory();
    const pub = inventory.getPublication(messageId) ?? inventory.getDraft(messageId);
    if (!pub) {
      this.#logger().log(`Failed to find publication [${messageId}]`, inventory.prettyIndex);
      return `Error: Message [${messageId}] not found`;
    }

    const appraisement = await this.getAppraisement();
    const like = await appraisement.getLike(pub.name);
    const cloudStudy = appraisement.getCloudStudy(pub.name);
    const langKey = (pub.type + '.title') as 'timelapse.title' | 'sunset.title' | 'shot.title';
    return t(langKey, new Date(pub.created), cloudStudy, like);
  }

  async getPublication(messageId: number) {
    const { t } = this.#i18n();

    const inventory = await this.getInventory();
    const pub = inventory.getPublication(messageId) ?? inventory.getDraft(messageId);
    if (!pub) {
      this.#logger().log(`Failed to find publication [${messageId}]`, inventory.prettyIndex);
      throw new Error(`Message [${messageId}] not found`);
    }

    const appraisement = await this.getAppraisement();
    const like = await appraisement.getLike(pub.name);
    const cloudStudy = appraisement.getCloudStudy(pub.name);
    const langKey = (pub.type + '.title') as 'timelapse.title' | 'sunset.title' | 'shot.title';
    return {
      caption: t(langKey, new Date(pub.created), cloudStudy, like),
      publication: pub,
    };
  }

  async prepare(message: ChatAnimationMessage, type: MediaType, name: string) {
    const inventory = await this.getInventory(true);
    await inventory.setDraft(message.id, {
      messageId: message.id,
      name,
      type,
      created: Date.now(),
    });
    const caption = await this.getCaption(message.id);
    await message.editCaption(caption, this.markupShare);
  }

  async updateCaption(chat: ChatMessenger, messageId: number) {
    const { publication, caption } = await this.getPublication(messageId);
    if (publication.channelMessageId) {
      const channelMessage = chat.getChannelMessage(publication.channelMessageId);
      await channelMessage.editCaption(caption);
    }
    const message = chat.getMessage(publication.messageId);
    await message.editCaption(caption);
  }

  async publish(group: ChatMessenger, messageId: number) {
    const channelMessage = await group.sendMessageCopy(messageId, this.markupPublished);
    const pubs = await this.getInventory();
    await pubs.setPublication(channelMessage.message_id, messageId);

    return channelMessage.message_id;
  }

  async saveLike(messageId: number, author: string, data: string) {
    const appraiser = this.#appraiser();
    const like = data.split('-')[1] as LikeSymbol; // split: like-$1
    const rating = appraiser.likeToRating(like);
    const newRating = await this.saveRating(messageId, author, rating, like);
    return appraiser.ratingToLike(newRating);
  }

  async saveCloudStudy(messageId: number, data: string) {
    const cloud = data.split('-')[1] as CloudStudySymbol; // split: cloud-$1

    const inventory = await this.getInventory();
    const pub = inventory.getPublication(messageId) ?? inventory.getDraft(messageId);
    if (!pub) {
      return `Error: Message [${messageId}] not found`;
    }

    const appraisement = await this.getAppraisement(true);
    await appraisement.setCloudStudy(pub.name, cloud);
    return cloud;
  }

  async readRating(messageId: number): Promise<number> {
    const inventory = await this.getInventory();
    const pub = inventory.getPublication(messageId) ?? inventory.getDraft(messageId);
    if (!pub) {
      this.#logger().log(`Error: Failed to find publication [${messageId}]`, inventory.prettyIndex);
      return 0;
    }

    const appraisement = await this.getAppraisement();
    return appraisement.getRatingSum(pub.name);
  }

  async saveRating(messageId: number, author: string, rating: number, like: LikeSymbol) {
    const inventory = await this.getInventory();
    const pub = inventory.getPublication(messageId) ?? inventory.getDraft(messageId);
    if (!pub) {
      this.#logger().log(`Error: Failed to find publication [${messageId}]`, inventory.prettyIndex);
      return 0;
    }

    const appraisement = await this.getAppraisement(true);
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
