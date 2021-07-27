import type { Context, Scenes, Telegraf } from 'telegraf'
import type { Storage } from './lib/storage'
import type { Preset } from './presets'

export type { Storage } from './lib/storage'
export type { Preset } from './presets'

export default interface PhiloContext extends Context {
  sunsetTimings: number[]
  presets: { [name: string]: Preset }
  presetName: string
  preset: Preset
  storage: Storage

  // declare scene type
  scene: Scenes.SceneContextScene<PhiloContext>
}

export interface PhiloBot extends Telegraf<PhiloContext> {}
export interface PhiloScene extends Scenes.BaseScene<PhiloContext> {}
