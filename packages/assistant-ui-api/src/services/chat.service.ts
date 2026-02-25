import { Injectable } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from 'ai';
import { z } from 'zod';

export type ChatRequestBody = {
  messages: UIMessage[];
  model?: string;
  system?: string;
  temperature?: number;
};

@Injectable()
export class ChatService {
  private readonly provider = createOpenAI({
    baseURL: process.env.COPILOT_API_BASE_URL ?? 'http://127.0.0.1:4141/v1',
    apiKey: process.env.COPILOT_API_KEY ?? 'dummy',
  });

  async createChatStream(body: ChatRequestBody) {
    const model = body.model ?? 'gpt-4o-mini';

    const result = streamText({
      model: this.provider.chat(model),
      system: body.system,
      messages: convertToModelMessages(body.messages),
      temperature: body.temperature,
      stopWhen: stepCountIs(2),
      tools: {
        getCurrentTime: tool({
          name: 'getCurrentTime',
          description: 'Get the current ISO timestamp.',
          inputSchema: z.object({}),
          execute: async () => ({ now: new Date().toISOString() }),
        }),
      },
    });

    return result.toUIMessageStream();
  }
}
