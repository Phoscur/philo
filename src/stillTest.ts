/* import libcamera from 'node-libcamera'

export async function still() {
  console.time('still')
  const r = await libcamera.still({
    roi: {
      x: 0.3,
      y: 0.3,
      w: 0.6,
      h: 0.6,
    },
    timelapse: 12000,
    framestart: 1,
    // height: 1200,
    output: 'test-%d.jpg',
  })
  console.timeEnd('still')
  return r
}

still() */

import { Injector } from '@joist/di'
import { Logger, consoleInjector } from './services/Logger.js'
import { FileSystem, Camera } from './services/index.js'

const repoName = 'still-test-2024-06-01'

// defineEnvironment
const injector = new Injector([], consoleInjector)
const logger = injector.get(Logger)
const fs = injector.get(FileSystem)
const camera = injector.get(Camera)

async function main() {
  logger.log('Starting timelapse')
  await fs.setupPath(repoName)
  logger.log('Path set up', repoName)
  await camera.watchTimelapse(async (ev) => {
    logger.log('Timelapse event', ev)
  })
  logger.log('Timelapse finished')
}
main() //.catch((e) => {  console.error(e.message, e.code, Object.keys(e)); });
