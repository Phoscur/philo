import { Provider } from '@joist/di';

export class Logger {
  log(..._args: any[]) {}
  timeLog(_label?: string, ..._args: any[]) {}
  time(_label?: string) {}
  timeEnd(_label?: string) {}
}

export const consoleProvider: Provider<Logger> = {
  provide: Logger,
  factory(): Logger {
    return console;
  },
} as const;
