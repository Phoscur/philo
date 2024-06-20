import { inject, injectable } from '@joist/di';
import { Repository } from './Repository.js';
import { Logger } from './Logger.js';

@injectable
export class Timelapse {
  #logger = inject(Logger);
  #repo = inject(Repository);
}
