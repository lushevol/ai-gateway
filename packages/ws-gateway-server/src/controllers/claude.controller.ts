import { Body, Controller, Post, Res, ServiceUnavailableException } from '@nestjs/common';
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
        throw new ServiceUnavailableException('No online websocket clients');
      }

      try {
        await pending.waitForResult();
        res.write(this.adapter.toClaudeSseFrame('message_stop', { type: 'message_stop' }));
      } finally {
        unsubscribe();
        res.end();
      }

      return;
    }

    const pending = this.taskService.createPendingTask(taskId, 'sync', 120000);
    if (!this.gateway.dispatchTask(task)) {
      throw new ServiceUnavailableException('No online websocket clients');
    }

    const completed = await pending.waitForResult();
    return this.adapter.toClaudeMessagesResponse(taskId, body.model, completed.result as { content: string; usage?: Record<string, unknown> });
  }
}
