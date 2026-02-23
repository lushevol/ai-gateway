import { BadGatewayException, Body, Controller, Post, Res, ServiceUnavailableException, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ProxyGateway } from '../gateways/proxy.gateway';
import { ProviderAdapterService } from '../services/provider-adapter.service';
import { ProxyTaskService } from '../services/proxy-task.service';

@Controller('v1')
export class ClaudeController {
  private readonly logger = new Logger(ClaudeController.name);

  constructor(
    private readonly gateway: ProxyGateway,
    private readonly taskService: ProxyTaskService,
    private readonly adapter: ProviderAdapterService,
  ) {}

  @Post('messages')
  async createMessage(@Body() body: any, @Res({ passthrough: true }) res?: any): Promise<any> {
    const taskId = uuidv4();
    const task = this.adapter.toProxyTaskFromClaudeMessages(taskId, body);
    this.logger.log(`claude_request_received taskId=${taskId} model=${body.model} stream=${Boolean(body.stream)}`);
    const socketId = this.gateway.selectNextClientSocketId();
    if (!socketId) {
      this.logger.warn(`claude_request_rejected_no_clients taskId=${taskId}`);
      throw new ServiceUnavailableException('No online websocket clients');
    }

    if (task.responseMode === 'stream' && res) {
      const pending = this.taskService.createPendingTask(taskId, 'stream', 120000, socketId);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const unsubscribe = pending.onChunk((chunk) => {
        const payload = chunk.chunk as { event?: string; data?: unknown };
        res.write(this.adapter.toClaudeSseFrame(payload.event ?? 'content_block_delta', payload.data ?? payload));
      });

      this.gateway.emitTaskToClient(socketId, task);
      this.logger.log(`claude_stream_dispatched taskId=${taskId} socketId=${socketId}`);

      try {
        await pending.waitForResult();
        res.write(this.adapter.toClaudeSseFrame('message_stop', { type: 'message_stop' }));
        this.logger.log(`claude_stream_completed taskId=${taskId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`claude_stream_error taskId=${taskId} message=${message}`);
        res.write(this.adapter.toClaudeErrorSseFrame(message));
      } finally {
        unsubscribe();
        res.end();
      }

      return;
    }

    const pending = this.taskService.createPendingTask(taskId, 'sync', 120000, socketId);
    this.gateway.emitTaskToClient(socketId, task);
    this.logger.log(`claude_sync_dispatched taskId=${taskId} socketId=${socketId}`);

    let completed;
    try {
      completed = await pending.waitForResult();
      this.logger.log(`claude_sync_completed taskId=${taskId}`);
    } catch (error) {
      this.logger.warn(`claude_sync_failed taskId=${taskId}`);
      throw this.mapTaskError(error);
    }

    return this.adapter.toClaudeMessagesResponse(taskId, body.model, completed.result as { content: string; usage?: Record<string, unknown> });
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
