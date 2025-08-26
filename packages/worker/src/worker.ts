import {
	type LLMResponse,
	type Task,
	type WorkerMetadata,
	WorkerStatus,
} from "@ai-gateway/types";
import { EventEmitter } from "events";
import { io, type Socket } from "socket.io-client";

export class Worker extends EventEmitter {
	private socket: Socket;
	private workerId: string;
	private heartbeatInterval: NodeJS.Timer;

	constructor(
		private masterUrl: string,
		private metadata: WorkerMetadata,
	) {
		super();
		this.socket = io(masterUrl);
		this.setupSocketHandlers();
	}

	private setupSocketHandlers() {
		this.socket.on("connect", this.handleConnect.bind(this));
		this.socket.on("task:process", this.handleTask.bind(this));
		this.socket.on("disconnect", this.handleDisconnect.bind(this));
	}

	private async handleConnect() {
		const { workerId } = await this.socket.emitWithAck(
			"worker:register",
			this.metadata,
		);
		this.workerId = workerId;
		this.startHeartbeat();
		this.emit("ready", workerId);
	}

	private startHeartbeat() {
		this.heartbeatInterval = setInterval(() => {
			this.socket.emit("worker:heartbeat", this.workerId);
		}, 60000); // 60 seconds
	}

	private async handleTask(task: Task) {
		try {
			const response = await this.processTask(task);
			this.socket.emit("task:complete", {
				taskId: task.id,
				response,
			});
		} catch (error) {
			this.socket.emit("task:error", {
				taskId: task.id,
				error: error.message,
			});
		}
	}

	private handleDisconnect() {
		clearInterval(this.heartbeatInterval);
		this.emit("disconnected");
		// Attempt to reconnect after delay
		setTimeout(() => {
			this.socket.connect();
		}, 5000);
	}

	protected async processTask(task: Task): Promise<LLMResponse> {
		// This method should be implemented by specific worker implementations
		throw new Error("processTask must be implemented by worker implementation");
	}

	public disconnect() {
		clearInterval(this.heartbeatInterval);
		this.socket.disconnect();
	}
}
