/**
 * Mistral parser tool stub — stripped during Sim Studio fork.
 */

export const mistralParserTool: any = {
  id: 'mistral_parser',
  name: 'Mistral Parser',
  request: {
    url: (_params: any) => '/api/internal/mistral-ocr',
    headers: (_params: any) => ({ 'Content-Type': 'application/json' }),
    body: (_params: any) => ({}),
  },
  transformResponse: async (_response: any, _params: any) => ({
    success: false,
    output: { content: '' },
  }),
}
