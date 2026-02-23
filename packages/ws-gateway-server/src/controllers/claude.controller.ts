import { BadGatewayException, Body, Controller, Post, Res, ServiceUnavailableException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ProxyGateway } from '../gateways/proxy.gateway';
import { ProviderAdapterService } from '../services/provider-adapter.service';
import { ProxyTaskService } from '../services/proxy-task.service';

@Controller('v1')
export class ClaudeController {
  constructor(
    private readonly gateway: ProxyGateway,
    private readonly taskService: ProxyTaskService,
    private readonly adapter: ProviderAdapterService,
  ) {}

  @Post('messages')
  async createMessage(@Body() body: any, @Res({ passthrough: true }) res?: any): Promise<any> {
    const taskId = uuidv4();
    const task = this.adapter.toProxyTaskFromClaudeMessages(taskId, body);

    if (task.responseMode === 'stream' && res) {
      const pending = this.taskService.createPendingTask(taskId, 'stream', 120000);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const unsubscribe = pending.onChunk((chunk) => {
        const payload = chunk.chunk as { event?: string; data?: unknown };
        res.write(this.adapter.toClaudeSseFrame(payload.event ?? 'content_block_delta', payload.data ?? payload));
      });

      if (!this.gateway.dispatchTask(task)) {
        unsubscribe();
        this.taskService.cancelTask(taskId);
        throw new ServiceUnavailableException('No online websocket clients');
      }

      try {
        await pending.waitForResult();
        res.write(this.adapter.toClaudeSseFrame('message_stop', { type: 'message_stop' }));
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

    return this.adapter.toClaudeMessagesResponse(taskId, body.model, completed.result as { content: string; usage?: Record<string, unknown> });
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
