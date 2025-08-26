import type {
	LLMResponse,
	Task,
	WorkerMetadata,
} from "@ai-gateway/types";
import { EventEmitter } from "node:events";
import { io, type Socket } from "socket.io-client";

export class Worker extends EventEmitter {
	private socket: Socket;
	private workerId: string = "";
	private heartbeatInterval: NodeJS.Timeout | null = null;

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
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			this.socket.emit("task:error", {
				taskId: task.id,
				error: errorMessage,
			});
		}
	}

	private handleDisconnect() {
		this.heartbeatInterval && clearInterval(this.heartbeatInterval);
		this.emit("disconnected");
		// Attempt to reconnect after delay
		setTimeout(() => {
			this.socket.connect();
		}, 5000);
	}

	protected async processTask(task: Task): Promise<LLMResponse> {
		// This method should be implemented by specific worker implementations
		// throw new Error("processTask must be implemented by worker implementation");
		return {
			model: task.request.model,
			content: "Processed task content",
			usage: {
				promptTokens: 10,
				completionTokens: 5,
				totalTokens: 15,
			},
		};
	}

	public disconnect() {
		this.heartbeatInterval && clearInterval(this.heartbeatInterval);
		this.socket.disconnect();
	}
}
