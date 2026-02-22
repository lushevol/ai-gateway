import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ClientRegistryService } from '../services/client-registry.service';
import { HeartbeatPayload, RegisterPayload } from '../types/proxy-protocol';

@WebSocketGateway({ namespace: '/llm-proxy' })
export class ProxyGateway {
  @WebSocketServer()
  server: Server = new Server();

  constructor(private readonly clientRegistry: ClientRegistryService) {}

  @SubscribeMessage('client:register')
  handleRegister(client: Socket, payload: RegisterPayload): { ok: true; socketId: string } {
    this.clientRegistry.registerSocket(client.id, payload);
    return { ok: true, socketId: client.id };
  }

  @SubscribeMessage('client:heartbeat')
  handleHeartbeat(client: Socket, _payload: HeartbeatPayload): { ok: true } {
    this.clientRegistry.markHeartbeat(client.id);
    return { ok: true };
  }

  handleDisconnect(client: Socket): void {
    this.clientRegistry.removeSocket(client.id);
  }
}
