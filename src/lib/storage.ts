import {
  writeFile,
  readFile,
  readdir,
  createReadStream,
  createWriteStream,
  unlink,
  existsSync,
  mkdirSync,
} from 'fs'
import { join } from 'path'

import type {
  InputMediaAnimation,
  InputMediaPhoto,
} from 'telegraf/typings/core/types/typegram'

const { LOADING_SPINNER_URL, RANDOM_IMAGE_URL } = process.env

/**
 * Filesystem access to cache photos for timelapses
 */
export default class FileStorage {
  get spinner(): InputMediaAnimation {
    return {
      media: {
        source: this.readStream('cool-loading-animated-gif-3.gif'),
        // url: LOADING_SPINNER_URL || 'https://smashinghub.com/wp-content/uploads/2014/08/cool-loading-animated-gif-3.gif',
      },
      type: 'animation',
    }
  }

  get random(): InputMediaPhoto {
    return {
      media: {
        url: RANDOM_IMAGE_URL || 'https://picsum.photos/600/400/?random',
      },
      type: 'photo',
    }
  }

  constructor(public readonly path: string = 'storage') {
    if (!existsSync(path)) {
      mkdirSync(path)
      console.log('Created storage folder:', path)
    }
  }

  list() {
    return new Promise<string[]>((resolve, reject) => {
      readdir(`storage`, (err, files) => {
        if (err) {
          return reject(err)
        }
        return resolve(files)
      })
    })
  }

  read(name: string) {
    return new Promise<Buffer>((resolve, reject) => {
      const file = join(this.path, name)
      readFile(file, (err, data) => {
        if (err) {
          return reject(err)
        }
        resolve(data)
      })
    })
  }

  readStream(name: string) {
    const file = join(this.path, name)
    return createReadStream(file)
  }

  writeStream(name: string) {
    const file = join(this.path, name)
    return createWriteStream(file)
  }

  save(name: string, source: Buffer) {
    return new Promise<string>((resolve, reject) => {
      const file = join(this.path, name)
      writeFile(file, source, (err) => {
        if (err) {
          return reject(err)
        }
        resolve(file)
      })
    })
  }

  delete(name: string) {
    return new Promise<void>((resolve, reject) => {
      const file = join(this.path, name)
      unlink(file, (err) => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  }
}

// TODO actually make this a general interface (FileStorage implements Storage)
export interface Storage extends FileStorage {}
