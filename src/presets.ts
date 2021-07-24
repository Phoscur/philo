import type { StitchOptions } from "./lib/ffmpeg"
import type { StillOptions } from "./lib/raspistill"

export interface PhiloOptions {
  duration?: number
  minutely?: number
  interval?: number
  count?: number
}

export type Preset = PhiloOptions & StillOptions & StitchOptions & {
  toString(): string
}

export function printPreset(p: Preset) {
  const roi = p.roi ? `Region of interest: ${p.roi}` : ''
  const widthAndHeight = (p.width || p.height) ? `Width: ${p.width || '*'}, height: ${p.height || '*'}` : ''
  const duration = p.duration ? `Duration: ${p.duration}h` : ''
  const minutely = p.minutely ? `images per minute: ${p.minutely}` : ''
  const interval = p.interval ? `Milliseconds between images: ${p.interval}` : ''
  const count = p.count ? `Total image count: ${p.count}` : ''
  return `${roi}\n${widthAndHeight}\n${duration} ${minutely}\n${interval} ${count}`
}

const base = JSON.parse(process.env.DEFAULT_PRESET || '{}')

base.toString = printPreset.bind(null, base)
export default {
  base: base as Preset,
}