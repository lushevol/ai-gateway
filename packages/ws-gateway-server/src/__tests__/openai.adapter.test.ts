import { ModelsAggregationService } from '../services/models-aggregation.service';
import { ProviderAdapterService } from '../services/provider-adapter.service';

describe('OpenAI adapter and models aggregation', () => {
  test('maps OpenAI chat request to proxy task payload', () => {
    const svc = new ProviderAdapterService();

    const task = svc.toProxyTaskFromOpenAIChat('task-1', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'hello' },
      ],
      stream: false,
    });

    expect(task.taskType).toBe('openai.chat');
    expect(task.provider).toBe('openai');
    expect(task.responseMode).toBe('sync');
  });

  test('maps embeddings response to OpenAI embeddings schema', () => {
    const svc = new ProviderAdapterService();
    const response = svc.toOpenAIEmbeddingResponse('text-embedding-3-small', {
      embeddings: [[0.1, 0.2, 0.3]],
      usage: { prompt_tokens: 3, total_tokens: 3 },
    });

    expect(response.object).toBe('list');
    expect(response.data[0].object).toBe('embedding');
    expect(response.data[0].embedding).toEqual([0.1, 0.2, 0.3]);
  });

  test('deduplicates models by id', () => {
    const svc = new ModelsAggregationService();
    const merged = svc.deduplicate([
      { id: 'gpt-4o-mini', owned_by: 'a' },
      { id: 'gpt-4o-mini', owned_by: 'b' },
      { id: 'text-embedding-3-small', owned_by: 'c' },
    ]);

    expect(merged).toHaveLength(2);
    expect(merged.map((item) => item.id)).toEqual(['gpt-4o-mini', 'text-embedding-3-small']);
  });
});
