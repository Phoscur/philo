import type { Context, Scenes, Telegraf } from 'telegraf'
import type { Message } from 'telegraf/typings/core/types/typegram'
import type { Preset } from './presets'
export type { Preset } from './presets'

export interface Task {
  message: Message.MediaMessage
  abort(): Promise<void>
}
export default interface PhiloContext extends Context {
  sunsetTimings: number[]
  presets: { [name: string]: Preset }
  presetName: string
  preset: Preset

  // declare scene type
  scene: Scenes.SceneContextScene<PhiloContext>
}

export interface PhiloBot extends Telegraf<PhiloContext> {}
export interface PhiloScene extends Scenes.BaseScene<PhiloContext> {}
