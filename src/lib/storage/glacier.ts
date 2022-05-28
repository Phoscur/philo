import { GlacierClient, CreateVaultCommand, UploadArchiveCommand } from '@aws-sdk/client-glacier'

/**
 * Glacier Write-Only Storage
 * Archive files in AWS Glacier
 * (use AWS CLI to check inventory: https://docs.aws.amazon.com/amazonglacier/latest/dev/retrieving-vault-inventory-cli.html)
 */
export class GlacierArchiver {
  private readonly client: GlacierClient
  constructor() {
    const region = process.env.AWS_REGION
    // additionally used env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
    this.client = new GlacierClient({ region })
  }

  async createVault(vaultName: string) {
    const { client } = this
    const vault = await client.send(new CreateVaultCommand({ vaultName, accountId: undefined }))
    console.log('[Glacier] Vault created:', vaultName, vault.location)

    return {
      name: vaultName,
      vault,
      async uploadArchive(data: Buffer, archiveDescription?: string) {
        const upload = await client.send(
          new UploadArchiveCommand({
            vaultName,
            body: data,
            archiveDescription,
            accountId: undefined,
          })
        )
        console.log('[Glacier] Upload successful:', upload.location, archiveDescription)
        return upload
      },
    }
  }
}
