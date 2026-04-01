/**
 * Subscription upgrade stub — local mode, no upgrades needed.
 */
export function useSubscriptionUpgrade() {
  return {
    upgrade: () => {},
    isUpgrading: false,
    canUpgrade: false,
  }
}
