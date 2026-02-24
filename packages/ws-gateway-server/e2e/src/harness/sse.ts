export interface SseFrame {
  event?: string;
  data: string;
}

export async function readSseFrames(url: string, body: unknown): Promise<SseFrame[]> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    throw new Error(`SSE request failed with status ${response.status}`);
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = '';
  const frames: SseFrame[] = [];

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
      let event: string | undefined;
      const dataLines: string[] = [];
      for (const rawLine of part.split('\n')) {
        const line = rawLine.trim();
        if (!line) {
          continue;
        }
        if (line.startsWith('event:')) {
          event = line.slice('event:'.length).trim();
          continue;
        }
        if (line.startsWith('data:')) {
          dataLines.push(line.slice('data:'.length).trim());
        }
      }

      if (dataLines.length > 0) {
        frames.push({ event, data: dataLines.join('\n') });
      }
    }
  }

  return frames;
}
