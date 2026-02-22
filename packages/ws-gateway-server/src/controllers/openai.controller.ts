import { Body, Controller, Get, Post, Res, ServiceUnavailableException } from '@nestjs/common';
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
    const socketId = this.gateway.selectNextClientSocketId();
    if (!socketId) {
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

      try {
        await pending.waitForResult();
        res.write(this.adapter.openAIDoneFrame());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.write(this.adapter.toOpenAIErrorSseFrame(message));
      } finally {
        unsubscribe();
        res.end();
      }

      return;
    }

    const pending = this.taskService.createPendingTask(taskId, 'sync', 120000, socketId);
    this.gateway.emitTaskToClient(socketId, task);

    const completed = await pending.waitForResult();
    return this.adapter.toOpenAIChatResponse(taskId, body.model, completed.result as { content: string; usage?: Record<string, unknown> });
  }

  @Post('embeddings')
  async createEmbedding(@Body() body: any): Promise<any> {
    const taskId = uuidv4();
    const task = this.adapter.toProxyTaskFromOpenAIEmbeddings(taskId, body);
    const socketId = this.gateway.selectNextClientSocketId();
    if (!socketId) {
      throw new ServiceUnavailableException('No online websocket clients');
    }

    const pending = this.taskService.createPendingTask(taskId, 'sync', 120000, socketId);
    this.gateway.emitTaskToClient(socketId, task);

    const completed = await pending.waitForResult();
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
}
