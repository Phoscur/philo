import type { Context, Scenes, Telegraf } from 'telegraf'
import type { Preset } from './presets'
export type { Preset } from './presets'

export default interface PhiloContext extends Context {
  presets: { [name: string]: Preset }
  presetName: string
  preset: Preset

  // declare scene type
  scene: Scenes.SceneContextScene<PhiloContext>
}

export interface PhiloBot extends Telegraf<PhiloContext> {}
export interface PhiloScene extends Scenes.BaseScene<PhiloContext> {}
