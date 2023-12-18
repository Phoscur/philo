import { GlacierArchiver, GlacierVault } from './GlacierArchiver'
import { QueuedBackupStorage } from './QueuedBackupStorage'

/**
 * Archiving in AWS Glacier Vaults
 * with env AWS_GLACIER_ENABLED=true, else just a normal FileStorage
 */
export class GlacierStorage extends QueuedBackupStorage {
  get name(): string {
    return this.vault?.name || ''
  }

  protected constructor(path: string, private vault?: GlacierVault) {
    super(path)
  }

  static async create(path: string = 'storage'): Promise<GlacierStorage> {
    return new GlacierStorage(path).setup()
  }

  protected async setup() {
    await super.setup()
    console.log(`[Storage: ${this.path}] Glacier enabled: ${process.env.AWS_GLACIER_ENABLED}`)
    if ('true' !== process.env.AWS_GLACIER_ENABLED) {
      return this
    }
    try {
      this.vault = await GlacierArchiver.instance.createVault(this.path)
      console.log(`[Storage: ${this.path}] Folder created`)
    } catch (error) {
      console.error(`[Storage: ${this.path}] Glacier Vault creation failed`, error)
    }
    return this
  }

  async add(fileName: string) {
    if ('true' !== process.env.AWS_GLACIER_ENABLED) {
      return
    }
    const source = this.readStream(fileName)
    try {
      await this.vault?.uploadArchive(source, fileName)
    } catch (error) {
      console.error(`[Storage: ${this.path}] Glacier Archive creation failed`, error)
    }
  }
}
