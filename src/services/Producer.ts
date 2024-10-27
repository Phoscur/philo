import { inject, injectable } from '@joist/di';
import { Director } from './Director.js';
import { Hardware } from './Hardware.js';
import { Logger } from './Logger.js';
import { Assets } from './Assets.js';
import type { ChatAnimationMessage, ChatMessenger } from '../context.js';
import { Input, Markup } from 'telegraf';
import { I18nService } from './I18n.js';
import { Preset } from './Preset.js';
import { Directory } from './FileSystem.js';
import type { TimelapseEventMap } from './Timelapse.js';
import type EventEmitter from 'node:events';
import { Publisher } from './Publisher.js';

export const MEDIA = {
  SHOT: 'shot',
  TIMELAPSE: 'timelapse',
  SUNSET: 'sunset',
} as const;
export type MediaType = (typeof MEDIA)[keyof typeof MEDIA];

/**
 * Given (Telegram) messenger context, Producer will interact with the Director to stream content production.
 */
@injectable
export class Producer {
  static ACTION = {
    SHOT: 'shot',
    PRESET: 'preset',
    TIMELAPSE: 'timelapse',
    CANCEL: 'cancelRunning',
  } as const;

  static TIMELAPSES = [
    { count: 420, intervalMS: 12000, prefix: 'timelapse' },
    { count: 210, intervalMS: 12000, prefix: 'timelapse-half' },
    { count: 140, intervalMS: 12000, prefix: 'timelapse-third' },
    { count: 30, intervalMS: 2000, prefix: 'timelapse-short' },
    { count: 14, intervalMS: 2000, prefix: 'timelapse-super-short' },
  ] as const;

  #logger = inject(Logger);
  #director = inject(Director);
  #publisher = inject(Publisher);
  #presets = inject(Preset);
  #assets = inject(Assets);
  #hd = inject(Hardware);
  #i18n = inject(I18nService);

  get callbackMessagePhotograph() {
    const { t } = this.#i18n();
    return t('message.takingPhotograph');
  }
  get callbackMessageTimelapse() {
    const { t } = this.#i18n();
    return t('message.takingPhotograph');
  }
  get callbackMessageShare() {
    const { t } = this.#i18n();
    return t('message.sharingToChannel');
  }
  get callbackMessageCancel() {
    const { t } = this.#i18n();
    return t('message.canceling');
  }
  get callbackMessageAdminOnlyGuarded() {
    const { t } = this.#i18n();
    return t('message.cancelNotAllowed');
  }

  get markupOptions() {
    const { t } = this.#i18n();
    return Markup.inlineKeyboard([
      [Markup.button.callback(t('action.shotSingle'), Producer.ACTION.SHOT)],
      // i18n is unhappy and this would be unflexible:
      // Producer.TIMELAPSES.map(({ prefix }) => Markup.button.callback(t<'action.timelapse'>(('action.' + prefix) as 'action.timelapse'), prefix)),
      [
        Markup.button.callback(t('action.timelapse'), Producer.ACTION.TIMELAPSE),
        Markup.button.callback(t('action.timelapse-half'), 'timelapse-half'),
        Markup.button.callback(t('action.timelapse-third'), 'timelapse-third'),
      ],
      [
        Markup.button.callback(t('action.timelapse-short'), 'timelapse-short'),
        Markup.button.callback(t('action.timelapse-super-short'), 'timelapse-super-short'),
      ],
      [Markup.button.callback(t('action.presetSwitch'), Producer.ACTION.PRESET)],
    ]);
  }

  get markupCancel() {
    const { t } = this.#i18n();
    return Markup.inlineKeyboard([
      [Markup.button.callback(t('action.cancel'), Producer.ACTION.CANCEL)],
    ]);
  }

  async createAnimation(chat: ChatMessenger, caption?: string): Promise<ChatAnimationMessage> {
    const spinner = this.#assets().telegramSpinner;
    const message = await chat.createAnimation(spinner, { caption });
    return message;
  }

  async options(chat: ChatMessenger, presetName: string) {
    const { t } = this.#i18n();
    const presets = this.#presets();
    const presetText = presets.printPreset(presets.get(presetName));
    const { message, name } = await this.shot(chat, presetName);
    await message.editCaption(
      t('caption.options', name, presetName, presetText),
      this.markupOptions
    );
  }

  async shot(
    chat: ChatMessenger,
    presetName?: string,
    text = this.#i18n().t('animation.takingShot')
  ) {
    const director = this.#director();
    const message = await this.createAnimation(chat, text);
    const { filename, dir } = await director.photo(presetName ?? 'default');
    await message.editMedia({
      type: 'photo',
      media: Input.fromLocalFile(dir.joinAbsolute(filename)),
    });
    return {
      message,
      name: director.nameNow,
    };
  }

  async photograph(chat: ChatMessenger, presetName?: string) {
    const publisher = this.#publisher();
    const { message, name } = await this.shot(chat, presetName);
    await publisher.prepare(message, MEDIA.SHOT, name);
  }

  async timelapse(
    chat: ChatMessenger,
    {
      count,
      intervalMS,
      prefix,
      presetName,
    }: { count: number; intervalMS: number; prefix?: string; presetName?: string } = {
      count: 20,
      intervalMS: 2000,
    }
  ) {
    const director = this.#director();
    await director.setupPrivateRepo(director.repoTimelapse);
    const message = await this.createAnimation(chat);
    const datePostfix = '-' + director.nameNow;
    const events = await director.timelapse(presetName ?? 'default', {
      count,
      intervalMS,
      prefix: prefix + datePostfix,
    });

    // skipping the `started` event here (sleepMS=0)
    this.addEventListeners(events, message, MEDIA.TIMELAPSE, director.nameNow);
  }

  cancel() {
    const director = this.#director();
    return director.cancel();
  }

  scheduleDailySunset(chat: ChatMessenger) {
    const { t } = this.#i18n();
    const logger = this.#logger();
    const director = this.#director();

    director.scheduleSunset((events) => {
      logger.log('Scheduled the daily sunset timelapse.');
      events.once('started', async () => {
        const hdStatus = await this.#hd().getStatus();
        await chat.sendMessage(t('sunset.start', hdStatus));

        const message = await this.createAnimation(chat);
        await this.resetQueue();
        this.addEventListeners(events, message, MEDIA.SUNSET, director.nameNow);
      });
    });
  }

  #queue = Promise.resolve();
  #errors = 0;
  #done = false;
  /**
   * to ensure promise control on async event emitter callbacks
   * @param task waiting to edit a message
   */
  enqueue(task = async () => {}) {
    const logger = this.#logger();
    const BACKOFF_MULTIPLIER = 1000;

    const queued = this.#queue;
    this.#queue = queued.then(async () => {
      if (this.#done) {
        logger.log('Skipped a task');
        return;
      }
      if (this.#errors) {
        await new Promise((res) => setTimeout(res, this.#errors * BACKOFF_MULTIPLIER));
      }
      try {
        await task();
      } catch (e) {
        this.#errors++;
        logger.log('Failed to edit message:', e);
      }
    });
  }

  get settled() {
    return this.#queue;
  }

  async resetQueue(wait = true) {
    if (wait) await this.#queue;
    this.#queue = Promise.resolve();
    this.#errors = 0;
    this.#done = false;
  }

  private addEventListeners(
    events: EventEmitter<TimelapseEventMap>,
    message: ChatAnimationMessage,
    type: 'timelapse' | 'sunset',
    name: string,
    date = new Date()
  ) {
    const logger = this.#logger();
    const publisher = this.#publisher();
    const { t } = this.#i18n();

    const onFile = (fileName: string, dir: Directory) => {
      this.enqueue(async () => {
        const caption = t('timelapse.frameTaken', fileName);
        await message.editMedia(
          {
            type: 'photo',
            caption,
            media: Input.fromLocalFile(dir.joinAbsolute(fileName)),
          },
          this.markupCancel
        );
      });
    };

    const onVideoFrame = (frame: string, fps: string) => {
      this.enqueue(async () => {
        const caption = t('timelapse.frameRendered', frame, fps);
        await message.editCaption(caption);
      });
    };

    const onVideoRendered = (fileName: string, dir: Directory) => {
      this.enqueue(async () => {
        logger.log(`[${dir.path}] Stitched: ${fileName}`);
        const caption = t('timelapse.title', date);
        await message.editMedia({
          type: 'animation',
          caption,
          media: Input.fromLocalFile(dir.joinAbsolute(fileName), fileName),
        });
        await publisher.prepare(message, type, name);
        this.#done = true;
      });

      removeEventListeners();
      logger.log('Finished producing the timelapse.');
    };

    const errorMessage = (error: unknown) => {
      this.enqueue(async () => {
        const caption = t('timelapse.tooManyErrors');
        await message?.editCaption(caption);
      });

      removeEventListeners();
      logger.log('Canceled the timelapse with errors', error);
    };

    const removeEventListeners = () => {
      events.off('error', errorMessage);
      events.off('file', onFile);
      events.off('frame', onVideoFrame);
      events.off('rendered', onVideoRendered);
    };

    events.on('error', errorMessage);
    events.on('file', onFile);
    events.on('frame', onVideoFrame);
    events.once('rendered', onVideoRendered);
  }
}
