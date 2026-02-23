import { Injectable, Logger } from '@nestjs/common';
import { TaskChunkPayload, TaskCompletePayload, TaskErrorPayload } from '../types/proxy-protocol';

export type ResponseMode = 'sync' | 'stream';

interface PendingTaskInternal {
  mode: ResponseMode;
  expectedSocketId: string;
  timeout: NodeJS.Timeout;
  resolve: (payload: TaskCompletePayload) => void;
  reject: (error: TaskErrorPayload) => void;
  chunkListeners: Array<(chunk: TaskChunkPayload) => void>;
  done: boolean;
}

export interface PendingTaskHandle {
  waitForResult: () => Promise<TaskCompletePayload>;
  onChunk: (listener: (chunk: TaskChunkPayload) => void) => () => void;
}

@Injectable()
export class ProxyTaskService {
  private readonly logger = new Logger(ProxyTaskService.name);
  private readonly pending = new Map<string, PendingTaskInternal>();

  createPendingTask(taskId: string, mode: ResponseMode, timeoutMs: number, expectedSocketId: string): PendingTaskHandle {
    let resolveFn!: (payload: TaskCompletePayload) => void;
    let rejectFn!: (error: TaskErrorPayload) => void;

    const promise = new Promise<TaskCompletePayload>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });

    const timeout = setTimeout(() => {
      const state = this.pending.get(taskId);
      if (!state || state.done) {
        return;
      }

      state.done = true;
      this.pending.delete(taskId);
      this.logger.warn(`task_timeout taskId=${taskId} expectedSocketId=${state.expectedSocketId}`);
      state.reject({
        taskId,
        code: 'gateway_timeout',
        message: `Task ${taskId} timed out`,
        retriable: true,
      });
    }, timeoutMs);

    this.pending.set(taskId, {
      mode,
      expectedSocketId,
      timeout,
      resolve: resolveFn,
      reject: rejectFn,
      chunkListeners: [],
      done: false,
    });

    this.logger.log(`task_pending_created taskId=${taskId} mode=${mode} expectedSocketId=${expectedSocketId} timeoutMs=${timeoutMs}`);

    return {
      waitForResult: () => promise,
      onChunk: (listener: (chunk: TaskChunkPayload) => void) => {
        const state = this.pending.get(taskId);
        if (!state) {
          return () => undefined;
        }

        state.chunkListeners.push(listener);
        return () => {
          const current = this.pending.get(taskId);
          if (!current) {
            return;
          }

          current.chunkListeners = current.chunkListeners.filter((item) => item !== listener);
        };
      },
    };
  }

  resolveTask(taskId: string, sourceSocketId: string, payload: TaskCompletePayload): void {
    const state = this.pending.get(taskId);
    if (!state || state.done || state.expectedSocketId !== sourceSocketId) {
      this.logger.warn(`task_complete_ignored taskId=${taskId} sourceSocketId=${sourceSocketId}`);
      return;
    }

    state.done = true;
    clearTimeout(state.timeout);
    this.pending.delete(taskId);
    this.logger.log(`task_pending_resolved taskId=${taskId} sourceSocketId=${sourceSocketId}`);
    state.resolve(payload);
  }

  rejectTask(taskId: string, sourceSocketId: string, error: TaskErrorPayload): void {
    const state = this.pending.get(taskId);
    if (!state || state.done || state.expectedSocketId !== sourceSocketId) {
      this.logger.warn(`task_error_ignored taskId=${taskId} sourceSocketId=${sourceSocketId} code=${error.code}`);
      return;
    }

    state.done = true;
    clearTimeout(state.timeout);
    this.pending.delete(taskId);
    this.logger.warn(`task_pending_rejected taskId=${taskId} sourceSocketId=${sourceSocketId} code=${error.code}`);
    state.reject(error);
  }

  appendChunk(taskId: string, sourceSocketId: string, chunk: TaskChunkPayload): void {
    const state = this.pending.get(taskId);
    if (!state || state.done || state.mode !== 'stream' || state.expectedSocketId !== sourceSocketId) {
      this.logger.debug(`task_chunk_ignored taskId=${taskId} sourceSocketId=${sourceSocketId}`);
      return;
    }

    this.logger.debug(`task_chunk_forwarded taskId=${taskId} sourceSocketId=${sourceSocketId} chunkIndex=${chunk.chunkIndex}`);
    for (const listener of state.chunkListeners) {
      listener(chunk);
    }
  }

  cancelPendingTask(taskId: string): void {
    const state = this.pending.get(taskId);
    if (!state || state.done) {
      this.logger.warn(`task_cancel_ignored taskId=${taskId}`);
      return;
    }

    state.done = true;
    clearTimeout(state.timeout);
    this.pending.delete(taskId);
    this.logger.warn(`task_pending_cancelled taskId=${taskId} expectedSocketId=${state.expectedSocketId}`);
    state.reject({
      taskId,
      code: 'gateway_dispatch_failed',
      message: `Task ${taskId} could not be dispatched`,
      retriable: true,
    });
  }
}
