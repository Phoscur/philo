import { join } from 'path'
import { PassThrough, Readable } from 'stream'
import { Storage } from './Storage.interface'

export class ProxyStorage implements Storage {
  protected constructor(public path: string, protected data?: Storage) {}

  static async create(path: string, data: Storage) {
    return new ProxyStorage(path, data)
  }

  async getData(): Promise<Storage> {
    if (!this.data) throw new Error('Proxy forwarding failure: data is not set')
    return this.data
  }

  get cwd() {
    return join(process.cwd(), this.path)
  }
  async status() {
    const proxy = await this.getData()
    return proxy.status()
  }
  async list() {
    const proxy = await this.getData()
    return proxy.list()
  }
  async exists(name?: string) {
    const proxy = await this.getData()
    return proxy.exists(name)
  }
  async read(name: string) {
    const proxy = await this.getData()
    return proxy.read(name)
  }
  readStream(name: string): Readable {
    const stream = new PassThrough()
    this.getData().then((proxy) => proxy.readStream(name).pipe(stream))
    return stream
  }
  async add(name: string) {
    const proxy = await this.getData()
    return proxy.add(name)
  }
  async save(name: string, source: Buffer) {
    const proxy = await this.getData()
    return proxy.save(name, source)
  }
  async delete(name: string) {
    const proxy = await this.getData()
    return proxy.delete(name)
  }
}
