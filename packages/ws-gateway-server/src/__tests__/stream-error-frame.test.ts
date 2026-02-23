import { ClaudeController } from '../controllers/claude.controller';
import { OpenAIController } from '../controllers/openai.controller';
import { ProviderAdapterService } from '../services/provider-adapter.service';

describe('stream error frame behavior', () => {
  test('provider adapter exposes OpenAI and Claude error frame builders', () => {
    const adapter = new ProviderAdapterService();

    expect(adapter.toOpenAIErrorSseFrame('boom')).toContain('error');
    expect(adapter.toClaudeErrorSseFrame('boom')).toContain('event: error');
  });

  test('OpenAI streaming writes error frame instead of throwing after SSE start', async () => {
    const gateway = {
      selectNextClientSocketId: jest.fn(() => 'socket-1'),
      emitTaskToClient: jest.fn(),
      requestModelsFromAll: jest.fn(),
    };

    const taskService = {
      createPendingTask: jest.fn(() => ({
        onChunk: jest.fn(() => () => undefined),
        waitForResult: jest.fn(async () => {
          throw new Error('worker failed');
        }),
      })),
    };

    const adapter = {
      toProxyTaskFromOpenAIChat: jest.fn(() => ({ taskId: 't1', responseMode: 'stream' })),
      toOpenAISseFrame: jest.fn(),
      openAIDoneFrame: jest.fn(() => 'data: [DONE]\\n\\n'),
      toOpenAIErrorSseFrame: jest.fn(() => 'data: {"error":{}}\\n\\n'),
      toOpenAIChatResponse: jest.fn(),
      toProxyTaskFromOpenAIEmbeddings: jest.fn(),
      toOpenAIEmbeddingResponse: jest.fn(),
      toOpenAIModelsResponse: jest.fn(),
    };

    const modelsAggregation = { waitForResponses: jest.fn() };
    const controller = new OpenAIController(gateway as any, taskService as any, adapter as any, modelsAggregation as any);

    const res = {
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };

    await expect(
      controller.createChatCompletion({ model: 'gpt-4o-mini', messages: [], stream: true }, res as any),
    ).resolves.toBeUndefined();

    expect(adapter.toOpenAIErrorSseFrame).toHaveBeenCalled();
    expect(res.write).toHaveBeenCalledWith('data: {"error":{}}\\n\\n');
    expect(res.end).toHaveBeenCalled();
  });

  test('Claude streaming writes error frame instead of throwing after SSE start', async () => {
    const gateway = {
      selectNextClientSocketId: jest.fn(() => 'socket-1'),
      emitTaskToClient: jest.fn(),
    };

    const taskService = {
      createPendingTask: jest.fn(() => ({
        onChunk: jest.fn(() => () => undefined),
        waitForResult: jest.fn(async () => {
          throw new Error('worker failed');
        }),
      })),
    };

    const adapter = {
      toProxyTaskFromClaudeMessages: jest.fn(() => ({ taskId: 't1', responseMode: 'stream' })),
      toClaudeSseFrame: jest.fn(() => 'event: content_block_delta\\ndata:{}\\n\\n'),
      toClaudeErrorSseFrame: jest.fn(() => 'event: error\\ndata:{}\\n\\n'),
      toClaudeMessagesResponse: jest.fn(),
    };

    const controller = new ClaudeController(gateway as any, taskService as any, adapter as any);

    const res = {
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };

    await expect(
      controller.createMessage({ model: 'claude', messages: [], stream: true }, res as any),
    ).resolves.toBeUndefined();

    expect(adapter.toClaudeErrorSseFrame).toHaveBeenCalled();
    expect(res.write).toHaveBeenCalledWith('event: error\\ndata:{}\\n\\n');
    expect(res.end).toHaveBeenCalled();
  });
});
