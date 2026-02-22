import { Injectable } from '@nestjs/common';
import { ConnectedClient, RegisterPayload } from '../types/proxy-protocol';

@Injectable()
export class ClientRegistryService {
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
    return client;
  }

  removeSocket(socketId: string): void {
    this.clients.delete(socketId);
    if (this.roundRobinIndex >= this.clients.size && this.clients.size > 0) {
      this.roundRobinIndex = this.roundRobinIndex % this.clients.size;
    }
  }

  markHeartbeat(socketId: string): void {
    const existing = this.clients.get(socketId);
    if (!existing) {
      return;
    }

    existing.lastSeenAt = new Date();
    this.clients.set(socketId, existing);
  }

  listOnlineClients(): ConnectedClient[] {
    return Array.from(this.clients.values());
  }

  selectNextClient(): ConnectedClient | null {
    const all = this.listOnlineClients();
    if (all.length === 0) {
      return null;
    }

    const selected = all[this.roundRobinIndex % all.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % all.length;
    return selected;
  }
}
