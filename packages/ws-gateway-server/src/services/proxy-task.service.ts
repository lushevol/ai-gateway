import { Injectable } from '@nestjs/common';
import { TaskChunkPayload, TaskCompletePayload, TaskErrorPayload } from '../types/proxy-protocol';

export type ResponseMode = 'sync' | 'stream';

interface PendingTaskInternal {
  mode: ResponseMode;
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
  private readonly pending = new Map<string, PendingTaskInternal>();

  createPendingTask(taskId: string, mode: ResponseMode, timeoutMs: number): PendingTaskHandle {
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
      state.reject({
        taskId,
        code: 'gateway_timeout',
        message: `Task ${taskId} timed out`,
        retriable: true,
      });
    }, timeoutMs);

    this.pending.set(taskId, {
      mode,
      timeout,
      resolve: resolveFn,
      reject: rejectFn,
      chunkListeners: [],
      done: false,
    });

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

  resolveTask(taskId: string, payload: TaskCompletePayload): void {
    const state = this.pending.get(taskId);
    if (!state || state.done) {
      return;
    }

    state.done = true;
    clearTimeout(state.timeout);
    this.pending.delete(taskId);
    state.resolve(payload);
  }

  rejectTask(taskId: string, error: TaskErrorPayload): void {
    const state = this.pending.get(taskId);
    if (!state || state.done) {
      return;
    }

    state.done = true;
    clearTimeout(state.timeout);
    this.pending.delete(taskId);
    state.reject(error);
  }

  appendChunk(taskId: string, chunk: TaskChunkPayload): void {
    const state = this.pending.get(taskId);
    if (!state || state.done || state.mode !== 'stream') {
      return;
    }

    for (const listener of state.chunkListeners) {
      listener(chunk);
    }
  }

  cancelTask(taskId: string): void {
    const state = this.pending.get(taskId);
    if (!state || state.done) {
      return;
    }

    state.done = true;
    clearTimeout(state.timeout);
    this.pending.delete(taskId);
  }
}
