import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { generateText, streamText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../..');
const port = 4311;
const baseUrl = `http://127.0.0.1:${port}`;

function spawnManaged(name, args, env = {}) {
  const child = spawn('pnpm', args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
      NO_PROXY: '127.0.0.1,localhost',
      no_proxy: '127.0.0.1,localhost',
      HTTP_PROXY: '',
      HTTPS_PROXY: '',
      ALL_PROXY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk.toString()}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk.toString()}`));
  return child;
}

async function waitForReady(timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/v1/models`);
      if (response.ok) {
        const json = await response.json();
        if (Array.isArray(json.data) && json.data.length > 0) {
          return;
        }
      }
    } catch {}
    await sleep(300);
  }

  throw new Error(`Timed out waiting for gateway readiness at ${baseUrl}`);
}

async function stopChild(child) {
  if (!child || child.killed) return;
  child.kill('SIGTERM');
  await sleep(500);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
  }
}

async function main() {
  const gateway = spawnManaged('gateway', ['--filter', '@ai-gateway/ws-gateway-server', 'dev'], {
    PORT: String(port),
  });

  const wsClient = spawnManaged('ws-client', ['--filter', '@ai-gateway/local-llm-ws-client', 'dev'], {
    GATEWAY_WS_URL: baseUrl,
    LOCAL_LLM_BASE_URL: 'http://127.0.0.1:4141',
    CLIENT_NAME: 'e2e-ai-sdk-client',
    HEARTBEAT_INTERVAL_MS: '5000',
  });

  try {
    await waitForReady();

    const openai = createOpenAI({ apiKey: 'test-key', baseURL: `${baseUrl}/v1` });

    const nonStream = await generateText({
      model: openai.chat('gpt-4o-mini'),
      prompt: 'Reply with exactly: SDK NONSTREAM OK',
    });
    if (!nonStream.text || !nonStream.text.includes('SDK')) {
      throw new Error(`non-stream assertion failed: ${nonStream.text}`);
    }

    const stream = streamText({
      model: openai.chat('gpt-4o-mini'),
      prompt: 'Count 1 to 3.',
    });

    let streamedText = '';
    for await (const chunk of stream.textStream) {
      streamedText += chunk;
    }
    if (!streamedText) {
      throw new Error('stream assertion failed: empty stream output');
    }

    const streamTool = streamText({
      model: openai.chat('gpt-4o-mini'),
      system: 'You must call the getWeather tool before answering weather questions.',
      prompt: 'Stream the weather today in NY. Use the tool.',
      tools: {
        getWeather: tool({
          description: 'Get weather by city and date.',
          inputSchema: z.object({ city: z.string(), date: z.string().optional() }),
          execute: async ({ city, date }) => ({
            city,
            date: date ?? 'today',
            forecast: 'Sunny 7C',
          }),
        }),
      },
      toolChoice: { type: 'tool', toolName: 'getWeather' },
      maxSteps: 3,
    });

    for await (const _chunk of streamTool.textStream) {
      // Drain stream to completion so tool-call metadata is finalized.
    }

    const streamedToolCalls = await streamTool.toolCalls;
    if (!Array.isArray(streamedToolCalls) || streamedToolCalls.length === 0) {
      throw new Error('stream tool-call assertion failed: no tool calls returned');
    }

    const firstStreamToolCall = streamedToolCalls[0];
    if (firstStreamToolCall?.toolName !== 'getWeather') {
      throw new Error(
        `stream tool-call assertion failed: unexpected tool name ${String(firstStreamToolCall?.toolName)}`,
      );
    }

    const streamToolArgs = firstStreamToolCall?.args ?? {};
    const streamArgsText = JSON.stringify(streamToolArgs).toLowerCase();
    if (Object.keys(streamToolArgs).length > 0 && !streamArgsText.includes('ny')) {
      throw new Error(
        `stream tool-call assertion failed: expected NY in args when args are present, got ${streamArgsText}`,
      );
    }

    const toolResult = await generateText({
      model: openai.chat('gpt-4o-mini'),
      system: 'You must call the getWeather tool before answering weather questions.',
      prompt: 'What is the weather today in NY? Use the tool.',
      tools: {
        getWeather: tool({
          description: 'Get weather by city and date.',
          inputSchema: z.object({ city: z.string(), date: z.string().optional() }),
          execute: async ({ city, date }) => ({
            city,
            date: date ?? 'today',
            forecast: 'Sunny 7C',
          }),
        }),
      },
      toolChoice: { type: 'tool', toolName: 'getWeather' },
      maxSteps: 3,
    });

    if (!Array.isArray(toolResult.toolCalls) || toolResult.toolCalls.length === 0) {
      throw new Error('tool-call assertion failed: no tool calls returned');
    }

    const firstToolCall = toolResult.toolCalls[0];
    if (firstToolCall?.toolName !== 'getWeather') {
      throw new Error(`tool-call assertion failed: unexpected tool name ${String(firstToolCall?.toolName)}`);
    }

    const toolArgs = toolResult.toolCalls[0]?.args ?? {};
    const argsText = JSON.stringify(toolArgs).toLowerCase();
    if (Object.keys(toolArgs).length > 0 && !argsText.includes('ny')) {
      throw new Error(`tool-call assertion failed: expected NY in args when args are present, got ${argsText}`);
    }

    process.stdout.write('[vercel-ai-openai] all assertions passed\n');
  } finally {
    await stopChild(wsClient);
    await stopChild(gateway);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
