import { inject, injectable } from '@joist/di';
import { getStorageStatus } from '../lib/df.js';
import { getTemperatureHumidityMessage } from '../lib/temperature.js';
import { Logger } from './Logger.js';

@injectable
export class Hardware {
  #logger = inject(Logger);

  constructor(
    readonly temperatureSensorEnabled = process.env.ENABLE_TEMPERATURE_SENSOR === 'true'
  ) {}

  async getStatus() {
    const status = await getStorageStatus();
    const storageMessage = `Storage (${status.size}): ${status.percent}`;
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
