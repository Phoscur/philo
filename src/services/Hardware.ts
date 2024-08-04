import { inject, injectable } from '@joist/di';
import { getStorageStatus } from '../lib/df.js';
import { getTemperatureHumidityMessage } from '../lib/temperature.js';
import { Logger } from './Logger.js';
import { I18nService } from './I18n.js';

@injectable
export class Hardware {
  #logger = inject(Logger);
  #i18n = inject(I18nService);

  constructor(
    readonly temperatureSensorEnabled = process.env.ENABLE_TEMPERATURE_SENSOR === 'true'
  ) {}

  async getStatus() {
    const { t } = this.#i18n();
    const status = await getStorageStatus();
    const storageMessage = t('storage.status', status.size, status.percent);
    if (!this.temperatureSensorEnabled) return storageMessage;
    try {
      const temperatureMessage = await getTemperatureHumidityMessage();
      return `${temperatureMessage}\n${storageMessage}`;
    } catch (error) {
      this.#logger().log('Failed to read temperature', error);
      return storageMessage;
    }
  }
}
