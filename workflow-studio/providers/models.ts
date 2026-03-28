/**
 * Comprehensive provider definitions - Single source of truth
 * This file contains all provider and model information including:
 * - Model lists
 * - Pricing information
 * - Model capabilities (temperature support, etc.)
 * - Provider configurations
 */

import type React from 'react'
import {
  AnthropicIcon,
  GeminiIcon,
  OllamaIcon,
  OpenAIIcon,
} from '@/components/icons'
import type { ModelPricing } from '@/providers/types'

export interface ModelCapabilities {
  temperature?: {
    min: number
    max: number
  }
  toolUsageControl?: boolean
  computerUse?: boolean
  nativeStructuredOutputs?: boolean
  /** Maximum supported output tokens for this model */
  maxOutputTokens?: number
  reasoningEffort?: {
    values: string[]
  }
  verbosity?: {
    values: string[]
  }
  thinking?: {
    levels: string[]
    default?: string
  }
  deepResearch?: boolean
  /** Whether this model supports conversation memory. Defaults to true if omitted. */
  memory?: boolean
}

export interface ModelDefinition {
  id: string
  pricing: ModelPricing
  capabilities: ModelCapabilities
  contextWindow?: number
}

export interface ProviderDefinition {
  id: string
  name: string
  description: string
  models: ModelDefinition[]
  defaultModel: string
  modelPatterns?: RegExp[]
  icon?: React.ComponentType<{ className?: string }>
  capabilities?: ModelCapabilities
  contextInformationAvailable?: boolean
}

export const PROVIDER_DEFINITIONS: Record<string, ProviderDefinition> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: "OpenAI's models",
    defaultModel: 'gpt-4o',
    modelPatterns: [/^gpt/, /^o\d/, /^text-embedding/],
    icon: OpenAIIcon,
    capabilities: {
      toolUsageControl: true,
    },
    models: [
      {
        id: 'gpt-4o',
        pricing: {
          input: 2.5,
          cachedInput: 1.25,
          output: 10.0,
          updatedAt: '2025-06-17',
        },
        capabilities: {
          temperature: { min: 0, max: 2 },
        },
        contextWindow: 128000,
      },
      {
        id: 'gpt-5.4',
        pricing: {
          input: 2.5,
          cachedInput: 0.25,
          output: 15.0,
          updatedAt: '2026-03-05',
        },
        capabilities: {
          reasoningEffort: {
            values: ['none', 'low', 'medium', 'high', 'xhigh'],
          },
          verbosity: {
            values: ['low', 'medium', 'high'],
          },
          maxOutputTokens: 128000,
        },
        contextWindow: 1050000,
      },
      {
        id: 'gpt-5.4-pro',
        pricing: {
          input: 30.0,
          output: 180.0,
          updatedAt: '2026-03-05',
        },
        capabilities: {
          reasoningEffort: {
            values: ['medium', 'high', 'xhigh'],
          },
          maxOutputTokens: 128000,
        },
        contextWindow: 1050000,
      },
      {
        id: 'gpt-5.2',
        pricing: {
          input: 1.75,
          cachedInput: 0.175,
          output: 14.0,
          updatedAt: '2025-12-11',
        },
        capabilities: {
          reasoningEffort: {
            values: ['none', 'low', 'medium', 'high', 'xhigh'],
          },
          verbosity: {
            values: ['low', 'medium', 'high'],
          },
        },
        contextWindow: 400000,
      },
      {
        id: 'gpt-5.1',
        pricing: {
          input: 1.25,
          cachedInput: 0.125,
          output: 10.0,
          updatedAt: '2025-11-14',
        },
        capabilities: {
          reasoningEffort: {
            values: ['none', 'low', 'medium', 'high'],
          },
          verbosity: {
            values: ['low', 'medium', 'high'],
          },
        },
        contextWindow: 400000,
      },
      {
        id: 'gpt-5',
        pricing: {
          input: 1.25,
          cachedInput: 0.125,
          output: 10.0,
          updatedAt: '2025-08-07',
        },
        capabilities: {
          reasoningEffort: {
            values: ['minimal', 'low', 'medium', 'high'],
          },
          verbosity: {
            values: ['low', 'medium', 'high'],
          },
        },
        contextWindow: 400000,
      },
      {
        id: 'gpt-5-mini',
        pricing: {
          input: 0.25,
          cachedInput: 0.025,
          output: 2.0,
          updatedAt: '2025-08-07',
        },
        capabilities: {
          reasoningEffort: {
            values: ['minimal', 'low', 'medium', 'high'],
          },
          verbosity: {
            values: ['low', 'medium', 'high'],
          },
        },
        contextWindow: 400000,
      },
      {
        id: 'gpt-5-nano',
        pricing: {
          input: 0.05,
          cachedInput: 0.005,
          output: 0.4,
          updatedAt: '2025-08-07',
        },
        capabilities: {
          reasoningEffort: {
            values: ['minimal', 'low', 'medium', 'high'],
          },
          verbosity: {
            values: ['low', 'medium', 'high'],
          },
        },
        contextWindow: 400000,
      },
      {
        id: 'gpt-5-chat-latest',
        pricing: {
          input: 1.25,
          cachedInput: 0.125,
          output: 10.0,
          updatedAt: '2025-08-07',
        },
        capabilities: {
          temperature: { min: 0, max: 2 },
        },
        contextWindow: 128000,
      },
      {
        id: 'o1',
        pricing: {
          input: 15.0,
          cachedInput: 7.5,
          output: 60,
          updatedAt: '2025-06-17',
        },
        capabilities: {
          reasoningEffort: {
            values: ['low', 'medium', 'high'],
          },
        },
        contextWindow: 200000,
      },
      {
        id: 'o3',
        pricing: {
          input: 2,
          cachedInput: 0.5,
          output: 8,
          updatedAt: '2025-06-17',
        },
        capabilities: {
          reasoningEffort: {
            values: ['low', 'medium', 'high'],
          },
        },
        contextWindow: 200000,
      },
      {
        id: 'o4-mini',
        pricing: {
          input: 1.1,
          cachedInput: 0.275,
          output: 4.4,
          updatedAt: '2025-06-17',
        },
        capabilities: {
          reasoningEffort: {
            values: ['low', 'medium', 'high'],
          },
        },
        contextWindow: 200000,
      },
      {
        id: 'gpt-4.1',
        pricing: {
          input: 2.0,
          cachedInput: 0.5,
          output: 8.0,
          updatedAt: '2025-06-17',
        },
        capabilities: {
          temperature: { min: 0, max: 2 },
        },
        contextWindow: 1000000,
      },
      {
        id: 'gpt-4.1-nano',
        pricing: {
          input: 0.1,
          cachedInput: 0.025,
          output: 0.4,
          updatedAt: '2025-06-17',
        },
        capabilities: {
          temperature: { min: 0, max: 2 },
        },
        contextWindow: 1000000,
      },
      {
        id: 'gpt-4.1-mini',
        pricing: {
          input: 0.4,
          cachedInput: 0.1,
          output: 1.6,
          updatedAt: '2025-06-17',
        },
        capabilities: {
          temperature: { min: 0, max: 2 },
        },
        contextWindow: 1000000,
      },
    ],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    description: "Anthropic's Claude models",
    defaultModel: 'claude-sonnet-4-5',
    modelPatterns: [/^claude/],
    icon: AnthropicIcon,
    capabilities: {
      toolUsageControl: true,
    },
    models: [
      {
        id: 'claude-opus-4-6',
        pricing: {
          input: 5.0,
          cachedInput: 0.5,
          output: 25.0,
          updatedAt: '2026-02-05',
        },
        capabilities: {
          temperature: { min: 0, max: 1 },
          nativeStructuredOutputs: true,
          maxOutputTokens: 128000,
          thinking: {
            levels: ['low', 'medium', 'high', 'max'],
            default: 'high',
          },
        },
        contextWindow: 200000,
      },
      {
        id: 'claude-opus-4-5',
        pricing: {
          input: 5.0,
          cachedInput: 0.5,
          output: 25.0,
          updatedAt: '2025-11-24',
        },
        capabilities: {
          temperature: { min: 0, max: 1 },
          nativeStructuredOutputs: true,
          maxOutputTokens: 64000,
          thinking: {
            levels: ['low', 'medium', 'high'],
            default: 'high',
          },
        },
        contextWindow: 200000,
      },
      {
        id: 'claude-opus-4-1',
        pricing: {
          input: 15.0,
          cachedInput: 1.5,
          output: 75.0,
          updatedAt: '2026-02-05',
        },
        capabilities: {
          temperature: { min: 0, max: 1 },
          nativeStructuredOutputs: true,
          maxOutputTokens: 64000,
          thinking: {
            levels: ['low', 'medium', 'high'],
            default: 'high',
          },
        },
        contextWindow: 200000,
      },
      {
        id: 'claude-opus-4-0',
        pricing: {
          input: 15.0,
          cachedInput: 1.5,
          output: 75.0,
          updatedAt: '2026-02-05',
        },
        capabilities: {
          temperature: { min: 0, max: 1 },
          maxOutputTokens: 64000,
          thinking: {
            levels: ['low', 'medium', 'high'],
            default: 'high',
          },
        },
        contextWindow: 200000,
      },
      {
        id: 'claude-sonnet-4-5',
        pricing: {
          input: 3.0,
          cachedInput: 0.3,
          output: 15.0,
          updatedAt: '2026-02-05',
        },
        capabilities: {
          temperature: { min: 0, max: 1 },
          nativeStructuredOutputs: true,
          maxOutputTokens: 64000,
          thinking: {
            levels: ['low', 'medium', 'high'],
            default: 'high',
          },
        },
        contextWindow: 200000,
      },
      {
        id: 'claude-sonnet-4-0',
        pricing: {
          input: 3.0,
          cachedInput: 0.3,
          output: 15.0,
          updatedAt: '2026-02-05',
        },
        capabilities: {
          temperature: { min: 0, max: 1 },
          maxOutputTokens: 64000,
          thinking: {
            levels: ['low', 'medium', 'high'],
            default: 'high',
          },
        },
        contextWindow: 200000,
      },
      {
        id: 'claude-haiku-4-5',
        pricing: {
          input: 1.0,
          cachedInput: 0.1,
          output: 5.0,
          updatedAt: '2026-02-05',
        },
        capabilities: {
          temperature: { min: 0, max: 1 },
          nativeStructuredOutputs: true,
          maxOutputTokens: 64000,
          thinking: {
            levels: ['low', 'medium', 'high'],
            default: 'high',
          },
        },
        contextWindow: 200000,
      },
      {
        id: 'claude-3-haiku-20240307',
        pricing: {
          input: 0.25,
          cachedInput: 0.03,
          output: 1.25,
          updatedAt: '2026-02-05',
        },
        capabilities: {
          temperature: { min: 0, max: 1 },
          maxOutputTokens: 4096,
        },
        contextWindow: 200000,
      },
    ],
  },
  google: {
    id: 'google',
    name: 'Google',
    description: "Google's Gemini models",
    defaultModel: 'gemini-2.5-pro',
    modelPatterns: [/^gemini/, /^deep-research/],
    capabilities: {
      toolUsageControl: true,
    },
    icon: GeminiIcon,
    models: [
      {
        id: 'gemini-3.1-pro-preview',
        pricing: {
          input: 2.0,
          cachedInput: 0.2,
          output: 12.0,
          updatedAt: '2026-02-19',
        },
        capabilities: {
          temperature: { min: 0, max: 2 },
          thinking: {
            levels: ['low', 'medium', 'high'],
            default: 'high',
          },
        },
        contextWindow: 1048576,
      },
      {
        id: 'gemini-3-pro-preview',
        pricing: {
          input: 2.0,
          cachedInput: 0.2,
          output: 12.0,
          updatedAt: '2025-12-17',
        },
        capabilities: {
          temperature: { min: 0, max: 2 },
          thinking: {
            levels: ['low', 'medium', 'high'],
            default: 'high',
          },
        },
        contextWindow: 1000000,
      },
      {
        id: 'gemini-3-flash-preview',
        pricing: {
          input: 0.5,
          cachedInput: 0.05,
          output: 3.0,
          updatedAt: '2025-12-17',
        },
        capabilities: {
          temperature: { min: 0, max: 2 },
          thinking: {
            levels: ['minimal', 'low', 'medium', 'high'],
            default: 'high',
          },
        },
        contextWindow: 1000000,
      },
      {
        id: 'gemini-2.5-pro',
        pricing: {
          input: 1.25,
          cachedInput: 0.125,
          output: 10.0,
          updatedAt: '2025-12-02',
        },
        capabilities: {
          temperature: { min: 0, max: 2 },
        },
        contextWindow: 1048576,
      },
      {
        id: 'gemini-2.5-flash',
        pricing: {
          input: 0.3,
          cachedInput: 0.03,
          output: 2.5,
          updatedAt: '2025-12-02',
        },
        capabilities: {
          temperature: { min: 0, max: 2 },
        },
        contextWindow: 1048576,
      },
      {
        id: 'gemini-2.5-flash-lite',
        pricing: {
          input: 0.1,
          cachedInput: 0.01,
          output: 0.4,
          updatedAt: '2025-12-02',
        },
        capabilities: {
          temperature: { min: 0, max: 2 },
        },
        contextWindow: 1048576,
      },
      {
        id: 'gemini-2.0-flash',
        pricing: {
          input: 0.1,
          output: 0.4,
          updatedAt: '2025-12-17',
        },
        capabilities: {
          temperature: { min: 0, max: 2 },
        },
        contextWindow: 1000000,
      },
      {
        id: 'gemini-2.0-flash-lite',
        pricing: {
          input: 0.075,
          output: 0.3,
          updatedAt: '2025-12-17',
        },
        capabilities: {
          temperature: { min: 0, max: 2 },
        },
        contextWindow: 1000000,
      },
      {
        id: 'deep-research-pro-preview-12-2025',
        pricing: {
          input: 2.0,
          output: 2.0,
          updatedAt: '2026-02-10',
        },
        capabilities: {
          deepResearch: true,
          memory: false,
        },
        contextWindow: 1000000,
      },
    ],
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local LLM models via Ollama',
    defaultModel: '',
    modelPatterns: [],
    icon: OllamaIcon,
    capabilities: {
      toolUsageControl: false, // Ollama does not support tool_choice parameter
    },
    contextInformationAvailable: false,
    models: [], // Populated dynamically
  },
}

export function getProviderModels(providerId: string): string[] {
  return PROVIDER_DEFINITIONS[providerId]?.models.map((m) => m.id) || []
}

export function getProviderDefaultModel(providerId: string): string {
  return PROVIDER_DEFINITIONS[providerId]?.defaultModel || ''
}

export function getModelPricing(modelId: string): ModelPricing | null {
  for (const provider of Object.values(PROVIDER_DEFINITIONS)) {
    const model = provider.models.find((m) => m.id.toLowerCase() === modelId.toLowerCase())
    if (model) {
      return model.pricing
    }
  }
  return null
}

export function getModelCapabilities(modelId: string): ModelCapabilities | null {
  for (const provider of Object.values(PROVIDER_DEFINITIONS)) {
    const model = provider.models.find((m) => m.id.toLowerCase() === modelId.toLowerCase())
    if (model) {
      const capabilities: ModelCapabilities = { ...provider.capabilities, ...model.capabilities }
      return capabilities
    }
  }

  for (const provider of Object.values(PROVIDER_DEFINITIONS)) {
    if (provider.modelPatterns) {
      for (const pattern of provider.modelPatterns) {
        if (pattern.test(modelId.toLowerCase())) {
          return provider.capabilities || null
        }
      }
    }
  }

  return null
}

export function getModelsWithTemperatureSupport(): string[] {
  const models: string[] = []
  for (const provider of Object.values(PROVIDER_DEFINITIONS)) {
    for (const model of provider.models) {
      if (model.capabilities.temperature) {
        models.push(model.id)
      }
    }
  }
  return models
}

export function getModelsWithTempRange01(): string[] {
  const models: string[] = []
  for (const provider of Object.values(PROVIDER_DEFINITIONS)) {
    for (const model of provider.models) {
      if (model.capabilities.temperature?.max === 1) {
        models.push(model.id)
      }
    }
  }
  return models
}

export function getModelsWithTempRange02(): string[] {
  const models: string[] = []
  for (const provider of Object.values(PROVIDER_DEFINITIONS)) {
    for (const model of provider.models) {
      if (model.capabilities.temperature?.max === 2) {
        models.push(model.id)
      }
    }
  }
  return models
}

export function getProvidersWithToolUsageControl(): string[] {
  const providers: string[] = []
  for (const [providerId, provider] of Object.entries(PROVIDER_DEFINITIONS)) {
    if (provider.capabilities?.toolUsageControl) {
      providers.push(providerId)
    }
  }
  return providers
}

export function getHostedModels(): string[] {
  return [
    ...getProviderModels('openai'),
    ...getProviderModels('anthropic'),
    ...getProviderModels('google'),
  ]
}

export function getComputerUseModels(): string[] {
  const models: string[] = []
  for (const provider of Object.values(PROVIDER_DEFINITIONS)) {
    for (const model of provider.models) {
      if (model.capabilities.computerUse) {
        models.push(model.id)
      }
    }
  }
  return models
}

export function supportsTemperature(modelId: string): boolean {
  const capabilities = getModelCapabilities(modelId)
  return !!capabilities?.temperature
}

export function getMaxTemperature(modelId: string): number | undefined {
  const capabilities = getModelCapabilities(modelId)
  return capabilities?.temperature?.max
}

export function supportsToolUsageControl(providerId: string): boolean {
  return getProvidersWithToolUsageControl().includes(providerId)
}

export function updateOllamaModels(models: string[]): void {
  PROVIDER_DEFINITIONS.ollama.models = models.map((modelId) => ({
    id: modelId,
    pricing: {
      input: 0,
      output: 0,
      updatedAt: new Date().toISOString().split('T')[0],
    },
    capabilities: {},
  }))
}

export const EMBEDDING_MODEL_PRICING: Record<string, ModelPricing> = {
  'text-embedding-3-small': {
    input: 0.02, // $0.02 per 1M tokens
    output: 0.0,
    updatedAt: '2025-07-10',
  },
  'text-embedding-3-large': {
    input: 0.13, // $0.13 per 1M tokens
    output: 0.0,
    updatedAt: '2025-07-10',
  },
  'text-embedding-ada-002': {
    input: 0.1, // $0.1 per 1M tokens
    output: 0.0,
    updatedAt: '2025-07-10',
  },
}

export function getEmbeddingModelPricing(modelId: string): ModelPricing | null {
  return EMBEDDING_MODEL_PRICING[modelId] || null
}

export function getModelsWithReasoningEffort(): string[] {
  const models: string[] = []
  for (const provider of Object.values(PROVIDER_DEFINITIONS)) {
    for (const model of provider.models) {
      if (model.capabilities.reasoningEffort) {
        models.push(model.id)
      }
    }
  }
  return models
}

/**
 * Get the reasoning effort values for a specific model
 * Returns the valid options for that model, or null if the model doesn't support reasoning effort
 */
export function getReasoningEffortValuesForModel(modelId: string): string[] | null {
  for (const provider of Object.values(PROVIDER_DEFINITIONS)) {
    const model = provider.models.find((m) => m.id.toLowerCase() === modelId.toLowerCase())
    if (model?.capabilities.reasoningEffort) {
      return model.capabilities.reasoningEffort.values
    }
  }
  return null
}

export function getModelsWithVerbosity(): string[] {
  const models: string[] = []
  for (const provider of Object.values(PROVIDER_DEFINITIONS)) {
    for (const model of provider.models) {
      if (model.capabilities.verbosity) {
        models.push(model.id)
      }
    }
  }
  return models
}

/**
 * Get the verbosity values for a specific model
 * Returns the valid options for that model, or null if the model doesn't support verbosity
 */
export function getVerbosityValuesForModel(modelId: string): string[] | null {
  for (const provider of Object.values(PROVIDER_DEFINITIONS)) {
    const model = provider.models.find((m) => m.id.toLowerCase() === modelId.toLowerCase())
    if (model?.capabilities.verbosity) {
      return model.capabilities.verbosity.values
    }
  }
  return null
}

/**
 * Check if a model supports native structured outputs.
 * Handles model IDs with date suffixes (e.g., claude-sonnet-4-5-20250514).
 */
export function supportsNativeStructuredOutputs(modelId: string): boolean {
  const normalizedModelId = modelId.toLowerCase()

  for (const provider of Object.values(PROVIDER_DEFINITIONS)) {
    for (const model of provider.models) {
      if (model.capabilities.nativeStructuredOutputs) {
        const baseModelId = model.id.toLowerCase()
        // Check exact match or date-suffixed version (e.g., claude-sonnet-4-5-20250514)
        if (normalizedModelId === baseModelId || normalizedModelId.startsWith(`${baseModelId}-`)) {
          return true
        }
      }
    }
  }
  return false
}

/**
 * Check if a model supports thinking/reasoning features.
 * Returns the thinking capability config if supported, null otherwise.
 */
export function getThinkingCapability(
  modelId: string
): { levels: string[]; default?: string } | null {
  const normalizedModelId = modelId.toLowerCase()

  for (const provider of Object.values(PROVIDER_DEFINITIONS)) {
    for (const model of provider.models) {
      if (model.capabilities.thinking) {
        const baseModelId = model.id.toLowerCase()
        if (normalizedModelId === baseModelId || normalizedModelId.startsWith(`${baseModelId}-`)) {
          return model.capabilities.thinking
        }
      }
    }
  }
  return null
}

/**
 * Get all models that support thinking capability
 */
export function getModelsWithThinking(): string[] {
  const models: string[] = []
  for (const provider of Object.values(PROVIDER_DEFINITIONS)) {
    for (const model of provider.models) {
      if (model.capabilities.thinking) {
        models.push(model.id)
      }
    }
  }
  return models
}

/**
 * Get the thinking levels for a specific model
 * Returns the valid levels for that model, or null if the model doesn't support thinking
 */
export function getThinkingLevelsForModel(modelId: string): string[] | null {
  const capability = getThinkingCapability(modelId)
  return capability?.levels ?? null
}

/**
 * Get all models that support deep research capability
 */
export function getModelsWithDeepResearch(): string[] {
  const models: string[] = []
  for (const provider of Object.values(PROVIDER_DEFINITIONS)) {
    for (const model of provider.models) {
      if (model.capabilities.deepResearch) {
        models.push(model.id)
      }
    }
  }
  return models
}

/**
 * Get all models that explicitly disable memory support (memory: false).
 * Models without this capability default to supporting memory.
 */
export function getModelsWithoutMemory(): string[] {
  const models: string[] = []
  for (const provider of Object.values(PROVIDER_DEFINITIONS)) {
    for (const model of provider.models) {
      if (model.capabilities.memory === false) {
        models.push(model.id)
      }
    }
  }
  return models
}

/**
 * Get the max output tokens for a specific model.
 *
 * @param modelId - The model ID
 */
export function getMaxOutputTokensForModel(modelId: string): number {
  const normalizedModelId = modelId.toLowerCase()
  const STANDARD_MAX_OUTPUT_TOKENS = 4096

  for (const provider of Object.values(PROVIDER_DEFINITIONS)) {
    for (const model of provider.models) {
      const baseModelId = model.id.toLowerCase()
      if (normalizedModelId === baseModelId || normalizedModelId.startsWith(`${baseModelId}-`)) {
        return model.capabilities.maxOutputTokens || STANDARD_MAX_OUTPUT_TOKENS
      }
    }
  }

  return STANDARD_MAX_OUTPUT_TOKENS
}
