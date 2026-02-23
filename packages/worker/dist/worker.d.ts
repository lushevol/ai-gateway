import {
	type LLMResponse,
	type Task,
	type WorkerMetadata,
} from "@ai-gateway/types";
import { EventEmitter } from "events";
export declare class Worker extends EventEmitter {
	private masterUrl;
	private metadata;
	private socket;
	private workerId;
	private heartbeatInterval;
	constructor(masterUrl: string, metadata: WorkerMetadata);
	private setupSocketHandlers;
	private handleConnect;
	private startHeartbeat;
	private handleTask;
	private handleDisconnect;
	protected processTask(task: Task): Promise<LLMResponse>;
	disconnect(): void;
}
