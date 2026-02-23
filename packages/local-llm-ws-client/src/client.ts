import { io, Socket } from 'socket.io-client';
import { LocalApiAdapter } from './local-api-adapter';
import { logger } from './logger';
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
      logger.info('gateway_connected', {
        gatewayWsUrl: this.options.gatewayWsUrl,
        namespace: this.options.gatewayNamespace ?? '/llm-proxy',
      });
      this.socket.emit('client:register', {
        clientName: this.options.clientName ?? 'local-client',
        version: this.options.version ?? '0.1.0',
        localBaseUrl: this.options.localLlmBaseUrl,
        capabilities: ['openai.chat', 'openai.embeddings', 'openai.models', 'claude.messages'],
      });
      logger.info('client_register_sent', {
        clientName: this.options.clientName ?? 'local-client',
        version: this.options.version ?? '0.1.0',
      });

      this.startHeartbeat();
    });

    this.socket.on('disconnect', () => {
      logger.warn('gateway_disconnected');
      this.stopHeartbeat();
    });

    this.socket.on('connect_error', (error: unknown) => {
      logger.warn('gateway_connect_error', {
        message: error instanceof Error ? error.message : String(error),
      });
    });

    this.socket.on('reconnect_attempt', (attempt: number) => {
      logger.info('gateway_reconnect_attempt', { attempt });
    });

    this.socket.on('reconnect', (attempt: number) => {
      logger.info('gateway_reconnected', { attempt });
    });

    this.socket.on('reconnect_failed', () => {
      logger.error('gateway_reconnect_failed');
    });

    this.socket.on('task:create', async (task: TaskCreatePayload) => {
      logger.info('task_received', {
        taskId: task.taskId,
        taskType: task.taskType,
        responseMode: task.responseMode,
      });
      try {
        if (task.responseMode === 'stream') {
          logger.info('task_stream_start', { taskId: task.taskId, taskType: task.taskType });
          let chunkIndex = 0;
          const finalResult = await this.adapter.executeStream(task, (chunk) => {
            this.socket.emit('task:chunk', {
              taskId: task.taskId,
              chunkIndex,
              chunk,
            });
            logger.debug('task_stream_chunk_sent', {
              taskId: task.taskId,
              chunkIndex,
            });
            chunkIndex += 1;
          });

          this.socket.emit('task:complete', {
            taskId: task.taskId,
            result: finalResult,
          });
          logger.info('task_stream_complete', {
            taskId: task.taskId,
            totalChunks: chunkIndex,
          });
          return;
        }

        const result = await this.adapter.executeSync(task);
        this.socket.emit('task:complete', {
          taskId: task.taskId,
          result,
        });
        logger.info('task_sync_complete', { taskId: task.taskId, taskType: task.taskType });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.socket.emit('task:error', {
          taskId: task.taskId,
          code: 'client_execution_error',
          message,
          retriable: false,
        });
        logger.error('task_failed', {
          taskId: task.taskId,
          taskType: task.taskType,
          message,
        });
      }
    });

    this.socket.on('models:request', async (payload: { requestId: string }) => {
      logger.info('models_request_received', { requestId: payload.requestId });
      try {
        const models = await this.adapter.fetchModels();
        this.socket.emit('models:response', {
          requestId: payload.requestId,
          models,
        });
        logger.info('models_response_sent', { requestId: payload.requestId, modelCount: models.length });
      } catch {
        this.socket.emit('models:response', {
          requestId: payload.requestId,
          models: [],
        });
        logger.warn('models_response_failed', { requestId: payload.requestId });
      }
    });
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    const interval = this.options.heartbeatIntervalMs ?? 30000;
    logger.info('heartbeat_started', { intervalMs: interval });
    this.heartbeatTimer = setInterval(() => {
      this.socket.emit('client:heartbeat', { ts: Date.now() });
      logger.debug('heartbeat_sent');
    }, interval);
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatTimer) {
      return;
    }

    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
    logger.info('heartbeat_stopped');
  }
}
