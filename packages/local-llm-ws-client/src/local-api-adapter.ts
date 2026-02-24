import { ClientOptions, ModelDescriptor, TaskCreatePayload } from './types';
import { logger } from './logger';

type FetchLike = typeof fetch;

export class LocalApiAdapter {
  constructor(
    private readonly options: ClientOptions,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  get baseUrl(): string {
    return this.options.localLlmBaseUrl;
  }

  async executeSync(task: Pick<TaskCreatePayload, 'taskType' | 'request'>): Promise<any> {
    const response = await this.fetchWithRetry(
      this.resolvePath(task.taskType),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(task.request),
      },
      'Local API request',
    );

    if (!response.ok) {
      throw new Error(`Local API request failed with status ${response.status}`);
    }

    const json = await response.json();

    if (task.taskType === 'openai.chat') {
      const firstChoice = json.choices?.[0];
      return {
        content: firstChoice?.message?.content ?? '',
        tool_calls: firstChoice?.message?.tool_calls ?? [],
        usage: json.usage,
      };
    }

    if (task.taskType === 'claude.messages') {
      const content = Array.isArray(json.content) ? json.content.map((item: any) => item.text ?? '').join('') : '';
      return {
        content,
        usage: json.usage,
      };
    }

    if (task.taskType === 'openai.embeddings') {
      return {
        embeddings: (json.data ?? []).map((item: any) => item.embedding),
        usage: json.usage,
      };
    }

    return json;
  }

  async executeStream(
    task: Pick<TaskCreatePayload, 'taskType' | 'request'>,
    onChunk: (chunk: any) => void,
  ): Promise<any> {
    const response = await this.fetchWithRetry(
      this.resolvePath(task.taskType),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(task.request),
      },
      'Local API stream request',
    );

    if (!response.ok || !response.body) {
      throw new Error(`Local API stream request failed with status ${response.status}`);
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = '';
    let currentEvent = 'message';

    while (true) {
      const next = await reader.read();
      if (next.done) {
        break;
      }

      buffer += decoder.decode(next.value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const lines = part.split('\n');
        const dataLines: string[] = [];

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) {
            continue;
          }

          if (line.startsWith('event:')) {
            currentEvent = line.replace('event:', '').trim();
            continue;
          }

          if (line.startsWith('data:')) {
            dataLines.push(line.replace('data:', '').trim());
          }
        }

        if (dataLines.length === 0) {
          continue;
        }

        const rawData = dataLines.join('\n');
        if (rawData === '[DONE]') {
          continue;
        }

        try {
          const parsed = JSON.parse(rawData);
          if (task.taskType === 'openai.chat') {
            const choice = parsed.choices?.[0];
            onChunk({
              delta: choice?.delta?.content ?? '',
              tool_calls: choice?.delta?.tool_calls,
              index: choice?.index ?? 0,
              finish_reason: choice?.finish_reason ?? null,
            });
          } else {
            onChunk({ event: currentEvent, data: parsed });
          }
        } catch {
          if (task.taskType !== 'openai.chat') {
            onChunk({ event: currentEvent, data: rawData });
          } else {
            continue;
          }
        }
      }
    }

    return { content: '' };
  }

  async fetchModels(): Promise<ModelDescriptor[]> {
    const response = await this.fetchWithRetry(`${this.baseUrl}/v1/models`, undefined, 'Local models request');
    if (!response.ok) {
      throw new Error(`Local models request failed with status ${response.status}`);
    }

    const json = await response.json();
    return (json.data ?? []).map((item: any) => ({
      id: item.id,
      owned_by: item.owned_by,
    }));
  }

  private resolvePath(taskType: string): string {
    if (taskType === 'openai.chat') {
      return `${this.baseUrl}/v1/chat/completions`;
    }

    if (taskType === 'openai.embeddings') {
      return `${this.baseUrl}/v1/embeddings`;
    }

    if (taskType === 'claude.messages') {
      return `${this.baseUrl}/v1/messages`;
    }

    throw new Error(`Unsupported task type: ${taskType}`);
  }

  private async fetchWithRetry(url: string, init?: RequestInit, operation = 'Local API request'): Promise<Response> {
    const maxRetries = this.options.localApiMaxRetries ?? 2;
    const baseDelayMs = this.options.localApiRetryBaseDelayMs ?? 250;
    const maxDelayMs = this.options.localApiRetryMaxDelayMs ?? 2000;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await this.fetchImpl(url, init);
        if (response.ok) {
          if (attempt > 0) {
            logger.info('local_api_retry_recovered', {
              operation,
              url,
              attempt,
            });
          }
          return response;
        }

        if (!this.shouldRetryStatus(response.status) || attempt === maxRetries) {
          logger.warn('local_api_request_terminal_status', {
            operation,
            url,
            status: response.status,
            attempt,
            maxRetries,
          });
          return response;
        }

        lastError = new Error(`${operation} failed with status ${response.status}`);
        logger.warn('local_api_retry_scheduled', {
          operation,
          url,
          status: response.status,
          attempt,
          nextAttempt: attempt + 1,
        });
      } catch (error) {
        if (attempt === maxRetries) {
          logger.error('local_api_request_failed', {
            operation,
            url,
            attempt,
            message: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }

        lastError = error;
        logger.warn('local_api_retry_scheduled', {
          operation,
          url,
          attempt,
          nextAttempt: attempt + 1,
          message: error instanceof Error ? error.message : String(error),
        });
      }

      await this.sleep(Math.min(maxDelayMs, baseDelayMs * 2 ** attempt));
    }

    throw lastError instanceof Error ? lastError : new Error(`${operation} failed`);
  }

  private shouldRetryStatus(status: number): boolean {
    return status === 429 || status >= 500;
  }

  private async sleep(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
