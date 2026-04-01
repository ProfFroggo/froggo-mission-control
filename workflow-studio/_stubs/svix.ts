/** Svix stub — webhook verification not used in local mode. */
export class Webhook {
  constructor(_secret: string) {}
  verify(_payload: string | Buffer, _headers: Record<string, string>): any {
    return {}
  }
}
