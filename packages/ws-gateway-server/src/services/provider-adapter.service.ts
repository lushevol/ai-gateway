import { Injectable } from '@nestjs/common';
import { ModelDescriptor, TaskCreatePayload } from '../types/proxy-protocol';

type OpenAIMessage = { role: string; content: string };

type OpenAIChatRequest = {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  [key: string]: unknown;
};

type OpenAIEmbeddingsRequest = {
  model: string;
  input: string | string[];
  [key: string]: unknown;
};

type ClaudeMessageRequest = {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  [key: string]: unknown;
};

@Injectable()
export class ProviderAdapterService {
  toProxyTaskFromOpenAIChat(taskId: string, body: OpenAIChatRequest): TaskCreatePayload {
    return {
      taskId,
      provider: 'openai',
      taskType: 'openai.chat',
      responseMode: body.stream ? 'stream' : 'sync',
      request: body,
    };
  }

  toProxyTaskFromOpenAIEmbeddings(taskId: string, body: OpenAIEmbeddingsRequest): TaskCreatePayload {
    return {
      taskId,
      provider: 'openai',
      taskType: 'openai.embeddings',
      responseMode: 'sync',
      request: body,
    };
  }

  toProxyTaskFromClaudeMessages(taskId: string, body: ClaudeMessageRequest): TaskCreatePayload {
    return {
      taskId,
      provider: 'claude',
      taskType: 'claude.messages',
      responseMode: body.stream ? 'stream' : 'sync',
      request: body,
    };
  }

  toOpenAIChatResponse(taskId: string, model: string, result: { content: string; usage?: Record<string, unknown> }) {
    return {
      id: taskId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.content,
            refusal: null,
          },
          finish_reason: 'stop',
          logprobs: null,
        },
      ],
      usage: result.usage,
    };
  }

  toOpenAISseFrame(taskId: string, model: string, chunk: { delta?: string; index?: number; finish_reason?: string | null }): string {
    const payload = {
      id: taskId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: chunk.index ?? 0,
          delta: {
            content: chunk.delta ?? '',
          },
          finish_reason: chunk.finish_reason ?? null,
        },
      ],
    };

    return `data: ${JSON.stringify(payload)}\n\n`;
  }

  openAIDoneFrame(): string {
    return 'data: [DONE]\n\n';
  }

  toOpenAIErrorSseFrame(message: string): string {
    return `data: ${JSON.stringify({
      error: {
        message,
        type: 'server_error',
        code: 'proxy_error',
      },
    })}\n\n`;
  }

  toClaudeMessagesResponse(taskId: string, model: string, result: { content: string; usage?: Record<string, unknown> }) {
    return {
      id: taskId,
      type: 'message',
      role: 'assistant',
      model,
      content: [{ type: 'text', text: result.content }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: result.usage,
    };
  }

  toClaudeSseFrame(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  toClaudeErrorSseFrame(message: string): string {
    return this.toClaudeSseFrame('error', {
      type: 'error',
      error: {
        type: 'api_error',
        message,
      },
    });
  }

  toOpenAIEmbeddingResponse(model: string, result: { embeddings: number[][]; usage?: { prompt_tokens?: number; total_tokens?: number } }) {
    return {
      object: 'list',
      data: result.embeddings.map((embedding, index) => ({
        object: 'embedding',
        embedding,
        index,
      })),
      model,
      usage: {
        prompt_tokens: result.usage?.prompt_tokens ?? 0,
        total_tokens: result.usage?.total_tokens ?? 0,
      },
    };
  }

  toOpenAIModelsResponse(models: ModelDescriptor[]) {
    return {
      object: 'list',
      data: models.map((item) => ({
        id: item.id,
        object: 'model',
        created: 0,
        owned_by: item.owned_by ?? 'local',
      })),
    };
  }
}
