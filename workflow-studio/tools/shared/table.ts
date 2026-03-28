/**
 * Shared table utilities stub — stripped during Sim Studio fork.
 */

export function transformTable(
  table: Array<{ key: string; value: string }> | null | undefined
): Record<string, string> {
  if (!table || !Array.isArray(table)) return {}
  const result: Record<string, string> = {}
  for (const row of table) {
    if (row.key) {
      result[row.key] = row.value ?? ''
    }
  }
  return result
}
