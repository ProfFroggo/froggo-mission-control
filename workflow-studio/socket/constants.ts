/**
 * Socket constants stub — collaborative editing stripped for local mode.
 */

export const UNDO_REDO_OPERATIONS = {
  ADD_NODE: 'add_node',
  REMOVE_NODE: 'remove_node',
  ADD_EDGE: 'add_edge',
  REMOVE_EDGE: 'remove_edge',
  UPDATE_NODE: 'update_node',
  MOVE_NODE: 'move_node',
  BATCH: 'batch',
} as const

export type UndoRedoOperation = {
  type: (typeof UNDO_REDO_OPERATIONS)[keyof typeof UNDO_REDO_OPERATIONS]
  data: any
  timestamp: number
}
