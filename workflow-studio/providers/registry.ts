import { createLogger } from '@sim/logger'
import { anthropicProvider } from '@/providers/anthropic'
import { googleProvider } from '@/providers/google'
import { minimaxProvider } from '@/providers/minimax'
import { openaiProvider } from '@/providers/openai'
import type { ProviderConfig, ProviderId } from '@/providers/types'

const logger = createLogger('ProviderRegistry')

const providerRegistry: Record<ProviderId, ProviderConfig> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  google: googleProvider,
  minimax: minimaxProvider,
}

export async function getProviderExecutor(
  providerId: ProviderId
): Promise<ProviderConfig | undefined> {
  const provider = providerRegistry[providerId]
  if (!provider) {
    logger.error(`Provider not found: ${providerId}`)
    return undefined
  }
  return provider
}

export async function initializeProviders(): Promise<void> {
  for (const [id, provider] of Object.entries(providerRegistry)) {
    if (provider.initialize) {
      try {
        await provider.initialize()
        logger.info(`Initialized provider: ${id}`)
      } catch (error) {
        logger.error(`Failed to initialize ${id} provider`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  }
}
