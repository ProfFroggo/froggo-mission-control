/** PostHog stub — no analytics in local mode. */
const posthog: Record<string, any> = {
  __loaded: false,
  init: () => {},
  capture: () => {},
  identify: () => {},
  reset: () => {},
  isFeatureEnabled: () => false,
  getFeatureFlag: () => undefined,
  onFeatureFlags: () => {},
  people: { set: () => {} },
}
export default posthog
export type PostHog = typeof posthog
