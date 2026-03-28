/**
 * Session response stub — stripped during Sim Studio fork.
 */

export function extractSessionDataFromAuthClientResult(res: any): any {
  if (!res) return null
  // Attempt to extract from common auth-client response shapes
  if (res.data) return res.data
  if (res.session) return res
  return res
}
