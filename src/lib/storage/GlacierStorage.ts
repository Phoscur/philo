import { FileStorage } from './FileStorage'
import { GlacierArchiver, GlacierVault } from './GlacierArchiver'

/**
 * Archiving in AWS Glacier Vaults
 * with env GLACIER_ENABLED=true, else just a normal FileStorage
 */
export class GlacierStorage extends FileStorage {
  protected constructor(path: string, public readonly vault?: GlacierVault) {
    super(path)
  }

  static async create(path: string = 'storage'): Promise<GlacierStorage | FileStorage> {
    console.log(`[Storage: ${path}] Glacier enabled: ${process.env.GLACIER_ENABLED}`)
    if (process.env.GLACIER_ENABLED === 'true') {
      try {
        const vault = await GlacierArchiver.instance.createVault(path)
        return new GlacierStorage(path, vault).setup()
      } catch (error) {
        console.error(`[Storage: ${path}] Glacier Vault creation failed`, error)
      }
    }
    return FileStorage.create(path)
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
