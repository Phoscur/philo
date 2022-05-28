import { Scenes } from 'telegraf'
import type PhiloContext from '../PhiloContext.interface'
import type { StorageManager } from '../lib/storage'
import type { StreamContainer } from '../lib/tasks'

import createPhotoScene from './photo'
import timelapseScene from './tscene'
// storage & temperature commands may be added to any scene or bot
// import setupTemperatureCommands from './temperature'
// import setupStorageCommands from './storage'

export default function buildStage(storage: StorageManager, streams: StreamContainer) {
  // storage and temperature do not have a scenes (yet)
  return new Scenes.Stage<PhiloContext>([createPhotoScene(storage, streams), timelapseScene], {
    default: 'photo',
  })
}
