import { Injector } from '@joist/di'
import {
  Logger,
  consoleInjector,
  FileSystem,
  Camera,
  CameraStub,
  Git,
  Repository,
} from './services/index.js'

const telegramToken = `${process.env.TELEGRAM_TOKEN}`
const telegramChatId = `${process.env.TELEGRAM_CHAT_ID}`

const repoPrefix = `${process.env.GITHUB_REPO_NAME_PREFIX}`
const repoName = repoPrefix + '-2024-06-20n2'
const timelapseFile = 'timelapse.mp4'

// defineEnvironment
const injector = new Injector([], consoleInjector)
const git = injector.get(Git)
const logger = injector.get(Logger)
const fs = injector.get(FileSystem)
const repo = injector.get(Repository)
const camera = injector.get(Camera)

async function main() {
  /*const isNew = await fs.setupPath(repoName)
  if (!isNew) {
    await fs.destroy()
    logger.log('Folder cleaned up')
  }*/

  if (await git.checkPage(repoName, timelapseFile)) {
    // TODO? maybe we need a token that can delete the repo
    logger.log('Page with timelapse is up already! (Change the repo name.)')
    return
  }
  logger.log('Creating and checking out repository', repoName)
  camera.fileNamePrefix = 'frame'
  await repo.setup(repoName, false)
  await repo.addReadme()

  const count = 3 * 18 // 3-5 times framerate
  const interval = 2000
  logger.log('Starting timelapse', count, 'frames with', interval, 'ms interval')
  console.time('timelapse')
  const uploads: (() => Promise<void>)[] = []
  let running: Promise<void> | undefined = undefined
  const queue = () => {
    logger.log('Queued uploads:', uploads.length)
    const n = uploads.shift()
    if (!n) return (running = undefined)
    running = n().then(queue)
  }
  await camera.watchTimelapse(count, interval, (filename: string) => {
    logger.log('Timelapse frame created:', filename)
    // given file written events, we can start uploading (sequentially) in parallel
    uploads.push(() => repo.upload(filename))
    //if (running && running.isPending) return
    if (!running) {
      queue()
    }
  })
  while (running) {
    console.timeLog('timelapse', 'still uploading')
    await running
  }
  console.timeEnd('timelapse')

  // scan folder for jpgs
  const files = await fs.list()
  const jpegs = files.filter((f) => f.endsWith('jpg'))
  logger.log('Add', jpegs.length, 'images...')
  // add & push one by one
  for (const jpg of jpegs) {
    // should be done already
    //await repo.upload(jpg)
  }
  // add gh action config & push
  //await repo.branchPages(); could create this branch in advance - then we can enable pages faster but we get emails for pipeline cancellations
  await repo.addIndex()

  const success = await git.setActionSecret(repoName, 'TELEGRAM_TO', telegramChatId)
  logger.log('Set secret TELEGRAM_TO', success ? 'successfully' : 'failed')
  const sus = await git.setActionSecret(repoName, 'TELEGRAM_TOKEN', telegramToken)
  logger.log('Set secret TELEGRAM_TOKEN', sus ? 'successfully' : 'failed')

  await repo.createActionsFolder()
  await repo.addNotificationAction()
  await repo.addFFMpegAction(jpegs)

  logger.log('Added GH Timelapse Action! Waiting 10s ...')
  await new Promise((r) => setTimeout(r, 10000))

  let pagesEnabled = await git.enablePages(repoName)
  logger.log('Enabling GH pages for', repoName, pagesEnabled ? 'was successful' : 'failed')
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000))
    if (!pagesEnabled) {
      pagesEnabled = await git.enablePages(repoName)
    }
    if (pagesEnabled && (await git.checkPage(repoName, timelapseFile))) {
      return
    }
    logger.log('°*- waiting for the pipeline -*°', pagesEnabled ? '' : '(to be enabled)')
  }
}

main() //.catch((e) => {  console.error(e.message, e.code, Object.keys(e)); });
