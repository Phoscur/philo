import { FileStorage } from './FileStorage'
import { GlacierArchiver, GlacierVault } from './GlacierArchiver'

/**
 * Archiving in AWS Glacier Vaults
 * with env AWS_GLACIER_ENABLED=true, else just a normal FileStorage
 */
export class GlacierStorage extends FileStorage {
  get name(): string {
    return this.vault?.name || ''
  }

  protected constructor(path: string, private vault?: GlacierVault) {
    super(path)
  }

  static async create(path: string = 'storage'): Promise<GlacierStorage | FileStorage> {
    console.log(`[Storage: ${path}] Glacier enabled: ${process.env.AWS_GLACIER_ENABLED}`)
    return FileStorage.create(path)
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

  /**
   * Save & Add, meanwhile Upload archive
   * @param fileName also used as archive description
   * @param source data
   */
  async save(fileName: string, source: Buffer) {
    await Promise.all([
      super.save(fileName, source).then(() => this.add(fileName)),
      this.vault
        ?.uploadArchive(source, fileName)
        .catch((error) =>
          console.error(`[Storage: ${this.path}] Glacier Archive creation failed`, error)
        ),
    ])
  }

  // TODO? backup media? async add(fileName: string) {}
}
