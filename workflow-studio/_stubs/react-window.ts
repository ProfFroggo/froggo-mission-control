/**
 * Stub for react-window — virtualized list is not available in local mode.
 */
import type { ComponentType, ReactNode, Ref } from 'react'

export interface ListChildComponentProps {
  index: number
  style: React.CSSProperties
  data: any
  isScrolling?: boolean
}

export interface RowComponentProps {
  index: number
  style: React.CSSProperties
  data: any
  isScrolling?: boolean
}

export interface ListProps {
  height: number
  width: number | string
  itemCount: number
  itemSize: number | ((index: number) => number)
  children: ComponentType<ListChildComponentProps>
  itemData?: any
  overscanCount?: number
  className?: string
  style?: React.CSSProperties
  onScroll?: (props: { scrollOffset: number; scrollDirection: string }) => void
  onItemsRendered?: (props: { overscanStartIndex: number; overscanStopIndex: number; visibleStartIndex: number; visibleStopIndex: number }) => void
  ref?: Ref<any>
  [key: string]: any
}

export function List(_props: ListProps): ReactNode {
  return null
}

export function FixedSizeList(_props: ListProps): ReactNode {
  return null
}

export function VariableSizeList(_props: ListProps): ReactNode {
  return null
}

export function useListRef(..._args: any[]): any {
  return { current: null }
}

export function useDynamicRowHeight(..._args: any[]): any {
  return { setRowHeight: () => {}, getRowHeight: () => 40 }
}

export type { ListChildComponentProps as ListRowProps }
