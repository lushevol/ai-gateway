import {
  BadGatewayException,
  Body,
  Controller,
  Get,
  Post,
  Res,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ProxyGateway } from '../gateways/proxy.gateway';
import { ModelsAggregationService } from '../services/models-aggregation.service';
import { ProviderAdapterService } from '../services/provider-adapter.service';
import { ProxyTaskService } from '../services/proxy-task.service';

@Controller('v1')
export class OpenAIController {
  private readonly logger = new Logger(OpenAIController.name);

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
    this.logger.log(`chat_request_received taskId=${taskId} model=${body.model} stream=${Boolean(body.stream)}`);
    const socketId = this.gateway.selectNextClientSocketId();
    if (!socketId) {
      this.logger.warn(`chat_request_rejected_no_clients taskId=${taskId}`);
      throw new ServiceUnavailableException('No online websocket clients');
    }

    if (task.responseMode === 'stream' && res) {
      const pending = this.taskService.createPendingTask(taskId, 'stream', 120000, socketId);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const unsubscribe = pending.onChunk((chunk) => {
        const payload = chunk.chunk as { delta?: string; index?: number; finish_reason?: string | null };
        res.write(this.adapter.toOpenAISseFrame(taskId, body.model, payload));
      });

      this.gateway.emitTaskToClient(socketId, task);
      this.logger.log(`chat_stream_dispatched taskId=${taskId} socketId=${socketId}`);

      try {
        await pending.waitForResult();
        res.write(this.adapter.openAIDoneFrame());
        this.logger.log(`chat_stream_completed taskId=${taskId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`chat_stream_error taskId=${taskId} message=${message}`);
        res.write(this.adapter.toOpenAIErrorSseFrame(message));
      } finally {
        unsubscribe();
        res.end();
      }

      return;
    }

    const pending = this.taskService.createPendingTask(taskId, 'sync', 120000, socketId);
    this.gateway.emitTaskToClient(socketId, task);
    this.logger.log(`chat_sync_dispatched taskId=${taskId} socketId=${socketId}`);

    let completed;
    try {
      completed = await pending.waitForResult();
      this.logger.log(`chat_sync_completed taskId=${taskId}`);
    } catch (error) {
      this.logger.warn(`chat_sync_failed taskId=${taskId}`);
      throw this.mapTaskError(error);
    }

    return this.adapter.toOpenAIChatResponse(taskId, body.model, completed.result as { content: string; usage?: Record<string, unknown> });
  }

  @Post('embeddings')
  async createEmbedding(@Body() body: any): Promise<any> {
    const taskId = uuidv4();
    const task = this.adapter.toProxyTaskFromOpenAIEmbeddings(taskId, body);
    this.logger.log(`embeddings_request_received taskId=${taskId} model=${body.model}`);
    const socketId = this.gateway.selectNextClientSocketId();
    if (!socketId) {
      this.logger.warn(`embeddings_request_rejected_no_clients taskId=${taskId}`);
      throw new ServiceUnavailableException('No online websocket clients');
    }

    const pending = this.taskService.createPendingTask(taskId, 'sync', 120000, socketId);
    this.gateway.emitTaskToClient(socketId, task);
    this.logger.log(`embeddings_dispatched taskId=${taskId} socketId=${socketId}`);

    let completed;
    try {
      completed = await pending.waitForResult();
      this.logger.log(`embeddings_completed taskId=${taskId}`);
    } catch (error) {
      this.logger.warn(`embeddings_failed taskId=${taskId}`);
      throw this.mapTaskError(error);
    }

    return this.adapter.toOpenAIEmbeddingResponse(body.model, completed.result as { embeddings: number[][]; usage?: { prompt_tokens?: number; total_tokens?: number } });
  }

  @Get('models')
  async listModels(): Promise<any> {
    const requestId = uuidv4();
    const expected = this.gateway.requestModelsFromAll(requestId);
    this.logger.log(`models_request_received requestId=${requestId} expected=${expected}`);
    if (expected === 0) {
      this.logger.warn(`models_request_empty requestId=${requestId}`);
      return this.adapter.toOpenAIModelsResponse([]);
    }

    const models = await this.modelsAggregation.waitForResponses(requestId, expected, 2000);
    this.logger.log(`models_request_completed requestId=${requestId} modelCount=${models.length}`);
    return this.adapter.toOpenAIModelsResponse(models);
  }

  private mapTaskError(error: unknown): Error {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code?: string }).code;
      const message = (error as { message?: string }).message ?? 'Local websocket client error';
      if (code === 'gateway_timeout') {
        this.logger.warn(`task_error_mapped_service_unavailable code=${code} message=${message}`);
        return new ServiceUnavailableException(message);
      }
      this.logger.warn(`task_error_mapped_bad_gateway code=${code} message=${message}`);
      return new BadGatewayException(message);
    }

    if (error instanceof Error) {
      return error;
    }

    return new BadGatewayException('Local websocket client error');
  }
}
