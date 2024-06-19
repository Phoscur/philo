import { inject, injectable } from '@joist/di'
import libcamera from 'node-libcamera'
import { FileSystem } from './FileSystem.js'

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

still()

@injectable
export class Camera {
  #fs = inject(FileSystem)

  get output() {
    const { join } = this.#fs()
    return join('test-%d.jpg')
  }

  async timelapse(output: string) {
    return libcamera.still({
      roi: {
        x: 0.3,
        y: 0.3,
        w: 0.6,
        h: 0.6,
      },
      timelapse: 1000,
      timeout: 16000,
      framestart: 1,
      // height: 1200,
      output,
    })
  }

  async watchTimelapse(handler = async (ev: any) => {}) {
    const timelapse = this.timelapse(this.output)
    const ac = new AbortController()
    const { signal } = ac
    return Promise.all([
      async () => {
        await timelapse
        ac.abort()
      },
      async () => {
        try {
          const watcher = this.#fs().watch({ signal })
          for await (const event of watcher) {
            await handler(event)
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') return
          throw err
        }
      },
    ])
  }
}
