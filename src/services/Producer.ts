import { inject, injectable } from '@joist/di';
import { Director } from './Director.js';
import { Hardware } from './Hardware.js';
import { Logger } from './Logger.js';
import { Assets } from './Assets.js';
import type { ChatAnimationMessage, ChatMessenger } from '../context.js';

/**
 * Given messenger context, Producer will interact with the Director to produce content.
 */
@injectable
export class Producer {
  #logger = inject(Logger);
  #director = inject(Director);
  #assets = inject(Assets);
  #hd = inject(Hardware);

  async createAnimation(chat: ChatMessenger): Promise<ChatAnimationMessage> {
    const assets = this.#assets();
    const animation = assets.spinnerAnimation.media;
    const message = await chat.createAnimation(animation);
    return message;
  }

  async timelapse(chat: ChatMessenger) {
    const director = this.#director();
    await director.setupPublicRepo(director.repoTimelapse);
    const message = await this.createAnimation(chat);
    await director.timelapse('default', { count: 100, intervalMS: 2000 }, (filename) => {
      (async () => {
        try {
          await message.editCaption(`Last Timelapse frame created: ${filename}`);
          await message.editMedia({ type: 'animation', media: { url: filename } });
        } catch (e) {
          this.#logger().log('Failed to edit message:', e);
        }
      })();
    });
  }

  scheduleDailySunset(chat: ChatMessenger) {
    const director = this.#director();
    director.scheduleSunset(
      async () => {
        const hdStatus = await this.#hd().getStatus();
        chat.sendMessage(`Sunset is soon... Starting daily timelapse!\n${hdStatus}`);
      },
      () => {
        this.#logger().log('Finished producing the daily timelapse.');
      }
    );
  }
}
