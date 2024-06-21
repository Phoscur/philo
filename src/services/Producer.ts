import { inject, injectable } from '@joist/di';
import { Director } from './Director.js';
import { Hardware } from './Hardware.js';
import { Logger } from './Logger.js';
import type { MessengerChat } from '../context.js';

/**
 * Given messenger context, Producer will interact with the Director to produce content.
 */
@injectable
export class Producer {
  #logger = inject(Logger);
  #director = inject(Director);
  #hd = inject(Hardware);

  scheduleDailySunset(chat: MessengerChat) {
    this.#director().scheduleSunset(
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
