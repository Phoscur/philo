import { Provider } from '@joist/di';

export class Logger {
  log(...args: any[]) {}
  timeLog(label?: string, ...args: any[]) {}
  time(label?: string) {}
  timeEnd(label?: string) {}
}

export const consoleProvider: Provider<Logger> = {
  provide: Logger,
  factory(): Logger {
    return console;
  },
} as const;
