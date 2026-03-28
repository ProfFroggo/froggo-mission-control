/** ImapFlow stub — IMAP email not used in local mode. */
export class ImapFlow {
  constructor(_config: any) {}
  async connect(): Promise<void> {}
  async logout(): Promise<void> {}
  async getMailboxLock(_mailbox: string): Promise<{ release: () => void }> {
    return { release: () => {} }
  }
  async fetchOne(_seq: string, _query: any): Promise<any> {
    return {}
  }
  async *fetch(_range: string, _query: any): AsyncGenerator<any> {}
  async search(_query: any): Promise<number[]> {
    return []
  }
  async download(_uid: string, _part?: string): Promise<{ content: null }> {
    return { content: null }
  }
}
