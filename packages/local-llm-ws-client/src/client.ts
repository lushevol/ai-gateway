import { io, Socket } from 'socket.io-client';
import { ClientOptions } from './types';

export class LocalLlmWsClient {
  private readonly socket: Socket;

  constructor(private readonly options: ClientOptions) {
    this.socket = io(`${options.gatewayWsUrl}${options.gatewayNamespace ?? '/llm-proxy'}`);
  }

  start(): void {
    this.socket.on('connect', () => {
      this.socket.emit('client:register', {
        clientName: this.options.clientName ?? 'local-client',
        version: this.options.version ?? '0.1.0',
        localBaseUrl: this.options.localLlmBaseUrl,
        capabilities: ['chat', 'embeddings', 'models'],
      });
    });
  }
}
