import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ClientRegistryService } from '../services/client-registry.service';
import { ModelsAggregationService } from '../services/models-aggregation.service';
import { ProxyTaskService } from '../services/proxy-task.service';
import {
  HeartbeatPayload,
  ModelsResponsePayload,
  RegisterPayload,
  TaskChunkPayload,
  TaskCompletePayload,
  TaskCreatePayload,
  TaskErrorPayload,
} from '../types/proxy-protocol';

@WebSocketGateway({ namespace: '/llm-proxy' })
export class ProxyGateway {
  @WebSocketServer()
  server: Server = new Server();

  constructor(
    private readonly clientRegistry: ClientRegistryService,
    private readonly taskService: ProxyTaskService,
    private readonly modelsAggregation: ModelsAggregationService,
  ) {}

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

  @SubscribeMessage('task:chunk')
  handleTaskChunk(_client: Socket, payload: TaskChunkPayload): void {
    this.taskService.appendChunk(payload.taskId, payload);
  }

  @SubscribeMessage('task:complete')
  handleTaskComplete(_client: Socket, payload: TaskCompletePayload): void {
    this.taskService.resolveTask(payload.taskId, payload);
  }

  @SubscribeMessage('task:error')
  handleTaskError(_client: Socket, payload: TaskErrorPayload): void {
    this.taskService.rejectTask(payload.taskId, payload);
  }

  @SubscribeMessage('models:response')
  handleModelsResponse(_client: Socket, payload: ModelsResponsePayload): void {
    this.modelsAggregation.acceptResponse(payload);
  }

  dispatchTask(task: TaskCreatePayload): boolean {
    const selected = this.clientRegistry.selectNextClient();
    if (!selected) {
      return false;
    }

    this.server.to(selected.socketId).emit('task:create', task);
    return true;
  }

  requestModelsFromAll(requestId: string): number {
    const clients = this.clientRegistry.listOnlineClients();
    for (const client of clients) {
      this.server.to(client.socketId).emit('models:request', { requestId });
    }

    return clients.length;
  }

  handleDisconnect(client: Socket): void {
    this.clientRegistry.removeSocket(client.id);
  }
}
