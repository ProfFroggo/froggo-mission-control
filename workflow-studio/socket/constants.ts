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
  BATCH_ADD_BLOCKS: 'batch_add_blocks',
  BATCH_REMOVE_BLOCKS: 'batch_remove_blocks',
  BATCH_ADD_EDGES: 'batch_add_edges',
  BATCH_REMOVE_EDGES: 'batch_remove_edges',
  BATCH_MOVE_BLOCKS: 'batch_move_blocks',
  UPDATE_EDGE: 'update_edge',
  PASTE_BLOCKS: 'paste_blocks',
  UPDATE_PARENT: 'update_parent',
  BATCH_UPDATE_PARENT: 'batch_update_parent',
  BATCH_TOGGLE_ENABLED: 'batch_toggle_enabled',
  BATCH_TOGGLE_HANDLES: 'batch_toggle_handles',
  BATCH_TOGGLE_LOCKED: 'batch_toggle_locked',
  APPLY_DIFF: 'apply_diff',
  ACCEPT_DIFF: 'accept_diff',
  REJECT_DIFF: 'reject_diff',
} as const

export type UndoRedoOperation = {
  type: (typeof UNDO_REDO_OPERATIONS)[keyof typeof UNDO_REDO_OPERATIONS]
  data: any
  timestamp: number
}

export const OPERATION_TARGETS = {
  BLOCK: 'block',
  BLOCKS: 'blocks',
  EDGE: 'edge',
  EDGES: 'edges',
  SUBBLOCK: 'subblock',
  SUBFLOW: 'subflow',
  VARIABLE: 'variable',
  WORKFLOW: 'workflow',
} as const

export const BLOCK_OPERATIONS = {
  ADD: 'add',
  REMOVE: 'remove',
  UPDATE: 'update',
  MOVE: 'move',
  UPDATE_POSITION: 'update_position',
  UPDATE_PARENT: 'update_parent',
  UPDATE_NAME: 'update_name',
  UPDATE_ADVANCED_MODE: 'update_advanced_mode',
  UPDATE_CANONICAL_MODE: 'update_canonical_mode',
} as const

export const BLOCKS_OPERATIONS = {
  BATCH_ADD: 'batch_add',
  BATCH_REMOVE: 'batch_remove',
  BATCH_MOVE: 'batch_move',
  BATCH_UPDATE_PARENT: 'batch_update_parent',
  BATCH_TOGGLE_ENABLED: 'batch_toggle_enabled',
  BATCH_TOGGLE_HANDLES: 'batch_toggle_handles',
  BATCH_TOGGLE_LOCKED: 'batch_toggle_locked',
  PASTE: 'paste',
  BATCH_ADD_BLOCKS: 'batch_add_blocks',
  BATCH_REMOVE_BLOCKS: 'batch_remove_blocks',
  BATCH_UPDATE_POSITIONS: 'batch_update_positions',
} as const

export const EDGE_OPERATIONS = {
  ADD: 'add',
  REMOVE: 'remove',
  UPDATE: 'update',
} as const

export const EDGES_OPERATIONS = {
  BATCH_ADD: 'batch_add',
  BATCH_REMOVE: 'batch_remove',
  BATCH_ADD_EDGES: 'batch_add_edges',
  BATCH_REMOVE_EDGES: 'batch_remove_edges',
} as const

export const SUBBLOCK_OPERATIONS = {
  UPDATE: 'update',
} as const

export const SUBFLOW_OPERATIONS = {
  UPDATE: 'update',
} as const

export const VARIABLE_OPERATIONS = {
  ADD: 'add',
  REMOVE: 'remove',
  UPDATE: 'update',
} as const

export const WORKFLOW_OPERATIONS = {
  UPDATE: 'update',
  APPLY_DIFF: 'apply_diff',
  ACCEPT_DIFF: 'accept_diff',
  REJECT_DIFF: 'reject_diff',
} as const
