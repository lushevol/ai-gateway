import { LocalApiAdapter } from '../local-api-adapter';

describe('LocalApiAdapter', () => {
  test('executeSync maps openai chat result', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'hello' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    });

    const adapter = new LocalApiAdapter(
      { gatewayWsUrl: 'http://localhost:3000', localLlmBaseUrl: 'http://127.0.0.1:11434' },
      fetchMock as unknown as typeof fetch,
    );

    const result = await adapter.executeSync({
      taskType: 'openai.chat',
      request: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] },
    });

    expect(result).toEqual({
      content: 'hello',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
  });

  test('fetchModels returns normalized model descriptors', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'gpt-4o-mini', owned_by: 'local' }] }),
    });

    const adapter = new LocalApiAdapter(
      { gatewayWsUrl: 'http://localhost:3000', localLlmBaseUrl: 'http://127.0.0.1:11434' },
      fetchMock as unknown as typeof fetch,
    );

    const models = await adapter.fetchModels();
    expect(models).toEqual([{ id: 'gpt-4o-mini', owned_by: 'local' }]);
  });
});
