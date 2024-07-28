import { inject, injectable } from '@joist/di';
import { Director } from './Director.js';
import { Hardware } from './Hardware.js';
import { Logger } from './Logger.js';
import { Assets } from './Assets.js';
import type { ChatAnimationMessage, ChatMessenger } from '../context.js';
import { Input } from 'telegraf';

/**
 * Given (Telegram) messenger context, Producer will interact with the Director to stream content production.
 */
@injectable
export class Producer {
  #logger = inject(Logger);
  #director = inject(Director);
  #assets = inject(Assets);
  #hd = inject(Hardware);

  async createAnimation(chat: ChatMessenger, caption?: string): Promise<ChatAnimationMessage> {
    const spinner = this.#assets().telegramSpinner;
    const message = await chat.createAnimation(spinner, { caption });
    return message;
  }

  async shot(chat: ChatMessenger, presetName?: string) {
    const director = this.#director();
    const message = await this.createAnimation(chat, 'Taking a shot 🥃...');
    const { filename, dir } = await director.photo(presetName ?? 'default');
    await message.editMedia({
      type: 'photo',
      media: Input.fromLocalFile(dir.joinAbsolute(filename)),
    });
    // await message.editCaption(director.prettyNow, markup); - use Markup here?
    return {
      message,
      title: director.prettyNow,
    };
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
    director.scheduleSunset(
      async () => {
        // TODO? jic: await this.cancel()
        const hdStatus = await this.#hd().getStatus();
        chat.sendMessage(`🌇 Sunset is soon... Starting daily timelapse 🎥\n${hdStatus}`);
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
          } catch (e) {
            this.#logger().log('Failed to edit message:', e);
          }
          this.#logger().log('Finished producing the daily timelapse.');
        })();
      }
    );
  }
}
