// ## Adaption of the (MIT licensed) code from [pi-camera-connect](https://github.com/launchcodedev/pi-camera-connect/blob/master/src/lib/still-camera.ts)
import { stat } from 'node:fs/promises';
import { spawnPromise } from './spawn.js';

const { DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_DELAY } = process.env;

export enum Rotation {
  Rotate0 = 0,
  Rotate90 = 90,
  Rotate180 = 180,
  Rotate270 = 270,
}

export enum Flip {
  None = 'none',
  Horizontal = 'horizontal',
  Vertical = 'vertical',
  Both = 'both',
}

export enum ExposureMode {
  Off = 'off',
  Auto = 'auto',
  Night = 'night',
  NightPreview = 'nightpreview',
  Backlight = 'backlight',
  Spotlight = 'spotlight',
  Sports = 'sports',
  Snow = 'snow',
  Beach = 'beach',
  VeryLong = 'verylong',
  FixedFps = 'fixedfps',
  AntiShake = 'antishake',
  Fireworks = 'fireworks',
}

export enum AwbMode {
  Off = 'off',
  Auto = 'auto',
  Sun = 'sun',
  Cloud = 'cloud',
  Shade = 'shade',
  Tungsten = 'tungsten',
  Fluorescent = 'fluorescent',
  Incandescent = 'incandescent',
  Flash = 'flash',
  Horizon = 'horizon',
  GreyWorld = 'greyworld',
}

// TODO type Imxfx
// export enum ImxFxMode {}

export interface StillOptions {
  width?: number | string;
  height?: number | string;
  rotation?: Rotation;
  flip?: Flip;
  delay?: number;
  shutter?: number;
  sharpness?: number;
  contrast?: number;
  brightness?: number;
  saturation?: number;
  iso?: number;
  exposureCompensation?: number;
  exposureMode?: ExposureMode;
  awbMode?: AwbMode;
  analogGain?: number;
  digitalGain?: number;
  roi?: string;
  output?: string;
}

/**
 * Build the `rpicam-still` argument list for a set of options, **excluding** `--output`
 * (the caller/daemon owns the destination). Includes `--nopreview` and applies the same
 * width/height/rotation/flip/delay defaults as {@link StillCamera}. This is the single
 * source of truth for capture args, shared by the local `StillCamera` and the philo-optic
 * HTTP client (`Camera`), so the arg logic is never duplicated.
 */
export function buildStillArgs(options: StillOptions): string[] {
  const o: StillOptions = {
    rotation: Rotation.Rotate0,
    flip: Flip.None,
    delay: Number(DEFAULT_DELAY || '') || 500,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    ...options,
  };
  return [
    ...(o.width ? ['--width', o.width.toString()] : []),
    ...(o.height ? ['--height', o.height.toString()] : []),
    ...(o.rotation ? ['--rotation', o.rotation.toString()] : []),
    ...(o.flip && (o.flip === Flip.Horizontal || o.flip === Flip.Both) ? ['--hflip'] : []),
    ...(o.flip && (o.flip === Flip.Vertical || o.flip === Flip.Both) ? ['--vflip'] : []),
    ...(o.shutter ? ['--shutter', o.shutter.toString()] : []),
    ...(o.sharpness ? ['--sharpness', o.sharpness.toString()] : []),
    ...(o.contrast ? ['--contrast', o.contrast.toString()] : []),
    ...(o.brightness || o.brightness === 0 ? ['--brightness', o.brightness.toString()] : []),
    ...(o.saturation ? ['--saturation', o.saturation.toString()] : []),
    ...(o.iso ? ['--ISO', o.iso.toString()] : []),
    ...(o.exposureCompensation ? ['--ev', o.exposureCompensation.toString()] : []),
    ...(o.exposureMode ? ['--exposure', o.exposureMode.toString()] : []),
    ...(o.awbMode ? ['--awb', o.awbMode.toString()] : []),
    ...(o.analogGain ? ['--analoggain', o.analogGain.toString()] : []),
    ...(o.digitalGain ? ['--digitalgain', o.digitalGain.toString()] : []),
    '--timeout',
    o.delay!.toString(),
    ...(o.roi ? ['--roi', o.roi.toString()] : []),
    '--nopreview',
  ];
}

export class StillCamera {
  private readonly options: StillOptions;

  static readonly jpegSignature = Buffer.from([0xff, 0xd8, 0xff, 0xe1]);

  constructor(options: StillOptions = {}) {
    const width = DEFAULT_WIDTH;
    const height = DEFAULT_HEIGHT;
    const delay = Number(DEFAULT_DELAY || '') || 500;
    this.options = {
      rotation: Rotation.Rotate0,
      flip: Flip.None,
      delay,
      width,
      height,
      ...options,
    };
  }
  async takeImage() {
    try {
      const image = await spawnPromise(
        'rpicam-still',
        [...buildStillArgs(this.options), '--output', this.options.output ?? '-'],
        undefined,
        true
      );
      //console.log('Image taken!', image?.length);
      // `spawnPromise` resolves on stdout-close and ignores the exit code (it is shared
      // with rsync/ssh/df, so we must not change it here). When rpicam-still writes to a
      // file and fails (sensor hiccup, timeout, "failed to start camera"), it exits non-zero
      // and writes nothing, yet the promise still resolves. Without this check the timelapse
      // loop counts it as a success and advances the frame counter, leaving a permanent hole
      // (and truncating the ffmpeg render at the first gap). Verify a non-empty file landed;
      // throwing makes Camera.photo reject so the loop retries the same frame number.
      const out = this.options.output;
      if (out && out !== '-') {
        const size = await stat(out).then((s) => s.size, () => 0);
        if (!size) {
          throw new Error(`rpicam-still produced no output file: ${out}`);
        }
      }
      return image;
    } catch (err: any) {
      if (err && err.code === 'ENOENT') {
        throw new Error(
          "Could not take image with StillCamera. Are you running on a Raspberry Pi with 'raspistill' installed?"
        );
      }

      throw err;
    }
  }
}
