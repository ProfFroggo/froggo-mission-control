/**
 * Stub for react-joyride — product tour is not used in local mode.
 * This prevents TypeScript errors from product-tour component imports.
 */

export interface Step {
  target: string | HTMLElement
  content: React.ReactNode
  title?: string
  placement?: string
  disableBeacon?: boolean
  spotlightPadding?: number
  [key: string]: any
}

export interface TooltipRenderProps {
  step: Step
  index: number
  isLastStep: boolean
  tooltipProps: {
    ref: any
    role: string
    'aria-modal': boolean
    [key: string]: any
  }
  primaryProps: {
    onClick: (...args: any[]) => void
    [key: string]: any
  }
  backProps: {
    onClick: (...args: any[]) => void
    [key: string]: any
  }
  closeProps: {
    onClick: (...args: any[]) => void
    [key: string]: any
  }
  [key: string]: any
}

export interface CallBackProps {
  action: string
  index: number
  status: string
  type: string
  [key: string]: any
}

export const ACTIONS = {
  CLOSE: 'close',
  NEXT: 'next',
  PREV: 'prev',
  RESET: 'reset',
  START: 'start',
  STOP: 'stop',
  UPDATE: 'update',
} as const

export const EVENTS = {
  STEP_AFTER: 'step:after',
  STEP_BEFORE: 'step:before',
  TARGET_NOT_FOUND: 'target:notFound',
  TOUR_END: 'tour:end',
  TOUR_START: 'tour:start',
  TOUR_STATUS: 'tour:status',
} as const

export const STATUS = {
  FINISHED: 'finished',
  IDLE: 'idle',
  PAUSED: 'paused',
  READY: 'ready',
  RUNNING: 'running',
  SKIPPED: 'skipped',
  WAITING: 'waiting',
} as const

function Joyride(_props: any): any {
  return null
}

export default Joyride
