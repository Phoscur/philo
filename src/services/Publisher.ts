import { inject, injectable } from '@joist/di';
import { Logger } from './Logger.js';
import { Appraisement, Appraiser, CloudStudySymbol, LikeSymbol } from './Appraiser.js';
import { I18nService } from './I18n.js';
import { Markup } from 'telegraf';
import { PublicationInventory, PublicationInventoryStorage } from './PublicationInventory.js';

@injectable
export class Publisher {
  static ACTION = {
    PUBLISH: 'publish',
    LIKE: /like-.+/,
  } as const;

  #logger = inject(Logger);
  #publications = inject(PublicationInventoryStorage);
  #appraiser = inject(Appraiser);
  #i18n = inject(I18nService);

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

  async like(messageId: number, author: string, data: string) {
    const appraiser = this.#appraiser();
    const like = data.split('-')[1] as LikeSymbol; // split: like-$1
    const rating = appraiser.likeToRating(like);
    const newRating = await this.saveRating(messageId, author, rating, like);
    return appraiser.ratingToLike(newRating);
  }

  async setCloudStudy(messageId: number, data: string) {
    const appraiser = this.#appraiser();
    const publications = this.#publications();

    const cloud = data.split('-')[1] as CloudStudySymbol; // split: cloud-$1

    const inventory = await publications.loadOrCreate();
    const pub = inventory.getPublicationMessage(messageId) ?? inventory.getMessage(messageId);
    if (!pub) {
      return;
    }

    const appraisement = await appraiser.loadOrCreate();
    return appraisement.setCloudStudy(cloud);
  }

  async readRating(
    messageId: number,
    openInventory?: PublicationInventory,
    openAppraisement?: Appraisement
  ): Promise<number> {
    const appraiser = this.#appraiser();

    const inventory = openInventory ?? (await this.#publications().loadOrCreate());

    const pub = inventory.getPublicationMessage(messageId) ?? inventory.getMessage(messageId);
    if (!pub) {
      return 0;
    }

    const appraisement = openAppraisement ?? (await appraiser.loadOrCreate());
    return appraisement.getRatingSum(pub.name);
  }

  async saveRating(messageId: number, author: string, rating: number, like: LikeSymbol) {
    const appraiser = this.#appraiser();
    const publications = this.#publications();

    const inventory = await publications.loadOrCreate();
    const appraisement = await appraiser.loadOrCreate();

    const pub = inventory.getPublicationMessage(messageId) ?? inventory.getMessage(messageId);
    if (!pub) {
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
