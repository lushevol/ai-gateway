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
      { gatewayWsUrl: 'http://localhost:1212', localLlmBaseUrl: 'http://127.0.0.1:11434' },
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
      { gatewayWsUrl: 'http://localhost:1212', localLlmBaseUrl: 'http://127.0.0.1:11434' },
      fetchMock as unknown as typeof fetch,
    );

    const models = await adapter.fetchModels();
    expect(models).toEqual([{ id: 'gpt-4o-mini', owned_by: 'local' }]);
  });

  test('executeStream parses CRLF SSE frames', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"he"},"index":0,"finish_reason":null}]}\r\n\r\ndata: [DONE]\r\n\r\n',
          ),
        );
        controller.close();
      },
    });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      body: stream,
    });

    const adapter = new LocalApiAdapter(
      { gatewayWsUrl: 'http://localhost:1212', localLlmBaseUrl: 'http://127.0.0.1:11434' },
      fetchMock as unknown as typeof fetch,
    );

    const onChunk = jest.fn();
    await adapter.executeStream(
      {
        taskType: 'openai.chat',
        request: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }], stream: true },
      },
      onChunk,
    );

    expect(onChunk).toHaveBeenCalledWith({
      delta: 'he',
      index: 0,
      finish_reason: null,
    });
  });

  test('executeSync retries on 5xx and succeeds', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'retry-ok' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      });

    const adapter = new LocalApiAdapter(
      {
        gatewayWsUrl: 'http://localhost:1212',
        localLlmBaseUrl: 'http://127.0.0.1:11434',
        localApiMaxRetries: 1,
        localApiRetryBaseDelayMs: 0,
        localApiRetryMaxDelayMs: 0,
      },
      fetchMock as unknown as typeof fetch,
    );

    const result = await adapter.executeSync({
      taskType: 'openai.chat',
      request: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.content).toBe('retry-ok');
  });

  test('executeSync does not retry on 4xx', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
    });

    const adapter = new LocalApiAdapter(
      {
        gatewayWsUrl: 'http://localhost:1212',
        localLlmBaseUrl: 'http://127.0.0.1:11434',
        localApiMaxRetries: 2,
        localApiRetryBaseDelayMs: 0,
        localApiRetryMaxDelayMs: 0,
      },
      fetchMock as unknown as typeof fetch,
    );

    await expect(
      adapter.executeSync({
        taskType: 'openai.chat',
        request: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] },
      }),
    ).rejects.toThrow('Local API request failed with status 400');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
