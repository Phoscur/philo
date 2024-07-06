import { Injector } from '@joist/di';

export class Logger {
  log(...args: any[]) {}
  timeLog(label?: string, ...args: any[]) {}
  time(label?: string) {}
  timeEnd(label?: string) {}
}

export const consoleInjector = new Injector([
  {
    provide: Logger,
    factory(): Logger {
      return console;
    },
  },
]);
