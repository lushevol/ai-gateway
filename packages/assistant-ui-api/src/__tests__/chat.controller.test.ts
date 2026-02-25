import { BadRequestException } from '@nestjs/common';
import { pipeUIMessageStreamToResponse } from 'ai';
import { ChatController } from '../controllers/chat.controller';
import { ChatService } from '../services/chat.service';

jest.mock('ai', () => ({
  pipeUIMessageStreamToResponse: jest.fn(),
}));

describe('ChatController', () => {
  it('throws BadRequestException when messages is missing', async () => {
    const service = {
      createChatStream: jest.fn(),
    } as unknown as ChatService;
    const controller = new ChatController(service);

    await expect(controller.chat({} as never, {} as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(service.createChatStream).not.toHaveBeenCalled();
  });

  it('calls service and pipes ui stream to response', async () => {
    const uiStream = { kind: 'ui-stream' };
    const service = {
      createChatStream: jest.fn().mockResolvedValue(uiStream),
    } as unknown as ChatService;
    const controller = new ChatController(service);
    const response = { setHeader: jest.fn() };
    const body = {
      messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
      model: 'gpt-4o-mini',
      system: 'System',
      temperature: 0.2,
    };

    await controller.chat(body as never, response as never);

    expect(service.createChatStream).toHaveBeenCalledWith(body);
    expect(pipeUIMessageStreamToResponse).toHaveBeenCalledWith({
      response,
      stream: uiStream,
    });
  });
});
