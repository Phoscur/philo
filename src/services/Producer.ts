import { inject, injectable } from '@joist/di';
import { Director } from './Director.js';
import { Hardware } from './Hardware.js';
import { Logger } from './Logger.js';
import { Assets } from './Assets.js';
import type { ChatAnimationMessage, ChatMessenger } from '../context.js';

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
    const assets = this.#assets();
    const animation = assets.spinnerAnimation.media;
    const message = await chat.createAnimation(animation, { caption });
    return message;
  }

  async shot(chat: ChatMessenger, presetName?: string) {
    const director = this.#director();
    const message = await this.createAnimation(chat, 'Taking a shot 🥃...');
    const media = await director.photo(presetName ?? 'default');
    await message.editMedia({ type: 'photo', media });
    // await message.editCaption(director.prettyNow, markup); - use Markup here?
    return {
      message,
      media,
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
    await director.timelapse(presetName ?? 'default', { count, intervalMS, prefix }, (filename) => {
      (async () => {
        try {
          await message.editCaption(`Last Timelapse frame created: ${filename}`);
          await message.editMedia({ type: 'animation', media: { url: filename } });
        } catch (e) {
          this.#logger().log('Failed to edit message:', e);
        }
      })();
    });
    // TODO stitch
  }

  cancel() {
    const director = this.#director();
    return director.cancel();
  }

  scheduleDailySunset(chat: ChatMessenger) {
    const director = this.#director();
    director.scheduleSunset(
      async () => {
        // TODO? jic: await this.cancel()
        const hdStatus = await this.#hd().getStatus();
        chat.sendMessage(`🌇 Sunset is soon... Starting daily timelapse 🎥\n${hdStatus}`);
      },
      () => {
        this.#logger().log('Finished producing the daily timelapse.');
      }
    );
  }
}
