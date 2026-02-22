export type ProviderName = 'openai' | 'claude';

export interface RegisterPayload {
  clientName: string;
  version: string;
  localBaseUrl: string;
  capabilities?: string[];
}

export interface ConnectedClient {
  socketId: string;
  clientName: string;
  version: string;
  localBaseUrl: string;
  capabilities: string[];
  lastSeenAt: Date;
}

export interface HeartbeatPayload {
  ts?: number;
}

export type ResponseMode = 'sync' | 'stream';

export interface TaskCreatePayload {
  taskId: string;
  provider: ProviderName;
  taskType: string;
  responseMode: ResponseMode;
  request: unknown;
}

export interface TaskChunkPayload {
  taskId: string;
  chunkIndex: number;
  chunk: unknown;
  providerHint?: ProviderName;
}

export interface TaskCompletePayload {
  taskId: string;
  result: unknown;
  usage?: unknown;
  finishReason?: string;
}

export interface TaskErrorPayload {
  taskId: string;
  code: string;
  message: string;
  retriable: boolean;
}

export interface ModelsRequestPayload {
  requestId: string;
}

export interface ModelDescriptor {
  id: string;
  owned_by?: string;
  context_window?: number;
  embedding?: boolean;
}

export interface ModelsResponsePayload {
  requestId: string;
  models: ModelDescriptor[];
}
