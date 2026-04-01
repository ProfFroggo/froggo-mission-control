import { createLogger } from '@sim/logger'
import type { StreamingExecution } from '@/executor/types'
import { getProviderDefaultModel, getProviderModels } from '@/providers/models'
import type { ProviderConfig, ProviderRequest, ProviderResponse } from '@/providers/types'
import { executeResponsesProviderRequest } from '@/providers/openai/core'

const logger = createLogger('MiniMaxProvider')

export const minimaxProvider: ProviderConfig = {
  id: 'minimax',
  name: 'MiniMax',
  description: "MiniMax's AI models",
  version: '1.0.0',
  models: getProviderModels('minimax'),
  defaultModel: getProviderDefaultModel('minimax'),

  executeRequest: async (
    request: ProviderRequest
  ): Promise<ProviderResponse | StreamingExecution> => {
    if (!request.apiKey) {
      throw new Error('API key is required for MiniMax')
    }

    return executeResponsesProviderRequest(request, {
      providerId: 'minimax',
      providerLabel: 'MiniMax',
      modelName: request.model,
      endpoint: 'https://api.minimaxi.chat/v1/text/chatcompletion_v2',
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        'Content-Type': 'application/json',
      },
      logger,
    })
  },
}
