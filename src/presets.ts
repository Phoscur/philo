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
    lapse: (options: { duration: number; minutely: number }) => Preset
  }

export function printPreset(p: Preset) {
  const roi = p.roi ? `Region of interest: ${p.roi}` : ''
  const widthAndHeight =
    p.width || p.height ? `Width: ${p.width || '*'}, height: ${p.height || '*'}` : ''
  const duration = p.duration ? `Duration: ~${p.duration}min(s) -` : '' // TODO? use dayjs.humanize, but it's currently not accurate anyways!
  const minutely = p.minutely ? `images per minute: ~${p.minutely}` : ''
  const interval = p.interval ? `- Milliseconds between images: ${p.interval}` : ''
  const count = p.count ? `- Total image count: ${p.count}` : ''
  return `${roi}\n${widthAndHeight}\n${duration} ${minutely}\n${interval}\n${count}`
}

const presets: { [name: string]: Preset } = JSON.parse(process.env.PRESETS || '{}')
const base: Preset = JSON.parse(process.env.DEFAULT_PRESET || '{}')
export const sunsetTimings: number[] = JSON.parse(process.env.SUNSET_TIMINGS || '[0]')

function enhancePreset(preset: Preset) {
  preset.toString = function () {
    return printPreset(this)
  }
  preset.lapse = function ({ duration, minutely }: { duration: number; minutely: number }) {
    return Object.assign({}, preset, {
      duration,
      minutely,
      interval: Math.floor(60000 / minutely),
      count: Math.round(minutely * duration),
    })
  }
}

for (const presetName in presets) {
  const preset = presets[presetName]
  console.log('Loading preset:', presetName, preset)
  enhancePreset(preset)
}
enhancePreset(base)

export default {
  base: base as Preset,
  ...presets,
}
