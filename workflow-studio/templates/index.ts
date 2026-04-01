import type { SerializedWorkflow } from '../serializer/types'

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: 'ai' | 'notification' | 'data' | 'automation' | 'reporting'
  icon: string
  tags: string[]
  workflow: SerializedWorkflow
}

// ---------------------------------------------------------------------------
// Template A: Daily Content Brief
// ---------------------------------------------------------------------------
const dailyContentBrief: WorkflowTemplate = {
  id: 'daily-content-brief',
  name: 'Daily Content Brief',
  description: 'AI agent researches daily topics and posts a formatted brief',
  category: 'ai',
  icon: 'Newspaper',
  tags: ['ai', 'content', 'schedule', 'daily'],
  workflow: {
    version: '1',
    blocks: [
      {
        id: 'starter-1',
        position: { x: 0, y: 200 },
        config: {
          tool: 'starter',
          params: {
            startWorkflow: 'manual',
          },
        },
        inputs: {},
        outputs: {},
        metadata: {
          id: 'starter-1',
          name: 'Daily Trigger',
          description: 'Triggers the content brief workflow daily',
        },
        enabled: true,
      },
      {
        id: 'agent-1',
        position: { x: 300, y: 200 },
        config: {
          tool: 'agent',
          params: {
            messages: JSON.stringify([
              {
                role: 'system',
                content:
                  'You are a crypto and DeFi research specialist. Research today\'s trending topics, notable protocol updates, governance proposals, and market-moving events in the crypto/DeFi space. Focus on actionable insights and emerging narratives.\n\n## Output Format\n1. **Top Headlines** (3-5 bullet points)\n2. **Trending Narratives** (2-3 themes with brief context)\n3. **Notable On-Chain Activity** (significant transactions, TVL changes)\n4. **Upcoming Events** (launches, votes, unlocks in the next 48h)\n5. **Key Takeaway** (1-2 sentences)',
              },
              {
                role: 'user',
                content: 'Generate today\'s crypto/DeFi content brief.',
              },
            ]),
            model: 'claude-sonnet-4-20250514',
            temperature: 0.4,
          },
        },
        inputs: {
          messages: 'json',
          model: 'string',
        },
        outputs: {
          content: 'string',
          model: 'string',
          tokens: 'json',
        },
        metadata: {
          id: 'agent-1',
          name: 'Research Agent',
          description: 'Researches trending crypto/DeFi topics',
        },
        enabled: true,
      },
      {
        id: 'func-1',
        position: { x: 600, y: 200 },
        config: {
          tool: 'function',
          params: {
            code: `const content = <agent-1.content>;
const now = new Date().toISOString().split('T')[0];

const formatted = [
  '# Daily Content Brief — ' + now,
  '',
  content,
  '',
  '---',
  '*Generated automatically by Mission Control*',
].join('\\n');

return { markdown: formatted, date: now };`,
          },
        },
        inputs: {
          code: 'string',
        },
        outputs: {
          result: 'json',
          stdout: 'string',
        },
        metadata: {
          id: 'func-1',
          name: 'Format Brief',
          description: 'Formats the brief as markdown with date header',
        },
        enabled: true,
      },
      {
        id: 'api-1',
        position: { x: 900, y: 200 },
        config: {
          tool: 'api',
          params: {
            url: 'https://your-webhook-url.example.com/briefs',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: '<func-1.result.markdown>',
              date: '<func-1.result.date>',
            }),
          },
        },
        inputs: {
          url: 'string',
          method: 'string',
          headers: 'json',
          body: 'json',
        },
        outputs: {
          data: 'json',
          status: 'number',
          headers: 'json',
        },
        metadata: {
          id: 'api-1',
          name: 'Post Brief',
          description: 'Posts the formatted brief to a webhook endpoint',
        },
        enabled: true,
      },
    ],
    connections: [
      { source: 'starter-1', target: 'agent-1' },
      { source: 'agent-1', target: 'func-1' },
      { source: 'func-1', target: 'api-1' },
    ],
    loops: {},
    parallels: {},
  },
}

// ---------------------------------------------------------------------------
// Template B: Webhook-to-Slack Notifier
// ---------------------------------------------------------------------------
const webhookSlackNotify: WorkflowTemplate = {
  id: 'webhook-slack-notify',
  name: 'Webhook-to-Slack Notifier',
  description: 'Receives webhooks and forwards formatted notifications to Slack',
  category: 'notification',
  icon: 'Bell',
  tags: ['webhook', 'slack', 'notification', 'integration'],
  workflow: {
    version: '1',
    blocks: [
      {
        id: 'starter-1',
        position: { x: 0, y: 200 },
        config: {
          tool: 'starter',
          params: {
            startWorkflow: 'manual',
          },
        },
        inputs: {},
        outputs: {},
        metadata: {
          id: 'starter-1',
          name: 'Webhook Trigger',
          description: 'Receives incoming webhook payloads',
        },
        enabled: true,
      },
      {
        id: 'func-1',
        position: { x: 300, y: 200 },
        config: {
          tool: 'function',
          params: {
            code: `const payload = <starter-1.input>;

// Extract relevant fields from the incoming webhook
const eventType = payload?.event || payload?.type || 'unknown';
const message = payload?.message || payload?.text || JSON.stringify(payload);
const source = payload?.source || payload?.app || 'External Service';
const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });

// Format as a Slack-friendly message
const formatted = [
  '*[' + source + '] ' + eventType + '*',
  '',
  message,
  '',
  '_Received at ' + timestamp + ' UTC_',
].join('\\n');

return { text: formatted, eventType, source };`,
          },
        },
        inputs: {
          code: 'string',
        },
        outputs: {
          result: 'json',
          stdout: 'string',
        },
        metadata: {
          id: 'func-1',
          name: 'Parse & Format',
          description: 'Parses webhook payload and formats a Slack message',
        },
        enabled: true,
      },
      {
        id: 'slack-1',
        position: { x: 600, y: 200 },
        config: {
          tool: 'slack',
          params: {
            operation: 'send',
            text: '<func-1.result.text>',
          },
        },
        inputs: {
          text: 'string',
        },
        outputs: {
          data: 'json',
          status: 'number',
        },
        metadata: {
          id: 'slack-1',
          name: 'Slack Notify',
          description: 'Posts the formatted notification to a Slack channel',
        },
        enabled: true,
      },
    ],
    connections: [
      { source: 'starter-1', target: 'func-1' },
      { source: 'func-1', target: 'slack-1' },
    ],
    loops: {},
    parallels: {},
  },
}

// ---------------------------------------------------------------------------
// Template C: Scheduled Report Generator
// ---------------------------------------------------------------------------
const weeklyReport: WorkflowTemplate = {
  id: 'weekly-report',
  name: 'Scheduled Report Generator',
  description: 'Weekly data fetch and AI-powered report generation',
  category: 'reporting',
  icon: 'BarChart3',
  tags: ['reporting', 'schedule', 'ai', 'analytics'],
  workflow: {
    version: '1',
    blocks: [
      {
        id: 'starter-1',
        position: { x: 0, y: 200 },
        config: {
          tool: 'starter',
          params: {
            startWorkflow: 'manual',
          },
        },
        inputs: {},
        outputs: {},
        metadata: {
          id: 'starter-1',
          name: 'Weekly Trigger',
          description: 'Triggers report generation on a weekly schedule',
        },
        enabled: true,
      },
      {
        id: 'api-1',
        position: { x: 300, y: 200 },
        config: {
          tool: 'api',
          params: {
            url: 'https://your-api.example.com/analytics/weekly',
            method: 'GET',
            headers: {
              Authorization: 'Bearer {{API_TOKEN}}',
              'Content-Type': 'application/json',
            },
          },
        },
        inputs: {
          url: 'string',
          method: 'string',
          headers: 'json',
        },
        outputs: {
          data: 'json',
          status: 'number',
          headers: 'json',
        },
        metadata: {
          id: 'api-1',
          name: 'Fetch Data',
          description: 'Fetches weekly analytics data from the API',
        },
        enabled: true,
      },
      {
        id: 'agent-1',
        position: { x: 600, y: 200 },
        config: {
          tool: 'agent',
          params: {
            messages: JSON.stringify([
              {
                role: 'system',
                content:
                  'You are a data analyst specializing in concise, executive-ready reports. Given raw analytics data, produce a structured weekly summary.\n\n## Output Format\n1. **Executive Summary** (2-3 sentences)\n2. **Key Metrics** (table or bullet list of important numbers with week-over-week change)\n3. **Highlights** (3-5 notable events or trends)\n4. **Concerns** (anything requiring attention)\n5. **Recommendations** (1-3 actionable next steps)',
              },
              {
                role: 'user',
                content:
                  'Analyze the following weekly data and write a summary report:\n\n<api-1.data>',
              },
            ]),
            model: 'claude-sonnet-4-20250514',
            temperature: 0.3,
          },
        },
        inputs: {
          messages: 'json',
          model: 'string',
        },
        outputs: {
          content: 'string',
          model: 'string',
          tokens: 'json',
        },
        metadata: {
          id: 'agent-1',
          name: 'Report Writer',
          description: 'Analyzes data and writes a summary report',
        },
        enabled: true,
      },
      {
        id: 'func-1',
        position: { x: 900, y: 200 },
        config: {
          tool: 'function',
          params: {
            code: `const report = <agent-1.content>;
const now = new Date();
const weekEnd = now.toISOString().split('T')[0];
const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

return {
  title: 'Weekly Report: ' + weekStart + ' to ' + weekEnd,
  body: report,
  generatedAt: now.toISOString(),
  period: { start: weekStart, end: weekEnd },
};`,
          },
        },
        inputs: {
          code: 'string',
        },
        outputs: {
          result: 'json',
          stdout: 'string',
        },
        metadata: {
          id: 'func-1',
          name: 'Format Report',
          description: 'Adds date range and metadata to the report',
        },
        enabled: true,
      },
    ],
    connections: [
      { source: 'starter-1', target: 'api-1' },
      { source: 'api-1', target: 'agent-1' },
      { source: 'agent-1', target: 'func-1' },
    ],
    loops: {},
    parallels: {},
  },
}

// ---------------------------------------------------------------------------
// Template D: API Health Monitor
// ---------------------------------------------------------------------------
const apiHealthMonitor: WorkflowTemplate = {
  id: 'api-health-monitor',
  name: 'API Health Monitor',
  description: 'Periodically checks API endpoints and alerts on failures',
  category: 'automation',
  icon: 'HeartPulse',
  tags: ['monitoring', 'health', 'alert', 'schedule', 'slack'],
  workflow: {
    version: '1',
    blocks: [
      {
        id: 'starter-1',
        position: { x: 0, y: 200 },
        config: {
          tool: 'starter',
          params: {
            startWorkflow: 'manual',
          },
        },
        inputs: {},
        outputs: {},
        metadata: {
          id: 'starter-1',
          name: 'Health Check Trigger',
          description: 'Triggers health check every 15 minutes',
        },
        enabled: true,
      },
      {
        id: 'api-1',
        position: { x: 300, y: 200 },
        config: {
          tool: 'api',
          params: {
            url: 'https://your-service.example.com/api/health',
            method: 'GET',
            headers: {},
          },
        },
        inputs: {
          url: 'string',
          method: 'string',
        },
        outputs: {
          data: 'json',
          status: 'number',
          headers: 'json',
        },
        metadata: {
          id: 'api-1',
          name: 'Check Health',
          description: 'Sends GET request to the health endpoint',
        },
        enabled: true,
      },
      {
        id: 'func-1',
        position: { x: 600, y: 200 },
        config: {
          tool: 'function',
          params: {
            code: `const status = <api-1.status>;
const data = <api-1.data>;
const isHealthy = status >= 200 && status < 300;
const timestamp = new Date().toISOString();

return {
  healthy: isHealthy,
  status: status,
  timestamp: timestamp,
  details: isHealthy
    ? 'Service is responding normally (HTTP ' + status + ')'
    : 'Service returned HTTP ' + status + ': ' + JSON.stringify(data),
};`,
          },
        },
        inputs: {
          code: 'string',
        },
        outputs: {
          result: 'json',
          stdout: 'string',
        },
        metadata: {
          id: 'func-1',
          name: 'Evaluate Status',
          description: 'Checks HTTP status code and determines health',
        },
        enabled: true,
      },
      {
        id: 'condition-1',
        position: { x: 900, y: 200 },
        config: {
          tool: 'condition',
          params: {
            conditions: '<func-1.result.healthy> === false',
          },
        },
        inputs: {},
        outputs: {
          conditionResult: 'boolean',
          selectedPath: 'json',
          selectedOption: 'string',
        },
        metadata: {
          id: 'condition-1',
          name: 'Is Unhealthy?',
          description: 'Routes to alert if the health check failed',
        },
        enabled: true,
      },
      {
        id: 'slack-1',
        position: { x: 1200, y: 100 },
        config: {
          tool: 'slack',
          params: {
            operation: 'send',
            text: '*API Health Alert*\n\nStatus: <func-1.result.status>\nDetails: <func-1.result.details>\nTime: <func-1.result.timestamp>',
          },
        },
        inputs: {
          text: 'string',
        },
        outputs: {
          data: 'json',
          status: 'number',
        },
        metadata: {
          id: 'slack-1',
          name: 'Send Alert',
          description: 'Posts a health alert to Slack when service is unhealthy',
        },
        enabled: true,
      },
      {
        id: 'func-2',
        position: { x: 1200, y: 350 },
        config: {
          tool: 'function',
          params: {
            code: `return { status: 'ok', message: 'Health check passed', timestamp: new Date().toISOString() };`,
          },
        },
        inputs: {
          code: 'string',
        },
        outputs: {
          result: 'json',
          stdout: 'string',
        },
        metadata: {
          id: 'func-2',
          name: 'Log Healthy',
          description: 'Logs that the health check passed',
        },
        enabled: true,
      },
    ],
    connections: [
      { source: 'starter-1', target: 'api-1' },
      { source: 'api-1', target: 'func-1' },
      { source: 'func-1', target: 'condition-1' },
      {
        source: 'condition-1',
        target: 'slack-1',
        sourceHandle: 'condition-1-true',
        condition: { type: 'if', expression: '<func-1.result.healthy> === false' },
      },
      {
        source: 'condition-1',
        target: 'func-2',
        sourceHandle: 'condition-1-false',
        condition: { type: 'else' },
      },
    ],
    loops: {},
    parallels: {},
  },
}

// ---------------------------------------------------------------------------
// Template E: Content Review Pipeline
// ---------------------------------------------------------------------------
const contentReview: WorkflowTemplate = {
  id: 'content-review',
  name: 'Content Review Pipeline',
  description: 'AI-powered content review with pass/fail routing',
  category: 'ai',
  icon: 'ClipboardCheck',
  tags: ['ai', 'content', 'review', 'quality'],
  workflow: {
    version: '1',
    blocks: [
      {
        id: 'starter-1',
        position: { x: 0, y: 200 },
        config: {
          tool: 'starter',
          params: {
            startWorkflow: 'manual',
          },
        },
        inputs: {},
        outputs: {},
        metadata: {
          id: 'starter-1',
          name: 'Submit Content',
          description: 'Manually trigger content review with input',
        },
        enabled: true,
      },
      {
        id: 'agent-1',
        position: { x: 300, y: 200 },
        config: {
          tool: 'agent',
          params: {
            messages: JSON.stringify([
              {
                role: 'system',
                content:
                  'You are an expert content reviewer. Evaluate the provided content for quality, factual accuracy, tone, grammar, and brand consistency.\n\n## Scoring Criteria\n- **Accuracy** (0-10): Are claims factual and verifiable?\n- **Clarity** (0-10): Is the writing clear and easy to follow?\n- **Tone** (0-10): Is the tone appropriate for the audience?\n- **Grammar** (0-10): Are there grammatical or spelling errors?\n- **Engagement** (0-10): Is the content compelling and valuable?\n\n## Output Format\nReturn a JSON object with:\n- scores: object with each criterion and its score\n- overallScore: average of all scores (0-10)\n- passed: boolean (true if overallScore >= 7)\n- summary: 2-3 sentence overall assessment\n- issues: array of specific issues found (empty if none)\n- suggestions: array of improvement suggestions',
              },
              {
                role: 'user',
                content: 'Review the following content:\n\n<starter-1.input>',
              },
            ]),
            model: 'claude-sonnet-4-20250514',
            temperature: 0.2,
            responseFormat: JSON.stringify({
              name: 'content_review',
              schema: {
                type: 'object',
                properties: {
                  scores: {
                    type: 'object',
                    properties: {
                      accuracy: { type: 'number' },
                      clarity: { type: 'number' },
                      tone: { type: 'number' },
                      grammar: { type: 'number' },
                      engagement: { type: 'number' },
                    },
                    required: ['accuracy', 'clarity', 'tone', 'grammar', 'engagement'],
                  },
                  overallScore: { type: 'number' },
                  passed: { type: 'boolean' },
                  summary: { type: 'string' },
                  issues: { type: 'array', items: { type: 'string' } },
                  suggestions: { type: 'array', items: { type: 'string' } },
                },
                required: ['scores', 'overallScore', 'passed', 'summary', 'issues', 'suggestions'],
              },
              strict: true,
            }),
          },
        },
        inputs: {
          messages: 'json',
          model: 'string',
          responseFormat: 'json',
        },
        outputs: {
          content: 'string',
          model: 'string',
          tokens: 'json',
        },
        metadata: {
          id: 'agent-1',
          name: 'Content Reviewer',
          description: 'Reviews content for quality, accuracy, and tone',
        },
        enabled: true,
      },
      {
        id: 'func-1',
        position: { x: 600, y: 200 },
        config: {
          tool: 'function',
          params: {
            code: `const review = typeof <agent-1.content> === 'string'
  ? JSON.parse(<agent-1.content>)
  : <agent-1.content>;

return {
  passed: review.passed,
  overallScore: review.overallScore,
  summary: review.summary,
  issues: review.issues || [],
  suggestions: review.suggestions || [],
  scores: review.scores,
};`,
          },
        },
        inputs: {
          code: 'string',
        },
        outputs: {
          result: 'json',
          stdout: 'string',
        },
        metadata: {
          id: 'func-1',
          name: 'Parse Review',
          description: 'Parses the structured review into a clean result',
        },
        enabled: true,
      },
      {
        id: 'condition-1',
        position: { x: 900, y: 200 },
        config: {
          tool: 'condition',
          params: {
            conditions: '<func-1.result.passed> === true',
          },
        },
        inputs: {},
        outputs: {
          conditionResult: 'boolean',
          selectedPath: 'json',
          selectedOption: 'string',
        },
        metadata: {
          id: 'condition-1',
          name: 'Pass or Fail?',
          description: 'Routes based on whether the content passed review',
        },
        enabled: true,
      },
      {
        id: 'func-2',
        position: { x: 1200, y: 100 },
        config: {
          tool: 'function',
          params: {
            code: `return {
  status: 'approved',
  message: 'Content passed review with score ' + <func-1.result.overallScore> + '/10',
  summary: <func-1.result.summary>,
};`,
          },
        },
        inputs: {
          code: 'string',
        },
        outputs: {
          result: 'json',
          stdout: 'string',
        },
        metadata: {
          id: 'func-2',
          name: 'Approve',
          description: 'Marks content as approved',
        },
        enabled: true,
      },
      {
        id: 'func-3',
        position: { x: 1200, y: 350 },
        config: {
          tool: 'function',
          params: {
            code: `return {
  status: 'rejected',
  message: 'Content needs revision — score ' + <func-1.result.overallScore> + '/10',
  summary: <func-1.result.summary>,
  issues: <func-1.result.issues>,
  suggestions: <func-1.result.suggestions>,
};`,
          },
        },
        inputs: {
          code: 'string',
        },
        outputs: {
          result: 'json',
          stdout: 'string',
        },
        metadata: {
          id: 'func-3',
          name: 'Request Revision',
          description: 'Returns revision feedback with issues and suggestions',
        },
        enabled: true,
      },
    ],
    connections: [
      { source: 'starter-1', target: 'agent-1' },
      { source: 'agent-1', target: 'func-1' },
      { source: 'func-1', target: 'condition-1' },
      {
        source: 'condition-1',
        target: 'func-2',
        sourceHandle: 'condition-1-true',
        condition: { type: 'if', expression: '<func-1.result.passed> === true' },
      },
      {
        source: 'condition-1',
        target: 'func-3',
        sourceHandle: 'condition-1-false',
        condition: { type: 'else' },
      },
    ],
    loops: {},
    parallels: {},
  },
}

// ---------------------------------------------------------------------------
// Template F: Data Transform Pipeline
// ---------------------------------------------------------------------------
const dataTransform: WorkflowTemplate = {
  id: 'data-transform',
  name: 'Data Transform Pipeline',
  description: 'Validates, transforms, and forwards data between APIs',
  category: 'data',
  icon: 'ArrowRightLeft',
  tags: ['data', 'transform', 'api', 'pipeline'],
  workflow: {
    version: '1',
    blocks: [
      {
        id: 'starter-1',
        position: { x: 0, y: 200 },
        config: {
          tool: 'starter',
          params: {
            startWorkflow: 'manual',
          },
        },
        inputs: {},
        outputs: {},
        metadata: {
          id: 'starter-1',
          name: 'Receive Data',
          description: 'Receives incoming data via API trigger',
        },
        enabled: true,
      },
      {
        id: 'func-1',
        position: { x: 300, y: 200 },
        config: {
          tool: 'function',
          params: {
            code: `const input = <starter-1.input>;

// Validate required fields
const errors = [];
if (!input) errors.push('Input payload is empty');
if (input && !input.id) errors.push('Missing required field: id');
if (input && !input.data) errors.push('Missing required field: data');

if (errors.length > 0) {
  throw new Error('Validation failed: ' + errors.join(', '));
}

// Transform the data
const transformed = {
  externalId: String(input.id),
  payload: typeof input.data === 'string' ? JSON.parse(input.data) : input.data,
  metadata: {
    source: input.source || 'unknown',
    receivedAt: new Date().toISOString(),
    version: input.version || '1.0',
  },
};

return { valid: true, data: transformed };`,
          },
        },
        inputs: {
          code: 'string',
        },
        outputs: {
          result: 'json',
          stdout: 'string',
        },
        metadata: {
          id: 'func-1',
          name: 'Validate & Transform',
          description: 'Validates input schema and transforms the data',
        },
        enabled: true,
      },
      {
        id: 'api-1',
        position: { x: 600, y: 200 },
        config: {
          tool: 'api',
          params: {
            url: 'https://destination-api.example.com/ingest',
            method: 'POST',
            headers: {
              Authorization: 'Bearer {{DESTINATION_API_KEY}}',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              data: '<func-1.result.data>',
            }),
          },
        },
        inputs: {
          url: 'string',
          method: 'string',
          headers: 'json',
          body: 'json',
        },
        outputs: {
          data: 'json',
          status: 'number',
          headers: 'json',
        },
        metadata: {
          id: 'api-1',
          name: 'Forward Data',
          description: 'Posts transformed data to the destination API',
        },
        enabled: true,
      },
      {
        id: 'func-2',
        position: { x: 900, y: 200 },
        config: {
          tool: 'function',
          params: {
            code: `const status = <api-1.status>;
const responseData = <api-1.data>;
const transformedData = <func-1.result.data>;

return {
  success: status >= 200 && status < 300,
  destinationStatus: status,
  externalId: transformedData.externalId,
  response: responseData,
  processedAt: new Date().toISOString(),
};`,
          },
        },
        inputs: {
          code: 'string',
        },
        outputs: {
          result: 'json',
          stdout: 'string',
        },
        metadata: {
          id: 'func-2',
          name: 'Log Result',
          description: 'Logs the forwarding result with status and metadata',
        },
        enabled: true,
      },
    ],
    connections: [
      { source: 'starter-1', target: 'func-1' },
      { source: 'func-1', target: 'api-1' },
      { source: 'api-1', target: 'func-2' },
    ],
    loops: {},
    parallels: {},
  },
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  dailyContentBrief,
  webhookSlackNotify,
  weeklyReport,
  apiHealthMonitor,
  contentReview,
  dataTransform,
]

export function getTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id)
}
