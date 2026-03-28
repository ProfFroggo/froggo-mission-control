/** Resend stub — email sending not used in local mode. */
export class Resend {
  emails = {
    send: async (_params: any): Promise<any> => ({ id: 'stub', error: null }),
  }
  constructor(_apiKey?: string) {}
}
