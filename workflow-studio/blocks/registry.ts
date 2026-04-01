import { AgentBlock } from '@/blocks/blocks/agent'
import { ApiBlock } from '@/blocks/blocks/api'
import { ApiTriggerBlock } from '@/blocks/blocks/api_trigger'
import { BrowserUseBlock } from '@/blocks/blocks/browser_use'
import { ChatTriggerBlock } from '@/blocks/blocks/chat_trigger'
import { ConditionBlock } from '@/blocks/blocks/condition'
import { DiscordBlock } from '@/blocks/blocks/discord'
import { ElevenLabsBlock } from '@/blocks/blocks/elevenlabs'
import { EvaluatorBlock } from '@/blocks/blocks/evaluator'
import { ExaBlock } from '@/blocks/blocks/exa'
import { FileBlock, FileV2Block, FileV3Block } from '@/blocks/blocks/file'
import { FirecrawlBlock } from '@/blocks/blocks/firecrawl'
import { FunctionBlock } from '@/blocks/blocks/function'
import { GenericWebhookBlock } from '@/blocks/blocks/generic_webhook'
import { GitHubBlock, GitHubV2Block } from '@/blocks/blocks/github'
import { GmailBlock, GmailV2Block } from '@/blocks/blocks/gmail'
import { GoogleSearchBlock } from '@/blocks/blocks/google'
import { GuardrailsBlock } from '@/blocks/blocks/guardrails'
import { HumanInTheLoopBlock } from '@/blocks/blocks/human_in_the_loop'
import { ImageGeneratorBlock } from '@/blocks/blocks/image_generator'
import { InputTriggerBlock } from '@/blocks/blocks/input_trigger'
import { JinaBlock } from '@/blocks/blocks/jina'
import { JiraBlock } from '@/blocks/blocks/jira'
import { KnowledgeBlock } from '@/blocks/blocks/knowledge'
import { LinearBlock } from '@/blocks/blocks/linear'
import { ManualTriggerBlock } from '@/blocks/blocks/manual_trigger'
import { McpBlock } from '@/blocks/blocks/mcp'
import { MemoryBlock } from '@/blocks/blocks/memory'
import { MongoDBBlock } from '@/blocks/blocks/mongodb'
import { MySQLBlock } from '@/blocks/blocks/mysql'
import { NoteBlock } from '@/blocks/blocks/note'
import { NotionBlock, NotionV2Block } from '@/blocks/blocks/notion'
import { OpenAIBlock } from '@/blocks/blocks/openai'
import { ParallelBlock } from '@/blocks/blocks/parallel'
import { PerplexityBlock } from '@/blocks/blocks/perplexity'
import { PostgreSQLBlock } from '@/blocks/blocks/postgresql'
import { RedisBlock } from '@/blocks/blocks/redis'
import { ResponseBlock } from '@/blocks/blocks/response'
import { RouterBlock, RouterV2Block } from '@/blocks/blocks/router'
import { RssBlock } from '@/blocks/blocks/rss'
import { S3Block } from '@/blocks/blocks/s3'
import { ScheduleBlock } from '@/blocks/blocks/schedule'
import { SearchBlock } from '@/blocks/blocks/search'
import { SendGridBlock } from '@/blocks/blocks/sendgrid'
import { SerperBlock } from '@/blocks/blocks/serper'
import { SlackBlock } from '@/blocks/blocks/slack'
import { SmtpBlock } from '@/blocks/blocks/smtp'
import { SQSBlock } from '@/blocks/blocks/sqs'
import { StagehandBlock } from '@/blocks/blocks/stagehand'
import { StartTriggerBlock } from '@/blocks/blocks/start_trigger'
import { StarterBlock } from '@/blocks/blocks/starter'
import { SttBlock, SttV2Block } from '@/blocks/blocks/stt'
import { SupabaseBlock } from '@/blocks/blocks/supabase'
import { TableBlock } from '@/blocks/blocks/table'
import { TavilyBlock } from '@/blocks/blocks/tavily'
import { TelegramBlock } from '@/blocks/blocks/telegram'
import { ThinkingBlock } from '@/blocks/blocks/thinking'
import { TtsBlock } from '@/blocks/blocks/tts'
import { VariablesBlock } from '@/blocks/blocks/variables'
import { VisionBlock, VisionV2Block } from '@/blocks/blocks/vision'
import { WaitBlock } from '@/blocks/blocks/wait'
import { WebhookRequestBlock } from '@/blocks/blocks/webhook_request'
import { WorkflowBlock } from '@/blocks/blocks/workflow'
import { WorkflowInputBlock } from '@/blocks/blocks/workflow_input'
import type { BlockConfig } from '@/blocks/types'

// Registry of all available blocks, alphabetically sorted
export const registry: Record<string, BlockConfig> = {
  agent: AgentBlock,
  api: ApiBlock,
  api_trigger: ApiTriggerBlock,
  browser_use: BrowserUseBlock,
  chat_trigger: ChatTriggerBlock,
  condition: ConditionBlock,
  discord: DiscordBlock,
  elevenlabs: ElevenLabsBlock,
  evaluator: EvaluatorBlock,
  exa: ExaBlock,
  file: FileBlock,
  file_v2: FileV2Block,
  file_v3: FileV3Block,
  firecrawl: FirecrawlBlock,
  function: FunctionBlock,
  generic_webhook: GenericWebhookBlock,
  github: GitHubBlock,
  github_v2: GitHubV2Block,
  gmail: GmailBlock,
  gmail_v2: GmailV2Block,
  google_search: GoogleSearchBlock,
  guardrails: GuardrailsBlock,
  human_in_the_loop: HumanInTheLoopBlock,
  image_generator: ImageGeneratorBlock,
  input_trigger: InputTriggerBlock,
  jina: JinaBlock,
  jira: JiraBlock,
  knowledge: KnowledgeBlock,
  linear: LinearBlock,
  manual_trigger: ManualTriggerBlock,
  mcp: McpBlock,
  memory: MemoryBlock,
  mongodb: MongoDBBlock,
  mysql: MySQLBlock,
  note: NoteBlock,
  notion: NotionBlock,
  notion_v2: NotionV2Block,
  openai: OpenAIBlock,
  parallel_ai: ParallelBlock,
  perplexity: PerplexityBlock,
  postgresql: PostgreSQLBlock,
  redis: RedisBlock,
  response: ResponseBlock,
  router: RouterBlock,
  router_v2: RouterV2Block,
  rss: RssBlock,
  s3: S3Block,
  schedule: ScheduleBlock,
  search: SearchBlock,
  sendgrid: SendGridBlock,
  serper: SerperBlock,
  slack: SlackBlock,
  smtp: SmtpBlock,
  sqs: SQSBlock,
  stagehand: StagehandBlock,
  start_trigger: StartTriggerBlock,
  starter: StarterBlock,
  stt: SttBlock,
  stt_v2: SttV2Block,
  supabase: SupabaseBlock,
  table: TableBlock,
  tavily: TavilyBlock,
  telegram: TelegramBlock,
  thinking: ThinkingBlock,
  tts: TtsBlock,
  variables: VariablesBlock,
  vision: VisionBlock,
  vision_v2: VisionV2Block,
  wait: WaitBlock,
  webhook_request: WebhookRequestBlock,
  workflow: WorkflowBlock,
  workflow_input: WorkflowInputBlock,
}

export const getBlock = (type: string): BlockConfig | undefined => {
  if (registry[type]) {
    return registry[type]
  }
  const normalized = type.replace(/-/g, '_')
  return registry[normalized]
}

export const getLatestBlock = (baseType: string): BlockConfig | undefined => {
  const normalized = baseType.replace(/-/g, '_')

  const versionedKeys = Object.keys(registry).filter((key) => {
    const match = key.match(new RegExp(`^${normalized}_v(\\d+)$`))
    return match !== null
  })

  if (versionedKeys.length > 0) {
    const sorted = versionedKeys.sort((a, b) => {
      const versionA = Number.parseInt(a.match(/_v(\d+)$/)?.[1] || '0', 10)
      const versionB = Number.parseInt(b.match(/_v(\d+)$/)?.[1] || '0', 10)
      return versionB - versionA
    })
    return registry[sorted[0]]
  }

  return registry[normalized]
}

export const getBlockByToolName = (toolName: string): BlockConfig | undefined => {
  return Object.values(registry).find((block) => block.tools?.access?.includes(toolName))
}

export const getBlocksByCategory = (category: 'blocks' | 'tools' | 'triggers'): BlockConfig[] =>
  Object.values(registry).filter((block) => block.category === category)

export const getAllBlockTypes = (): string[] => Object.keys(registry)

export const isValidBlockType = (type: string): type is string =>
  type in registry || type.replace(/-/g, '_') in registry

export const getAllBlocks = (): BlockConfig[] => Object.values(registry)
