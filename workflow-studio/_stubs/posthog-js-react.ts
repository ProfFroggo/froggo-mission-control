/** posthog-js/react stub — no analytics in local mode. */
import React from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement
}

export function usePostHog() {
  return {
    capture: () => {},
    identify: () => {},
    reset: () => {},
    isFeatureEnabled: () => false,
    getFeatureFlag: () => undefined,
    onFeatureFlags: () => {},
  }
}

export function useFeatureFlagEnabled(_flag: string): boolean {
  return false
}

export function useFeatureFlagVariantKey(_flag: string): string | undefined {
  return undefined
}
