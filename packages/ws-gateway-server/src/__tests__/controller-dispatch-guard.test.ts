import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ClaudeController } from '../controllers/claude.controller';
import { OpenAIController } from '../controllers/openai.controller';

describe('Controller dispatch guard', () => {
  test('OpenAI chat sync cancels pending task when no client is online', async () => {
    const gateway = { dispatchTask: jest.fn(() => false) };
    const taskService = { createPendingTask: jest.fn(() => ({ waitForResult: jest.fn() })), cancelTask: jest.fn() };
    const adapter = {
      toProxyTaskFromOpenAIChat: jest.fn(() => ({ responseMode: 'sync' })),
    };
    const modelsAggregation = {};

    const controller = new OpenAIController(
      gateway as any,
      taskService as any,
      adapter as any,
      modelsAggregation as any,
    );

    await expect(
      controller.createChatCompletion({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(taskService.createPendingTask).toHaveBeenCalledTimes(1);
    expect(taskService.cancelTask).toHaveBeenCalledTimes(1);
  });

  test('OpenAI embeddings cancels pending task when no client is online', async () => {
    const gateway = { dispatchTask: jest.fn(() => false) };
    const taskService = { createPendingTask: jest.fn(() => ({ waitForResult: jest.fn() })), cancelTask: jest.fn() };
    const adapter = {
      toProxyTaskFromOpenAIEmbeddings: jest.fn(() => ({ responseMode: 'sync' })),
    };
    const modelsAggregation = {};

    const controller = new OpenAIController(
      gateway as any,
      taskService as any,
      adapter as any,
      modelsAggregation as any,
    );

    await expect(
      controller.createEmbedding({ model: 'text-embedding-3-small', input: 'hello world' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(taskService.createPendingTask).toHaveBeenCalledTimes(1);
    expect(taskService.cancelTask).toHaveBeenCalledTimes(1);
  });

  test('Claude sync cancels pending task when no client is online', async () => {
    const gateway = { dispatchTask: jest.fn(() => false) };
    const taskService = { createPendingTask: jest.fn(() => ({ waitForResult: jest.fn() })), cancelTask: jest.fn() };
    const adapter = {
      toProxyTaskFromClaudeMessages: jest.fn(() => ({ responseMode: 'sync' })),
    };

    const controller = new ClaudeController(gateway as any, taskService as any, adapter as any);

    await expect(
      controller.createMessage({ model: 'claude-3-5-sonnet-latest', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(taskService.createPendingTask).toHaveBeenCalledTimes(1);
    expect(taskService.cancelTask).toHaveBeenCalledTimes(1);
  });

  test('OpenAI chat sync maps client execution errors to BadGatewayException', async () => {
    const gateway = { dispatchTask: jest.fn(() => true) };
    const taskService = {
      createPendingTask: jest.fn(() => ({
        waitForResult: jest.fn(async () => {
          throw {
            code: 'client_execution_error',
            message: 'Local API request failed with status 400',
          };
        }),
      })),
      cancelTask: jest.fn(),
    };
    const adapter = {
      toProxyTaskFromOpenAIChat: jest.fn(() => ({ responseMode: 'sync' })),
    };
    const modelsAggregation = {};

    const controller = new OpenAIController(
      gateway as any,
      taskService as any,
      adapter as any,
      modelsAggregation as any,
    );

    await expect(
      controller.createChatCompletion({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
