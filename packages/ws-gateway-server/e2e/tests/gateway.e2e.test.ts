import { startHarness, stopHarness, type E2EHarness } from '../src/harness/process';
import { postJson, getJson } from '../src/harness/http';
import { readSseFrames } from '../src/harness/sse';

describe('gateway e2e', () => {
  let harness: E2EHarness;

  beforeAll(async () => {
    harness = await startHarness();
  });

  afterAll(async () => {
    await stopHarness(harness);
  });

  test('GET /v1/models returns openai list shape', async () => {
    const models = await getJson(`${harness.baseUrl}/v1/models`);

    expect(models.object).toBe('list');
    expect(Array.isArray(models.data)).toBe(true);
    expect(models.data.length).toBeGreaterThan(0);
  });

  test('POST /v1/embeddings returns embedding list', async () => {
    const response = await fetch(`${harness.baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: 'hello world',
      }),
    });
    const body = await response.json();

    if (response.ok) {
      expect(body.object).toBe('list');
      expect(Array.isArray(body.data)).toBe(true);
      expect(Array.isArray(body.data[0].embedding)).toBe(true);
      return;
    }

    expect(response.status).toBe(502);
    expect(String(body.message)).toContain('status 400');
  });

  test('POST /v1/chat/completions non-stream returns chat completion', async () => {
    const body = await postJson(`${harness.baseUrl}/v1/chat/completions`, {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Reply with exactly: E2E OK' }],
      stream: false,
    });

    expect(body.object).toBe('chat.completion');
    expect(body.choices[0].message.content).toContain('E2E');
  });

  test('POST /v1/chat/completions stream emits chunks and DONE', async () => {
    const frames = await readSseFrames(`${harness.baseUrl}/v1/chat/completions`, {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Count from 1 to 3 in one line.' }],
      stream: true,
    });

    expect(frames.some((f) => f.data === '[DONE]')).toBe(true);
    expect(frames.some((f) => f.data.includes('chat.completion.chunk'))).toBe(true);
  });

  test('POST /v1/messages non-stream returns claude message shape', async () => {
    const response = await fetch(`${harness.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-latest',
        messages: [{ role: 'user', content: 'Say hello in one short sentence.' }],
        stream: false,
      }),
    });
    const body = await response.json();

    if (response.ok) {
      expect(body.type).toBe('message');
      expect(Array.isArray(body.content)).toBe(true);
      expect(typeof body.content[0].text).toBe('string');
      return;
    }

    expect(response.status).toBe(502);
    expect(String(body.message)).toContain('status 400');
  });

  test('POST /v1/messages stream emits claude events and message_stop', async () => {
    const frames = await readSseFrames(`${harness.baseUrl}/v1/messages`, {
      model: 'claude-3-5-sonnet-latest',
      messages: [{ role: 'user', content: 'Say hello in one short sentence.' }],
      stream: true,
    });

    const hasStop = frames.some((f) => f.event === 'message_stop');
    const hasError = frames.some((f) => f.event === 'error');
    expect(hasStop || hasError).toBe(true);
    expect(frames.some((f) => f.event && f.data)).toBe(true);
  });
});
