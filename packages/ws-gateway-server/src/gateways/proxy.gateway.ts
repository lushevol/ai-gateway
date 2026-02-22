import { WebSocketGateway } from '@nestjs/websockets';

@WebSocketGateway({ namespace: '/llm-proxy' })
export class ProxyGateway {}
