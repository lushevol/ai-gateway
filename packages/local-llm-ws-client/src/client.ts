import { io, Socket } from 'socket.io-client';
import { LocalApiAdapter } from './local-api-adapter';
import { ClientOptions, SocketLike, TaskCreatePayload } from './types';

export class LocalLlmWsClient {
  private readonly socket: SocketLike;
  private readonly adapter: LocalApiAdapter;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    private readonly options: ClientOptions,
    socket?: SocketLike,
    adapter?: LocalApiAdapter,
  ) {
    this.socket =
      socket ??
      (io(`${options.gatewayWsUrl}${options.gatewayNamespace ?? '/llm-proxy'}`, {
        reconnection: true,
        reconnectionAttempts: options.reconnectAttempts ?? Infinity,
        reconnectionDelay: options.reconnectDelayMs ?? 1000,
        reconnectionDelayMax: options.reconnectDelayMaxMs ?? 10000,
        timeout: options.connectionTimeoutMs ?? 20000,
      }) as unknown as Socket);
    this.adapter = adapter ?? new LocalApiAdapter(options);
  }

  start(): void {
    this.socket.on('connect', () => {
      this.socket.emit('client:register', {
        clientName: this.options.clientName ?? 'local-client',
        version: this.options.version ?? '0.1.0',
        localBaseUrl: this.options.localLlmBaseUrl,
        capabilities: ['openai.chat', 'openai.embeddings', 'openai.models', 'claude.messages'],
      });

      this.startHeartbeat();
    });

    this.socket.on('disconnect', () => {
      this.stopHeartbeat();
    });

    this.socket.on('task:create', async (task: TaskCreatePayload) => {
      try {
        if (task.responseMode === 'stream') {
          let chunkIndex = 0;
          const finalResult = await this.adapter.executeStream(task, (chunk) => {
            this.socket.emit('task:chunk', {
              taskId: task.taskId,
              chunkIndex,
              chunk,
            });
            chunkIndex += 1;
          });

          this.socket.emit('task:complete', {
            taskId: task.taskId,
            result: finalResult,
          });
          return;
        }

        const result = await this.adapter.executeSync(task);
        this.socket.emit('task:complete', {
          taskId: task.taskId,
          result,
        });
      } catch (error) {
        this.socket.emit('task:error', {
          taskId: task.taskId,
          code: 'client_execution_error',
          message: error instanceof Error ? error.message : String(error),
          retriable: false,
        });
      }
    });

    this.socket.on('models:request', async (payload: { requestId: string }) => {
      try {
        const models = await this.adapter.fetchModels();
        this.socket.emit('models:response', {
          requestId: payload.requestId,
          models,
        });
      } catch {
        this.socket.emit('models:response', {
          requestId: payload.requestId,
          models: [],
        });
      }
    });
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    const interval = this.options.heartbeatIntervalMs ?? 30000;
    this.heartbeatTimer = setInterval(() => {
      this.socket.emit('client:heartbeat', { ts: Date.now() });
    }, interval);
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatTimer) {
      return;
    }

    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
  }
}
