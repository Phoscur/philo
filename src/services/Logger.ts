import { Injector } from '@joist/di';

export class Logger {
  log(...args: any[]) {}
}

export const consoleInjector = new Injector([
  {
    provide: Logger,
    factory() {
      return console;
    },
  },
]);
