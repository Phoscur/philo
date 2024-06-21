import { inject, injectable } from '@joist/di';
import { Logger } from './Logger.js';
import { Camera, PiCameraConfig } from './Camera.js';

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

  get sunset() {
    try {
      return JSON.parse(`${process.env.PRESET_SUNSET}`);
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

  #setupPreset(p: PiCameraConfig, name: string) {
    const cam = this.#cam();
    return (cam.options = {
      ...cam.options,
      ...p,
    });
  }

  setupPreset(name: string) {
    const preset = this.presets[name] || this.default;
    const options = this.#setupPreset(preset, name);
    this.#logger().log(
      'Preset setup:',
      this.presets[name] ? name : `"${name}" not found using "default" instead`,
      options
    );
  }

  setupSunset() {
    const preset = this.sunset;
    const options = this.#setupPreset(preset, 'sunset');
    this.#logger().log('Preset setup sunset:', options);
  }

  printCurrent(timelapseOptions = { interval: 0, count: 0 }) {
    return this.#cam().printOptions(timelapseOptions.interval, timelapseOptions.count);
  }
}
