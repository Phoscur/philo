import type { StillOptions } from './lib/raspistill'
import type { StitchOptions } from './lib/ffmpeg'

export interface PhiloOptions {
  wait?: number
  duration?: number
  minutely?: number
  interval?: number
  count?: number
  random?: boolean
}

export type Preset = PhiloOptions &
  StillOptions &
  StitchOptions & {
    toString(): string
  }

export function printPreset(p: Preset) {
  const roi = p.roi ? `Region of interest: ${p.roi}` : ''
  const widthAndHeight =
    p.width || p.height
      ? `Width: ${p.width || '*'}, height: ${p.height || '*'}`
      : ''
  const duration = p.duration ? `Duration: ${p.duration}min(s)` : '' // TODO use dayjs.humanize
  const minutely = p.minutely ? `images per minute: ${p.minutely}` : ''
  const interval = p.interval
    ? `Milliseconds between images: ${p.interval}`
    : ''
  const count = p.count ? `Total image count: ${p.count}` : ''
  return `${roi}\n${widthAndHeight}\n${duration} ${minutely}\n${interval} ${count}`
}

const base: Preset = JSON.parse(process.env.DEFAULT_PRESET || '{}')
const presets: { [name: string]: Preset } = JSON.parse(
  process.env.PRESETS || '{}'
)
export const sunsetTimings: number[] = JSON.parse(
  process.env.SUNSET_TIMINGS || '[0]'
)

function enhancePreset(preset: Preset) {
  preset.toString = printPreset.bind(null, preset)
  Object.defineProperty(preset, 'interval', {
    get() {
      return Math.floor(60000 / this.minutely) || undefined
    },
  })
  Object.defineProperty(preset, 'count', {
    get() {
      return Math.round(this.minutely * this.duration) || undefined
    },
  })
}

enhancePreset(base)
for (const presetName in presets) {
  const preset = presets[presetName]
  console.log('Loading preset:', presetName, preset)
  enhancePreset(preset)
}

export default {
  base: base as Preset,
  ...presets,
}
