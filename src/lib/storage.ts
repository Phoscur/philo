
import { writeFile, readFile, readdir, createReadStream, createWriteStream, unlink, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

/**
 * Filesystem access to cache photos for timelapses
 */
export default class FileStorage {

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
          return reject(err);
        }
        return resolve(files);
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
