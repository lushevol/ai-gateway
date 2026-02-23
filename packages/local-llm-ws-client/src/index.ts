import { LocalLlmWsClient } from './client';
import { ClientOptions } from './types';

export function startClient(options?: Partial<ClientOptions>): LocalLlmWsClient {
  const resolved: ClientOptions = {
    gatewayWsUrl: options?.gatewayWsUrl ?? process.env.GATEWAY_WS_URL ?? 'http://127.0.0.1:3000',
    gatewayNamespace: options?.gatewayNamespace ?? process.env.GATEWAY_WS_NAMESPACE ?? '/llm-proxy',
    localLlmBaseUrl: options?.localLlmBaseUrl ?? process.env.LOCAL_LLM_BASE_URL ?? 'http://127.0.0.1:4141',
    clientName: options?.clientName ?? process.env.CLIENT_NAME,
    version: options?.version ?? process.env.CLIENT_VERSION,
  };

  const client = new LocalLlmWsClient(resolved);
  client.start();
  return client;
}
