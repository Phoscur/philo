import {
  GlacierClient,
  CreateVaultCommand,
  UploadArchiveCommand,
  UploadArchiveCommandOutput,
  CreateVaultCommandOutput,
} from '@aws-sdk/client-glacier';
import { inject, injectable } from '@joist/di';
import type { Readable } from 'stream';
import { Logger } from './Logger.js';

export const GLACIER_ENABLED = process.env.GLACIER_ENABLED === 'true';

export interface GlacierVault {
  name: string;
  vault: CreateVaultCommandOutput;
  uploadArchive(
    data: string | Uint8Array | Buffer | Readable,
    description?: string
  ): Promise<UploadArchiveCommandOutput>;
}

/**
 * Glacier Write-Only Storage
 * Archive in AWS Glacier Vaults
 * (use AWS CLI to check inventory: https://docs.aws.amazon.com/amazonglacier/latest/dev/retrieving-vault-inventory-cli.html)
 */
@injectable
export class GlacierBackup {
  private readonly client: GlacierClient;

  #logger = inject(Logger);

  constructor() {
    const region = process.env.AWS_REGION;
    // additionally used env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
    this.client = new GlacierClient({ region });
  }

  async createVault(vaultName: string): Promise<GlacierVault> {
    const console = this.#logger();
    const { client } = this;
    const vault = await client.send(new CreateVaultCommand({ vaultName, accountId: undefined }));
    console.log('[Glacier] Vault created:', vaultName, vault.location);

    return {
      name: vaultName,
      vault,
      async uploadArchive(
        data: string | Uint8Array | Buffer | Readable,
        archiveDescription?: string
      ) {
        const upload = await client.send(
          new UploadArchiveCommand({
            vaultName,
            body: data,
            archiveDescription,
            accountId: undefined,
          })
        );
        console.log('[Glacier] Upload successful:', upload.location, archiveDescription);
        return upload;
      },
    };
  }
}
