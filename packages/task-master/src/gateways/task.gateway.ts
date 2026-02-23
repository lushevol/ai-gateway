import {
	type LLMRequest,
	type LLMResponse,
	TaskStatus,
	type WorkerMetadata,
} from "@ai-gateway/types";
import {
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from "@nestjs/websockets";
import { Server, type Socket } from "socket.io";
// biome-ignore lint/style/useImportType: <explanation>
import { TaskQueueService } from "../services/task-queue.service";
// biome-ignore lint/style/useImportType: <explanation>
import { WorkerRegistryService } from "../services/worker-registry.service";

@WebSocketGateway({ namespace: '/aitask' })
export class TaskGateway {
	@WebSocketServer()
	server: Server = new Server();

	constructor(
		private taskQueue: TaskQueueService,
		private workerRegistry: WorkerRegistryService,
	) {}

	@SubscribeMessage("task:submit")
	handleTaskSubmit(client: Socket, request: LLMRequest) {
		const task = this.taskQueue.createTask(request);
		const availableWorkers = this.workerRegistry.getAvailableWorkers();

		if (availableWorkers.length > 0) {
			const worker = availableWorkers[0]; // Simple round-robin for now
			this.taskQueue.updateTask(task.id, {
				status: TaskStatus.PROCESSING,
				workerId: worker.id,
			});
			this.server.to(worker.id).emit("task:process", task);
		}

		return { taskId: task.id };
	}

	@SubscribeMessage("worker:register")
	handleWorkerRegister(client: Socket, metadata: WorkerMetadata) {
		const worker = this.workerRegistry.registerWorker(metadata);
		client.join(worker.id);
		return { workerId: worker.id };
	}

	@SubscribeMessage("worker:heartbeat")
	handleWorkerHeartbeat(client: Socket, workerId: string) {
		this.workerRegistry.updateHeartbeat(workerId);
	}

	@SubscribeMessage("task:complete")
	handleTaskComplete(
		client: Socket,
		data: { taskId: string; response: LLMResponse },
	) {
		const task = this.taskQueue.updateTask(data.taskId, {
			status: TaskStatus.COMPLETED,
			response: data.response,
		});
		this.server.emit("task:completed", task);
	}

	@SubscribeMessage("task:error")
	handleTaskError(client: Socket, data: { taskId: string; error: string }) {
		const task = this.taskQueue.updateTask(data.taskId, {
			status: TaskStatus.ERROR,
			error: data.error,
		});
		this.server.emit("task:error", task);
	}
}
