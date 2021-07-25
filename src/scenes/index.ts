import { Scenes } from 'telegraf'
import type PhiloContext from '../PhiloContext.interface'

// storage does not have a scene (yet)
export * from './storage'

import photoScene from './photo'
import timelapseScene from './timelapse'

export default new Scenes.Stage<PhiloContext>([photoScene, timelapseScene], {
  default: 'photo'
})
