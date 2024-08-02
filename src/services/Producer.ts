import { inject, injectable } from '@joist/di';
import { Director } from './Director.js';
import { Hardware } from './Hardware.js';
import { Logger } from './Logger.js';
import { Assets } from './Assets.js';
import type { ChatAnimationMessage, ChatMessenger } from '../context.js';
import { Input, Markup } from 'telegraf';
import { I18nService } from './I18n.js';
import { Preset } from './Preset.js';

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
        Markup.button.callback(t('action.timelapse-half'), 'half-timelapse'),
        Markup.button.callback(t('action.timelapse-third'), 'third-timelapse'),
      ],
      [
        Markup.button.callback(t('action.timelapse-short'), 'short-timelapse'),
        Markup.button.callback(t('action.timelapse-super-short'), 'super-short-timelapse'),
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
    const markup = Markup.inlineKeyboard([[Markup.button.callback('Share 📢', 'share')]]);
    await message.editCaption(title, markup);
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
    const { output, dir } = await director.timelapse(
      presetName ?? 'default',
      { count, intervalMS, prefix: prefix + datePostfix },
      (filename, dir) => {
        (async () => {
          try {
            const caption = `Last Timelapse frame created: ${filename}`;
            await message.editMedia({
              type: 'photo',
              caption,
              media: Input.fromLocalFile(dir.joinAbsolute(filename)),
            });
          } catch (e) {
            this.#logger().log('Failed to edit message:', e);
          }
        })();
      }
    );
    const caption = `[${dir.path}] Stitched: ${output}`;
    this.#logger().log(caption);
    await message.editMedia({
      type: 'animation',
      caption,
      media: Input.fromLocalFile(dir.joinAbsolute(output)),
    });
  }

  cancel() {
    const director = this.#director();
    return director.cancel();
  }

  scheduleDailySunset(chat: ChatMessenger) {
    const director = this.#director();
    let message: ChatAnimationMessage;
    let title: string;
    director.scheduleSunset(
      async () => {
        // TODO? jic: await this.cancel()
        const hdStatus = await this.#hd().getStatus();
        chat.sendMessage(`🌇 Sunset is soon... Starting daily timelapse 🎥\n${hdStatus}`);
        title = this.getTitleNow();
      },
      (filename, dir) => {
        (async () => {
          try {
            if (!message) {
              message = await this.createAnimation(chat);
            }
            const caption = `Last Timelapse frame created: ${filename}`;
            await message.editMedia({
              type: 'photo',
              caption,
              media: Input.fromLocalFile(dir.joinAbsolute(filename)),
            });
            await message.editCaption(caption, this.markupCancel);
          } catch (e) {
            this.#logger().log('Failed to edit message:', e);
          }
        })();
      },
      (output, dir) => {
        (async () => {
          try {
            if (!message) {
              message = await this.createAnimation(chat);
            }
            const caption = `[${dir.path}] Stitched: ${output}`;
            await message.editMedia({
              type: 'animation',
              caption,
              media: Input.fromLocalFile(dir.joinAbsolute(output)),
            });
            await message.editCaption(title, this.markupShare);
          } catch (e) {
            this.#logger().log('Failed to edit message:', e);
          }
          this.#logger().log('Finished producing the daily timelapse.');
        })();
      }
    );
  }
}
