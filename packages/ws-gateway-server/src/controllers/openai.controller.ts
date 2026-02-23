import {
  BadGatewayException,
  Body,
  Controller,
  Get,
  Post,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ProxyGateway } from '../gateways/proxy.gateway';
import { ModelsAggregationService } from '../services/models-aggregation.service';
import { ProviderAdapterService } from '../services/provider-adapter.service';
import { ProxyTaskService } from '../services/proxy-task.service';

@Controller('v1')
export class OpenAIController {
  constructor(
    private readonly gateway: ProxyGateway,
    private readonly taskService: ProxyTaskService,
    private readonly adapter: ProviderAdapterService,
    private readonly modelsAggregation: ModelsAggregationService,
  ) {}

  @Post('chat/completions')
  async createChatCompletion(@Body() body: any, @Res({ passthrough: true }) res?: any): Promise<any> {
    const taskId = uuidv4();
    const task = this.adapter.toProxyTaskFromOpenAIChat(taskId, body);

    if (task.responseMode === 'stream' && res) {
      const pending = this.taskService.createPendingTask(taskId, 'stream', 120000);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const unsubscribe = pending.onChunk((chunk) => {
        const payload = chunk.chunk as { delta?: string; index?: number; finish_reason?: string | null };
        res.write(this.adapter.toOpenAISseFrame(taskId, body.model, payload));
      });

      if (!this.gateway.dispatchTask(task)) {
        unsubscribe();
        this.taskService.cancelTask(taskId);
        throw new ServiceUnavailableException('No online websocket clients');
      }

      try {
        await pending.waitForResult();
        res.write(this.adapter.openAIDoneFrame());
      } catch (error) {
        throw this.mapTaskError(error);
      } finally {
        unsubscribe();
        res.end();
      }

      return;
    }

    const pending = this.taskService.createPendingTask(taskId, 'sync', 120000);
    if (!this.gateway.dispatchTask(task)) {
      this.taskService.cancelTask(taskId);
      throw new ServiceUnavailableException('No online websocket clients');
    }

    let completed;
    try {
      completed = await pending.waitForResult();
    } catch (error) {
      throw this.mapTaskError(error);
    }

    return this.adapter.toOpenAIChatResponse(taskId, body.model, completed.result as { content: string; usage?: Record<string, unknown> });
  }

  @Post('embeddings')
  async createEmbedding(@Body() body: any): Promise<any> {
    const taskId = uuidv4();
    const task = this.adapter.toProxyTaskFromOpenAIEmbeddings(taskId, body);

    const pending = this.taskService.createPendingTask(taskId, 'sync', 120000);
    if (!this.gateway.dispatchTask(task)) {
      this.taskService.cancelTask(taskId);
      throw new ServiceUnavailableException('No online websocket clients');
    }

    let completed;
    try {
      completed = await pending.waitForResult();
    } catch (error) {
      throw this.mapTaskError(error);
    }

    return this.adapter.toOpenAIEmbeddingResponse(body.model, completed.result as { embeddings: number[][]; usage?: { prompt_tokens?: number; total_tokens?: number } });
  }

  @Get('models')
  async listModels(): Promise<any> {
    const requestId = uuidv4();
    const expected = this.gateway.requestModelsFromAll(requestId);
    if (expected === 0) {
      return this.adapter.toOpenAIModelsResponse([]);
    }

    const models = await this.modelsAggregation.waitForResponses(requestId, expected, 2000);
    return this.adapter.toOpenAIModelsResponse(models);
  }

  private mapTaskError(error: unknown): Error {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code?: string }).code;
      const message = (error as { message?: string }).message ?? 'Local websocket client error';
      if (code === 'gateway_timeout') {
        return new ServiceUnavailableException(message);
      }
      return new BadGatewayException(message);
    }

    if (error instanceof Error) {
      return error;
    }

    return new BadGatewayException('Local websocket client error');
  }
}
