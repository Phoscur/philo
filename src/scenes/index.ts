import { Scenes } from 'telegraf'
import type PhiloContext from '../PhiloContext.interface'
import type { Storage } from '../lib/storage'

import createPhotoScene from './photo'
import timelapseScene from './timelapse'
// storage & temperature commands may be added to any scene or bot
// import setupTemperatureCommands from './temperature'
// import setupStorageCommands from './storage'

export default function buildStage(storage: Storage) {
  // storage and temperature do not have a scenes (yet)
  return new Scenes.Stage<PhiloContext>([createPhotoScene(storage), timelapseScene], {
    default: 'photo',
  })
}
