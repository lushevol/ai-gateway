import { Body, Controller, Get, Post, ServiceUnavailableException } from '@nestjs/common';
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
  async createChatCompletion(@Body() body: any): Promise<any> {
    const taskId = uuidv4();
    const task = this.adapter.toProxyTaskFromOpenAIChat(taskId, body);
    const pending = this.taskService.createPendingTask(taskId, task.responseMode, 120000);

    if (!this.gateway.dispatchTask(task)) {
      throw new ServiceUnavailableException('No online websocket clients');
    }

    const completed = await pending.waitForResult();
    return this.adapter.toOpenAIChatResponse(taskId, body.model, completed.result as { content: string; usage?: Record<string, unknown> });
  }

  @Post('embeddings')
  async createEmbedding(@Body() body: any): Promise<any> {
    const taskId = uuidv4();
    const task = this.adapter.toProxyTaskFromOpenAIEmbeddings(taskId, body);
    const pending = this.taskService.createPendingTask(taskId, 'sync', 120000);

    if (!this.gateway.dispatchTask(task)) {
      throw new ServiceUnavailableException('No online websocket clients');
    }

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
