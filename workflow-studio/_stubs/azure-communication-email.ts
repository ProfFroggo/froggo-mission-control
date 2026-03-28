/** @azure/communication-email stub — Azure email not used in local mode. */
export class EmailClient {
  constructor(_connectionString: string) {}
  async beginSend(_message: any): Promise<any> {
    return {
      pollUntilDone: async () => ({ status: 'stub' }),
    }
  }
}
