import { Injectable, Logger } from '@nestjs/common';
import { ConnectedClient, RegisterPayload } from '../types/proxy-protocol';

@Injectable()
export class ClientRegistryService {
  private readonly logger = new Logger(ClientRegistryService.name);
  private readonly clients = new Map<string, ConnectedClient>();
  private roundRobinIndex = 0;

  registerSocket(socketId: string, payload: RegisterPayload): ConnectedClient {
    const client: ConnectedClient = {
      socketId,
      clientName: payload.clientName,
      version: payload.version,
      localBaseUrl: payload.localBaseUrl,
      capabilities: payload.capabilities ?? [],
      lastSeenAt: new Date(),
    };

    this.clients.set(socketId, client);
    this.logger.log(`client_registered socketId=${socketId} clientName=${payload.clientName} total=${this.clients.size}`);
    return client;
  }

  removeSocket(socketId: string): void {
    this.clients.delete(socketId);
    this.logger.warn(`client_removed socketId=${socketId} total=${this.clients.size}`);
    if (this.roundRobinIndex >= this.clients.size && this.clients.size > 0) {
      this.roundRobinIndex = this.roundRobinIndex % this.clients.size;
    }
  }

  markHeartbeat(socketId: string): void {
    const existing = this.clients.get(socketId);
    if (!existing) {
      this.logger.warn(`heartbeat_ignored_unknown socketId=${socketId}`);
      return;
    }

    existing.lastSeenAt = new Date();
    this.clients.set(socketId, existing);
    this.logger.debug(`heartbeat_marked socketId=${socketId}`);
  }

  listOnlineClients(): ConnectedClient[] {
    return Array.from(this.clients.values());
  }

  selectNextClient(): ConnectedClient | null {
    const all = this.listOnlineClients();
    if (all.length === 0) {
      this.logger.warn('select_next_client_empty');
      return null;
    }

    const selected = all[this.roundRobinIndex % all.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % all.length;
    this.logger.debug(`select_next_client socketId=${selected.socketId} nextIndex=${this.roundRobinIndex}`);
    return selected;
  }
}
