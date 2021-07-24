import type { Context, Scenes, Telegraf } from 'telegraf'

export default interface PhiloContext extends Context {
  // will be available under `ctx.myContextProp`
  myContextProp: string

  // declare scene type
  scene: Scenes.SceneContextScene<PhiloContext> 
}


export interface PhiloBot extends Telegraf<PhiloContext> {}