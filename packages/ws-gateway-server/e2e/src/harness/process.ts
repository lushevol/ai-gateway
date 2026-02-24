import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { waitFor } from './wait';

const DEFAULT_PORT = 4310;
const READY_TIMEOUT_MS = 45000;

function repoRoot(): string {
  return path.resolve(__dirname, '../../../../..');
}

function logPrefix(name: string): (chunk: Buffer) => void {
  return (chunk: Buffer) => {
    process.stdout.write(`[${name}] ${chunk.toString()}`);
  };
}

function spawnManaged(name: string, command: string, args: string[], env: Record<string, string>): ChildProcess {
  const child = spawn(command, args, {
    cwd: repoRoot(),
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', logPrefix(name));
  child.stderr?.on('data', logPrefix(name));

  return child;
}

async function waitForGatewayReady(baseUrl: string): Promise<void> {
  await waitFor(async () => {
    try {
      const response = await fetch(`${baseUrl}/v1/models`);
      if (!response.ok) {
        return false;
      }
      const json = (await response.json()) as { data?: Array<{ id?: string }> };
      return Array.isArray(json.data) && json.data.length > 0;
    } catch {
      return false;
    }
  }, READY_TIMEOUT_MS);
}

async function stopChild(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.killed) {
    return;
  }

  child.kill('SIGTERM');
  await waitFor(async () => child.exitCode !== null || child.signalCode !== null, 10000, 200).catch(() => undefined);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
  }
}

export interface E2EHarness {
  baseUrl: string;
  gatewayProcess: ChildProcess;
  clientProcess: ChildProcess;
}

export async function startHarness(port = DEFAULT_PORT): Promise<E2EHarness> {
  const baseUrl = `http://127.0.0.1:${port}`;

  const gatewayProcess = spawnManaged(
    'gateway',
    'pnpm',
    ['--filter', '@ai-gateway/ws-gateway-server', 'dev'],
    { PORT: String(port) },
  );

  const clientProcess = spawnManaged(
    'ws-client',
    'pnpm',
    ['--filter', '@ai-gateway/local-llm-ws-client', 'dev'],
    {
      GATEWAY_WS_URL: baseUrl,
      LOCAL_LLM_BASE_URL: 'http://127.0.0.1:4141',
      CLIENT_NAME: 'e2e-client',
      HEARTBEAT_INTERVAL_MS: '5000',
      NO_PROXY: '127.0.0.1,localhost',
      no_proxy: '127.0.0.1,localhost',
      HTTP_PROXY: '',
      HTTPS_PROXY: '',
      ALL_PROXY: '',
    },
  );

  try {
    await waitForGatewayReady(baseUrl);
  } catch (error) {
    await stopChild(clientProcess);
    await stopChild(gatewayProcess);
    throw error;
  }

  return { baseUrl, gatewayProcess, clientProcess };
}

export async function stopHarness(harness: E2EHarness | undefined): Promise<void> {
  if (!harness) {
    return;
  }

  await stopChild(harness.clientProcess);
  await stopChild(harness.gatewayProcess);
}
