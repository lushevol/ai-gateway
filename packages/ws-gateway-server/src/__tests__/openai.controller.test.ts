import { ServiceUnavailableException } from '@nestjs/common';
import { OpenAIController } from '../controllers/openai.controller';

describe('OpenAIController', () => {
  test('does not create pending task when no client socket is available', async () => {
    const gateway = {
      selectNextClientSocketId: jest.fn(() => null),
      emitTaskToClient: jest.fn(),
      requestModelsFromAll: jest.fn(),
    };

    const taskService = {
      createPendingTask: jest.fn(),
    };

    const adapter = {
      toProxyTaskFromOpenAIChat: jest.fn(() => ({ taskId: 't1', responseMode: 'sync' })),
      toOpenAIChatResponse: jest.fn(),
      toProxyTaskFromOpenAIEmbeddings: jest.fn(),
      toOpenAIEmbeddingResponse: jest.fn(),
      toOpenAIModelsResponse: jest.fn(),
      toOpenAISseFrame: jest.fn(),
      openAIDoneFrame: jest.fn(),
      toOpenAIErrorSseFrame: jest.fn(),
    };

    const modelsAggregation = {
      waitForResponses: jest.fn(),
    };

    const controller = new OpenAIController(
      gateway as any,
      taskService as any,
      adapter as any,
      modelsAggregation as any,
    );

    await expect(
      controller.createChatCompletion({ model: 'gpt-4o-mini', messages: [], stream: false }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(taskService.createPendingTask).not.toHaveBeenCalled();
  });
});
