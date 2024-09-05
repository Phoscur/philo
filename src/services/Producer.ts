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

/**
 * Given (Telegram) messenger context, Producer will interact with the Director to stream content production.
 */
@injectable
export class Producer {
  #logger = inject(Logger);
  #director = inject(Director);
  #presets = inject(Preset);
  #assets = inject(Assets);
  #hd = inject(Hardware);
  #i18n = inject(I18nService);

  getTitleNow(d = new Date()) {
    return `${d.getDate()}.${
      d.getMonth() + 1
    }.${d.getFullYear()} ${d.getHours()}:${d.getMinutes()}`;
  }

  get markupOptions() {
    const { t } = this.#i18n();
    return Markup.inlineKeyboard([
      [Markup.button.callback(t('action.shotSingle'), 'shot')],
      [
        Markup.button.callback(t('action.timelapse'), 'timelapse'),
        Markup.button.callback(t('action.timelapse-half'), 'timelapse-half'),
        Markup.button.callback(t('action.timelapse-third'), 'timelapse-third'),
      ],
      [
        Markup.button.callback(t('action.timelapse-short'), 'timelapse-short'),
        Markup.button.callback(t('action.timelapse-super-short'), 'timelapse-super-short'),
      ],
      [Markup.button.callback(t('action.presetSwitch'), 'preset')],
    ]);
  }
  get markupShare() {
    const { t } = this.#i18n();
    return Markup.inlineKeyboard([[Markup.button.callback(t('action.shareToChannel'), 'share')]]);
  }
  get markupCancel() {
    const { t } = this.#i18n();
    return Markup.inlineKeyboard([[Markup.button.callback(t('action.cancel'), 'cancelRunning')]]);
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
    const { message, name: title } = await this.shot(chat, presetName);
    // add share button (repost in CHANNEL_CHAT_ID with different caption)
    await message.editCaption(title, this.markupShare);
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
    this.addEventListeners(events, message);
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
        chat.sendMessage(t('sunset.start', hdStatus));

        const message = await this.createAnimation(chat);
        this.addEventListeners(events, message);
      });
    });
  }

  private addEventListeners(
    events: EventEmitter<TimelapseEventMap>,
    message: ChatAnimationMessage,
    date = new Date()
  ) {
    const logger = this.#logger();

    const onFile = this.editMessageOnPhotoFile(message);
    const onVideoFrame = this.editMessageOnVideoFrame(message);
    const onVideoRendered = this.editMessageOnVideoFile(message, date);
    const finishHandler = async (fileName: string, dir: Directory) => {
      await onVideoRendered(fileName, dir);
      removeEventListeners();
      logger.log('Finished producing the timelapse.');
    };
    const errorMessage = this.editMessageOnError(message);
    const errorHandler = async (error: unknown) => {
      await errorMessage();
      removeEventListeners();
      logger.log('Canceled the timelapse with errors', error);
    };

    const removeEventListeners = () => {
      events.off('error', errorHandler);
      events.off('file', onFile);
      events.off('frame', onVideoFrame);
      events.off('rendered', finishHandler);
    };

    events.on('error', errorHandler);
    events.on('file', onFile);
    events.on('frame', onVideoFrame);
    events.once('rendered', finishHandler);
  }

  editMessageOnPhotoFile(message: ChatAnimationMessage) {
    const logger = this.#logger();
    const { t } = this.#i18n();
    return async (filename: string, dir: Directory) => {
      try {
        const caption = t('timelapse.frameTaken', filename);
        await message.editMedia(
          {
            type: 'photo',
            caption,
            media: Input.fromLocalFile(dir.joinAbsolute(filename)),
          },
          this.markupCancel
        );
      } catch (e) {
        logger.log('Failed to edit message:', e);
      }
    };
  }

  editMessageOnVideoFile(message: ChatAnimationMessage, date: Date) {
    const logger = this.#logger();
    const { t } = this.#i18n();
    return async (fileName: string, dir: Directory) => {
      try {
        logger.log(`[${dir.path}] Stitched: ${fileName}`);
        const caption = t('sunset.title', date);
        await message.editMedia(
          {
            type: 'animation',
            caption,
            media: Input.fromLocalFile(dir.joinAbsolute(fileName)),
          },
          this.markupShare
        );
      } catch (e) {
        logger.log('Failed to edit message:', e);
      }
    };
  }

  editMessageOnVideoFrame(message: ChatAnimationMessage) {
    const logger = this.#logger();
    const { t } = this.#i18n();
    return async (frame: string, fps: string) => {
      try {
        const caption = t('timelapse.frameRendered', frame, fps);
        await message.editCaption(caption);
      } catch (e) {
        logger.log('Failed to edit message:', e);
      }
    };
  }

  editMessageOnError(message: ChatAnimationMessage) {
    const logger = this.#logger();
    const { t } = this.#i18n();
    return async () => {
      try {
        const caption = t('timelapse.tooManyErrors');
        await message?.editCaption(caption);
      } catch (e) {
        logger.log('Failed to edit message:', e);
      }
    };
  }
}
