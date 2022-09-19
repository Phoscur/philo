// ## Adaption of the (MIT licensed) code from [pi-camera-connect](https://github.com/launchcodedev/pi-camera-connect/blob/master/src/lib/still-camera.ts)
import { spawnPromise } from '../spawn'

const { DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_DELAY } = process.env

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
  width?: number | string
  height?: number | string
  rotation?: Rotation
  flip?: Flip
  delay?: number
  shutter?: number
  sharpness?: number
  contrast?: number
  brightness?: number
  saturation?: number
  iso?: number
  exposureCompensation?: number
  exposureMode?: ExposureMode
  awbMode?: AwbMode
  analogGain?: number
  digitalGain?: number
  roi?: string
}

export default class StillCamera {
  private readonly options: StillOptions

  static readonly jpegSignature = Buffer.from([0xff, 0xd8, 0xff, 0xe1])

  constructor(options: StillOptions = {}) {
    const width = DEFAULT_WIDTH
    const height = DEFAULT_HEIGHT
    const delay = parseInt(DEFAULT_DELAY || '') || 500
    this.options = {
      rotation: Rotation.Rotate0,
      flip: Flip.None,
      delay,
      width,
      height,
      ...options,
    }
  }
  async takeImage() {
    try {
      const image = await spawnPromise('libcamera-still', [
        /**
         * Width
         */
        ...(this.options.width ? ['--width', this.options.width.toString()] : []),

        /**
         * Height
         */
        ...(this.options.height ? ['--height', this.options.height.toString()] : []),

        /**
         * Rotation
         */
        ...(this.options.rotation ? ['--rotation', this.options.rotation.toString()] : []),

        /**
         * Horizontal flip
         */
        ...(this.options.flip &&
        (this.options.flip === Flip.Horizontal || this.options.flip === Flip.Both)
          ? ['--hflip']
          : []),

        /**
         * Vertical flip
         */
        ...(this.options.flip &&
        (this.options.flip === Flip.Vertical || this.options.flip === Flip.Both)
          ? ['--vflip']
          : []),

        /**
         * Shutter Speed
         */
        ...(this.options.shutter ? ['--shutter', this.options.shutter.toString()] : []),

        /**
         * Sharpness (-100 to 100; default 0)
         */
        ...(this.options.sharpness ? ['--sharpness', this.options.sharpness.toString()] : []),

        /**
         * Contrast (-100 to 100; default 0)
         */
        ...(this.options.contrast ? ['--contrast', this.options.contrast.toString()] : []),

        /**
         * Brightness (0 to 100; default 50)
         */
        ...(this.options.brightness || this.options.brightness === 0
          ? ['--brightness', this.options.brightness.toString()]
          : []),

        /**
         * Saturation (-100 to 100; default 0)
         */
        ...(this.options.saturation ? ['--saturation', this.options.saturation.toString()] : []),

        /**
         * ISO
         */
        ...(this.options.iso ? ['--ISO', this.options.iso.toString()] : []),

        /**
         * EV Compensation
         */
        ...(this.options.exposureCompensation
          ? ['--ev', this.options.exposureCompensation.toString()]
          : []),

        /**
         * Exposure Mode
         */
        ...(this.options.exposureMode ? ['--exposure', this.options.exposureMode.toString()] : []),

        /**
         * Auto White Balance Mode
         */
        ...(this.options.awbMode ? ['--awb', this.options.awbMode.toString()] : []),

        /**
         * Analog Gain
         */
        ...(this.options.analogGain ? ['--analoggain', this.options.analogGain.toString()] : []),

        /**
         * Digital Gain
         */
        ...(this.options.digitalGain ? ['--digitalgain', this.options.digitalGain.toString()] : []),

        /**
         * Capture delay (ms)
         */
        '--timeout',
        this.options.delay!.toString(),

        /**
         * Region of interest
         */
        ...(this.options.roi ? ['--roi', this.options.roi.toString()] : []),

        /**
         * Image functions
         * /
        ...(this.options.imxfx
          ? ['--imxfx', this.options.imxfx.toString()]
          : []),*/

        /**
         * Do not display preview overlay on screen
         */
        '--nopreview',

        /**
         * Output to stdout
         */
        '--output',
        '-',
      ])
      console.log('Image taken!', image?.length)
      return image
    } catch (err: any) {
      if (err && err.code === 'ENOENT') {
        throw new Error(
          "Could not take image with StillCamera. Are you running on a Raspberry Pi with 'raspistill' installed?"
        )
      }

      throw err
    }
  }
}
