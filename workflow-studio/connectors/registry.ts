import { discordConnector } from '@/connectors/discord'
import { githubConnector } from '@/connectors/github'
import { gmailConnector } from '@/connectors/gmail'
import { jiraConnector } from '@/connectors/jira'
import { linearConnector } from '@/connectors/linear'
import { notionConnector } from '@/connectors/notion'
import { slackConnector } from '@/connectors/slack'
import type { ConnectorRegistry } from '@/connectors/types'

export const CONNECTOR_REGISTRY: ConnectorRegistry = {
  discord: discordConnector,
  github: githubConnector,
  gmail: gmailConnector,
  jira: jiraConnector,
  linear: linearConnector,
  notion: notionConnector,
  slack: slackConnector,
}
