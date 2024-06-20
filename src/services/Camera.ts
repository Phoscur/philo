import { inject, injectable } from '@joist/di'
import { libcamera } from 'libcamera'
import { FileSystem } from './FileSystem.js'

@injectable
export class Camera {
  #fs = inject(FileSystem)

  fileNamePrefix = 'test'

  get output() {
    return this.#fs().joinPath(`${this.fileNamePrefix}-%02d.jpg`)
  }

  async timelapse(output: string, count = 420, timelapse = 12000) {
    // if (timelapse < 1200) throw new Error('Interval must be at least 1200ms (camera is slow)')
    //console.time('still')
    const timeout = count * timelapse + 500 // need up to 400ms extra for an extra image
    //console.log('settings', timeout, timelapse)
    // takes about 2s to start
    const r = await libcamera.still({
      config: {
        roi: '0.3,0.3,0.6,0.6',
        timelapse, // also as initial delay
        timeout,
        framestart: 1,
        // height: 1200,
        output,
      },
    })
    //console.timeEnd('still')
    return r
  }

  /**
   * Run a file watcher informing about timelapse progress
   * @param count
   * @param interval
   * @param handler
   * @returns
   */
  async watchTimelapse(count = 420, interval = 12000, handler = (ev: any) => {}) {
    const timelapse = this.timelapse(this.output, count, interval)
    const ac = new AbortController()
    const { signal } = ac
    return Promise.all([
      (async () => {
        await timelapse
        ac.abort()
      })(),
      (async () => {
        let lastFile: string | null = ''
        try {
          const watcher = this.#fs().watch({ signal })
          for await (const event of watcher) {
            //console.timeLog('still', event.filename)
            if (lastFile === event.filename) continue
            // when a new file is started, the previous one is ready for upload
            if (lastFile) handler(lastFile)
            lastFile = event.filename
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            // the very last file is now ready too
            handler(lastFile)
            return
          }
          throw err
        }
      })(),
    ])
  }
}
