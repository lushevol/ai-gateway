import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  Post,
  Res,
} from '@nestjs/common';
import { pipeUIMessageStreamToResponse } from 'ai';
import { Response } from 'express';
import { ChatService, type ChatRequestBody } from '../services/chat.service';

@Controller('api')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('chat')
  async chat(@Body() body: Partial<ChatRequestBody>, @Res() res: Response): Promise<void> {
    if (!Array.isArray(body.messages)) {
      throw new BadRequestException('messages must be an array');
    }

    let stream;
    try {
      stream = await this.chatService.createChatStream({
        messages: body.messages,
        model: body.model,
        system: body.system,
        temperature: body.temperature,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to create chat stream';
      throw new InternalServerErrorException(message);
    }

    pipeUIMessageStreamToResponse({
      response: res,
      stream,
    });
  }
}
