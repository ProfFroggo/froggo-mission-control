/**
 * Stub for @azure/storage-blob — Azure Blob Storage is not used in local mode.
 * This prevents TypeScript errors from dynamic import() calls in the uploads code.
 */

export class StorageSharedKeyCredential {
  constructor(_accountName: string, _accountKey: string) {}
}

export class BlobSASPermissions {
  static parse(_permissions: string): BlobSASPermissions {
    return new BlobSASPermissions()
  }
}

export function generateBlobSASQueryParameters(_options: any, _credential: any): { toString(): string } {
  return { toString: () => '' }
}

class BlockBlobClient {
  url = ''
  async upload(_data: any, _size: number, _options?: any): Promise<void> {}
  async download(): Promise<{ readableStreamBody: null }> {
    return { readableStreamBody: null }
  }
  async delete(): Promise<void> {}
  async deleteIfExists(): Promise<void> {}
  async getProperties(): Promise<{ metadata: Record<string, string> }> {
    return { metadata: {} }
  }
  async setMetadata(_metadata: Record<string, string>): Promise<void> {}
  async commitBlockList(_blockIds: string[], _options?: any): Promise<void> {}
}

class ContainerClient {
  getBlockBlobClient(_blobName: string): BlockBlobClient {
    return new BlockBlobClient()
  }
}

export class BlobServiceClient {
  static fromConnectionString(_connectionString: string): BlobServiceClient {
    return new BlobServiceClient()
  }
  constructor(_url?: string, _credential?: any) {}
  getContainerClient(_containerName: string): ContainerClient {
    return new ContainerClient()
  }
}
