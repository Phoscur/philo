import { inject, injectable } from '@joist/di';
import { Logger } from './Logger.js';

@injectable()
export class Queue {
  BACKOFF_MULTIPLIER = 1000;
  #logger = inject(Logger);

  constructor(public readonly defaultTaskType = '') {}

  #queue = Promise.resolve();
  #errors = 0;
  #done = false;
  /**
   * to ensure promise control on async event emitter callbacks
   * @param task to be appended
   */
  enqueue(task = async () => {}, retry = 0, taskName = this.defaultTaskType) {
    const logger = this.#logger();

    const queued = this.#queue;
    this.#queue = queued.then(async () => {
      if (this.#done) {
        logger.log(taskName, 'Skipped a task, queue is already done');
        return;
      }
      if (this.#errors) {
        logger.log(taskName, `Errors (${this.#errors}) on queue, backing off`);
        await new Promise((res) => setTimeout(res, this.#errors * this.BACKOFF_MULTIPLIER));
      }
      try {
        await task();
      } catch (e: any) {
        this.#errors++;
        logger.log(
          taskName,
          'Queue error:',
          e,
          retry ? `${retry} retries pending` : 'no retry planned'
        );

        if (retry-- > 0) {
          let retryWaitTime = this.#errors * this.BACKOFF_MULTIPLIER || 5000;
          if (e?.response?.error_code === 429) {
            const { retry_after } = e?.response?.parameters ?? {};
            retryWaitTime = retry_after * 1000 || retryWaitTime;
          }
          try {
            await new Promise((res) => setTimeout(res, retryWaitTime));
            if (this.#done) {
              logger.log(taskName, 'Skipped a retry task, queue is already done');
              return;
            }
            await task();
          } catch (re) {
            this.#errors++;
            logger.log(taskName, 'Queue error on retry:', re);
          }
        }
      }
    });
    return this;
  }

  get settled() {
    return this.#queue;
  }

  forceFinish() {
    this.#done = true;
    return this.settled;
  }

  async reset(wait = true) {
    if (wait) await this.#queue;
    this.#queue = Promise.resolve();
    this.#errors = 0;
    this.#done = false;
  }
}
