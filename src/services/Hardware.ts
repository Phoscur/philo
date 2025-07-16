import { inject, injectable, Provider } from '@joist/di';
import { getStorageStatus } from '../lib/df.js';
import { getTemperatureHumidityMessage } from '../lib/temperature.js';
import { Logger } from './Logger.js';
import { I18nService } from './I18n.js';

@injectable()
export class Hardware {
  #logger = inject(Logger);
  #i18n = inject(I18nService);

  constructor(
    readonly temperatureSensorEnabled = process.env.ENABLE_TEMPERATURE_SENSOR === 'true'
  ) {}

  async getStorageStatus(): Promise<{ size: string; percent: string }> {
    try {
      return await getStorageStatus();
    } catch (error) {
      this.#logger().log('Failed to read storage status', error);
      return {
        size: '-1',
        percent: '-1',
      };
    }
  }

  async getStatus() {
    const { t } = this.#i18n();
    const status = await this.getStorageStatus();
    const storageMessage = t('storage.status', status.size, status.percent);
    if (!this.temperatureSensorEnabled) return storageMessage;
    try {
      const temperatureMessage = await getTemperatureHumidityMessage();
      return `${storageMessage}\n${temperatureMessage}`;
    } catch (error) {
      this.#logger().log('Failed to read temperature', error);
      return storageMessage;
    }
  }
}

export const hardwareStubProvider: Provider<Hardware> = [
  Hardware,
  {
    factory() {
      @injectable()
      class HardwareStub extends Hardware {
        #i18n = inject(I18nService);
        async getStatus() {
          const { t } = this.#i18n();
          const status = { size: '-1', percent: '-1' };
          const storageMessage = t('storage.status', status.size, status.percent);
          const temperatureMessage = 'Stubbed Temperature';
          return `${storageMessage}\n${temperatureMessage}`;
        }
      }
      return new HardwareStub();
    },
  },
] as const;
