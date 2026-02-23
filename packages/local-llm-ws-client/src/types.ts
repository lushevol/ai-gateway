export interface ClientOptions {
  gatewayWsUrl: string;
  gatewayNamespace?: string;
  localLlmBaseUrl: string;
  clientName?: string;
  version?: string;
  heartbeatIntervalMs?: number;
  reconnectAttempts?: number;
  reconnectDelayMs?: number;
  reconnectDelayMaxMs?: number;
  connectionTimeoutMs?: number;
  localApiMaxRetries?: number;
  localApiRetryBaseDelayMs?: number;
  localApiRetryMaxDelayMs?: number;
}

export type ResponseMode = 'sync' | 'stream';

export interface TaskCreatePayload {
  taskId: string;
  provider?: 'openai' | 'claude';
  taskType: string;
  responseMode: ResponseMode;
  request: Record<string, unknown>;
}

export interface ModelDescriptor {
  id: string;
  owned_by?: string;
  context_window?: number;
  embedding?: boolean;
}

export interface SocketLike {
  on: (event: string, handler: (payload?: any) => void | Promise<void>) => void;
  emit: (event: string, payload: any) => void;
}
