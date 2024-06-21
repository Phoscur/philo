import { inject, injectable } from '@joist/di';
import { Logger } from './Logger.js';
import { Camera } from './Camera.js';

@injectable
export class Preset {
  #logger = inject(Logger);
  #cam = inject(Camera);

  get default() {
    try {
      return JSON.parse(`${process.env.PRESET_DEFAULT}`);
    } catch (error: any) {
      this.#logger().log('Failed to parse default preset:', error.message);
      return {};
    }
  }

  get presets() {
    try {
      return JSON.parse(`${process.env.PRESETS}`);
    } catch (error: any) {
      this.#logger().log('Failed to parse presets:', error.message);
      return {};
    }
  }

  setupPreset(name: string) {
    const cam = this.#cam();

    const preset = this.presets[name] || this.default;
    cam.options = {
      ...cam.options,
      ...preset,
    };
    this.#logger().log(
      'Preset setup:',
      this.presets[name] ? name : `"${name}" not found using "default" instead`,
      cam.options
    );
  }
}
