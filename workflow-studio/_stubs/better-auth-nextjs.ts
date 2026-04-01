/** better-auth/next-js stub — auth not used in local mode. */
export function toNextJsHandler(_auth: any): { GET: any; POST: any } {
  const handler = async () => new Response('', { status: 200 })
  return { GET: handler, POST: handler }
}
