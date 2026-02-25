import { createOpenAI } from '@ai-sdk/openai';
import { convertToModelMessages, stepCountIs, streamText } from 'ai';
import { ChatService } from '../services/chat.service';

jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(),
}));

jest.mock('ai', () => ({
  convertToModelMessages: jest.fn(),
  stepCountIs: jest.fn(),
  streamText: jest.fn(),
}));

describe('ChatService', () => {
  it('builds streamText call with converted messages, tools, and stopWhen', async () => {
    const providerModel = Symbol('provider-model');
    const provider = jest.fn().mockReturnValue(providerModel);
    const converted = [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }];
    const uiStream = { kind: 'ui-stream' };
    const stopPredicate = Symbol('stop-predicate');

    (createOpenAI as jest.Mock).mockReturnValue(provider);
    (convertToModelMessages as jest.Mock).mockReturnValue(converted);
    (stepCountIs as jest.Mock).mockReturnValue(stopPredicate);
    (streamText as jest.Mock).mockReturnValue({
      toUIMessageStream: jest.fn().mockReturnValue(uiStream),
    });

    const service = new ChatService();
    const inputMessages = [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }];

    const result = await service.createChatStream({
      messages: inputMessages,
      model: 'gpt-4o-mini',
      system: 'You are helpful',
      temperature: 0.3,
    });

    expect(createOpenAI).toHaveBeenCalledWith({
      baseURL: 'http://127.0.0.1:4141/v1',
      apiKey: 'dummy',
    });
    expect(convertToModelMessages).toHaveBeenCalledWith(inputMessages);
    expect(stepCountIs).toHaveBeenCalledWith(2);
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: providerModel,
        system: 'You are helpful',
        messages: converted,
        temperature: 0.3,
        stopWhen: stopPredicate,
        tools: expect.objectContaining({
          getCurrentTime: expect.any(Object),
        }),
      }),
    );
    expect(result).toBe(uiStream);
  });
});
