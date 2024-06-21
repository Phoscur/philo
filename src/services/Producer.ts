import { inject, injectable } from '@joist/di';
import { Director } from './Director.js';
import { Hardware } from './Hardware.js';
import type { PhiloContext } from '../context.js';
import { Logger } from './Logger.js';

/**
 * Given messenger context, Producer will interact with the Director to produce content.
 */
@injectable
export class Producer {
  #logger = inject(Logger);
  #director = inject(Director);
  #hd = inject(Hardware);

  scheduleDailySunset(ctx: PhiloContext) {
    this.#director().scheduleSunset(
      async () => {
        const hdStatus = await this.#hd().getStatus();
        ctx.group.sendMessage(`Sunset is soon... Starting daily timelapse!\n${hdStatus}`);
      },
      () => {
        this.#logger().log('Finished producing the daily timelapse.');
      }
    );
  }
}
