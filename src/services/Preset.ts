import { inject, injectable } from '@joist/di';
import { Logger } from './Logger.js';
import { Camera, StillOptions } from './Camera.js';

@injectable()
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

  get presets(): Record<string, StillOptions> {
    try {
      return JSON.parse(`${process.env.PRESETS}`);
    } catch (error: any) {
      this.#logger().log('Failed to parse presets:', error.message);
      return {};
    }
  }

  get(name: string): StillOptions {
    return this.presets[name] ?? this.default;
  }

  #setupPreset(p: StillOptions) {
    const cam = this.#cam();
    return (cam.options = {
      ...cam.options,
      ...p,
    });
  }

  setupPreset(name: string) {
    const preset = this.presets[name] || this.default;
    const options = this.#setupPreset(preset);
    this.#logger().log(
      'Preset setup:',
      this.presets[name] ?? name === 'default'
        ? name
        : `"${name}" not found using "default" instead`,
      options
    );
  }

  printPreset(preset: StillOptions) {
    const roi = preset.roi ? `ROI: ${preset.roi}` : '';
    const widthAndHeight =
      preset.width || preset.height ? `${preset.width || '*'}x${preset.height || '*'}` : '';
    return `${roi}\n${widthAndHeight}`;
  }

  setupSunset() {
    const preset = this.sunset;
    const options = this.#setupPreset(preset);
    this.#logger().log('Preset setup sunset:', options);
  }
}
