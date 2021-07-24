import type { Context, Scenes, Telegraf } from 'telegraf'
import type { Preset } from './presets';

export default interface PhiloContext extends Context {
  presetName: string
  preset: Preset

  // declare scene type
  scene: Scenes.SceneContextScene<PhiloContext> 
}


export interface PhiloBot extends Telegraf<PhiloContext> {}