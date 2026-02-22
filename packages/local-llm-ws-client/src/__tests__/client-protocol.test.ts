import { LocalLlmWsClient } from '../client';

class FakeSocket {
  handlers: Record<string, (payload: any) => void> = {};
  emitted: Array<{ event: string; payload: any }> = [];

  on(event: string, handler: (payload: any) => void): void {
    this.handlers[event] = handler;
  }

  emit(event: string, payload: any): void {
    this.emitted.push({ event, payload });
  }
}

describe('LocalLlmWsClient protocol', () => {
  test('handles stream task:create and emits chunk then complete', async () => {
    const socket = new FakeSocket();
    const adapter = {
      executeSync: jest.fn(),
      executeStream: jest.fn(async (_task: any, onChunk: (chunk: any) => void) => {
        onChunk({ delta: 'he' });
        onChunk({ delta: 'llo' });
        return { content: 'hello' };
      }),
      fetchModels: jest.fn(),
    };

    const client = new LocalLlmWsClient(
      { gatewayWsUrl: 'http://localhost:3000', localLlmBaseUrl: 'http://127.0.0.1:11434' },
      socket as any,
      adapter as any,
    );

    client.start();
    await socket.handlers['task:create']({
      taskId: 't1',
      taskType: 'openai.chat',
      responseMode: 'stream',
      request: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }], stream: true },
    });

    expect(socket.emitted[0].event).toBe('task:chunk');
    expect(socket.emitted[1].event).toBe('task:chunk');
    expect(socket.emitted[2].event).toBe('task:complete');
  });

  test('handles models:request and emits models:response', async () => {
    const socket = new FakeSocket();
    const adapter = {
      executeSync: jest.fn(),
      executeStream: jest.fn(),
      fetchModels: jest.fn(async () => [{ id: 'gpt-4o-mini', owned_by: 'local' }]),
    };

    const client = new LocalLlmWsClient(
      { gatewayWsUrl: 'http://localhost:3000', localLlmBaseUrl: 'http://127.0.0.1:11434' },
      socket as any,
      adapter as any,
    );

    client.start();
    await socket.handlers['models:request']({ requestId: 'm1' });

    expect(socket.emitted[0]).toEqual({
      event: 'models:response',
      payload: { requestId: 'm1', models: [{ id: 'gpt-4o-mini', owned_by: 'local' }] },
    });
  });
});
