import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(ProxyGateway.name);

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
    this.logger.log(`client_register socketId=${client.id} clientName=${payload.clientName} version=${payload.version}`);
    return { ok: true, socketId: client.id };
  }

  @SubscribeMessage('client:heartbeat')
  handleHeartbeat(client: Socket, _payload: HeartbeatPayload): { ok: true } {
    this.clientRegistry.markHeartbeat(client.id);
    this.logger.debug(`client_heartbeat socketId=${client.id}`);
    return { ok: true };
  }

  @SubscribeMessage('task:chunk')
  handleTaskChunk(client: Socket, payload: TaskChunkPayload): void {
    this.logger.debug(`task_chunk_received taskId=${payload.taskId} socketId=${client.id} chunkIndex=${payload.chunkIndex}`);
    this.taskService.appendChunk(payload.taskId, client.id, payload);
  }

  @SubscribeMessage('task:complete')
  handleTaskComplete(client: Socket, payload: TaskCompletePayload): void {
    this.logger.log(`task_complete_received taskId=${payload.taskId} socketId=${client.id}`);
    this.taskService.resolveTask(payload.taskId, client.id, payload);
  }

  @SubscribeMessage('task:error')
  handleTaskError(client: Socket, payload: TaskErrorPayload): void {
    this.logger.warn(`task_error_received taskId=${payload.taskId} socketId=${client.id} code=${payload.code}`);
    this.taskService.rejectTask(payload.taskId, client.id, payload);
  }

  @SubscribeMessage('models:response')
  handleModelsResponse(_client: Socket, payload: ModelsResponsePayload): void {
    this.logger.log(`models_response_received requestId=${payload.requestId} modelCount=${payload.models.length}`);
    this.modelsAggregation.acceptResponse(payload);
  }

  selectNextClientSocketId(): string | null {
    const selected = this.clientRegistry.selectNextClient();
    if (!selected) {
      this.logger.warn('client_select_empty');
      return null;
    }

    this.logger.log(`client_selected socketId=${selected.socketId} clientName=${selected.clientName}`);
    return selected.socketId;
  }

  emitTaskToClient(socketId: string, task: TaskCreatePayload): void {
    this.logger.log(`task_dispatch taskId=${task.taskId} socketId=${socketId} taskType=${task.taskType} mode=${task.responseMode}`);
    this.server.to(socketId).emit('task:create', task);
  }

  requestModelsFromAll(requestId: string): number {
    const clients = this.clientRegistry.listOnlineClients();
    this.logger.log(`models_request_broadcast requestId=${requestId} clientCount=${clients.length}`);
    for (const client of clients) {
      this.server.to(client.socketId).emit('models:request', { requestId });
    }

    return clients.length;
  }

  handleDisconnect(client: Socket): void {
    this.clientRegistry.removeSocket(client.id);
    this.logger.warn(`client_disconnect socketId=${client.id}`);
  }
}
