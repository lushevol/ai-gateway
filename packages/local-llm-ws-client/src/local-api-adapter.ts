import { ClientOptions, ModelDescriptor, TaskCreatePayload } from './types';

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
    const response = await this.fetchImpl(this.resolvePath(task.taskType), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(task.request),
    });

    if (!response.ok) {
      throw new Error(`Local API request failed with status ${response.status}`);
    }

    const json = await response.json();

    if (task.taskType === 'openai.chat') {
      return {
        content: json.choices?.[0]?.message?.content ?? '',
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
    const response = await this.fetchImpl(this.resolvePath(task.taskType), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(task.request),
    });

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
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const lines = part.split('\n');
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) {
            continue;
          }

          if (line.startsWith('event:')) {
            currentEvent = line.replace('event:', '').trim();
            continue;
          }

          if (!line.startsWith('data:')) {
            continue;
          }

          const rawData = line.replace('data:', '').trim();
          if (rawData === '[DONE]') {
            continue;
          }

          const parsed = JSON.parse(rawData);
          if (task.taskType === 'openai.chat') {
            onChunk({
              delta: parsed.choices?.[0]?.delta?.content ?? '',
              index: parsed.choices?.[0]?.index ?? 0,
              finish_reason: parsed.choices?.[0]?.finish_reason ?? null,
            });
          } else {
            onChunk({ event: currentEvent, data: parsed });
          }
        }
      }
    }

    return { content: '' };
  }

  async fetchModels(): Promise<ModelDescriptor[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/v1/models`);
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
}
