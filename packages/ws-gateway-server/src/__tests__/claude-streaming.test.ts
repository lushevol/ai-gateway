import { ProviderAdapterService } from '../services/provider-adapter.service';

describe('Streaming frame mapping', () => {
  test('OpenAI stream frame includes chunk object', () => {
    const svc = new ProviderAdapterService();
    const frame = svc.toOpenAISseFrame('task-1', 'gpt-4o-mini', { delta: 'hello', index: 0, finish_reason: null });

    expect(frame).toContain('data: ');
    expect(frame).toContain('chat.completion.chunk');
  });

  test('Claude stream frame includes event line', () => {
    const svc = new ProviderAdapterService();
    const frame = svc.toClaudeSseFrame('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'hello' } });

    expect(frame).toContain('event: content_block_delta');
    expect(frame).toContain('data: ');
  });
});
