import { LocalLlmWsClient } from './client';
import { ClientOptions } from './types';

function readNumber(name: string): number | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

export function startClient(options?: Partial<ClientOptions>): LocalLlmWsClient {
  const resolved: ClientOptions = {
    gatewayWsUrl: options?.gatewayWsUrl ?? process.env.GATEWAY_WS_URL ?? 'http://127.0.0.1:1212',
    gatewayNamespace: options?.gatewayNamespace ?? process.env.GATEWAY_WS_NAMESPACE ?? '/llm-proxy',
    localLlmBaseUrl: options?.localLlmBaseUrl ?? process.env.LOCAL_LLM_BASE_URL ?? 'http://127.0.0.1:4141',
    clientName: options?.clientName ?? process.env.CLIENT_NAME,
    version: options?.version ?? process.env.CLIENT_VERSION,
    heartbeatIntervalMs: options?.heartbeatIntervalMs ?? readNumber('HEARTBEAT_INTERVAL_MS'),
    reconnectAttempts: options?.reconnectAttempts ?? readNumber('GATEWAY_RECONNECT_ATTEMPTS'),
    reconnectDelayMs: options?.reconnectDelayMs ?? readNumber('GATEWAY_RECONNECT_DELAY_MS'),
    reconnectDelayMaxMs: options?.reconnectDelayMaxMs ?? readNumber('GATEWAY_RECONNECT_DELAY_MAX_MS'),
    connectionTimeoutMs: options?.connectionTimeoutMs ?? readNumber('GATEWAY_CONNECT_TIMEOUT_MS'),
    localApiMaxRetries: options?.localApiMaxRetries ?? readNumber('LOCAL_API_MAX_RETRIES'),
    localApiRetryBaseDelayMs: options?.localApiRetryBaseDelayMs ?? readNumber('LOCAL_API_RETRY_BASE_DELAY_MS'),
    localApiRetryMaxDelayMs: options?.localApiRetryMaxDelayMs ?? readNumber('LOCAL_API_RETRY_MAX_DELAY_MS'),
  };

  const client = new LocalLlmWsClient(resolved);
  client.start();
  return client;
}
