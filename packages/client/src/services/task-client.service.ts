import type { LLMRequest, Task } from "@ai-gateway/types";
import {
	Injectable,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { Subject } from "rxjs";
import { io, type Socket } from "socket.io-client";

@Injectable()
export class TaskClientService implements OnModuleInit, OnModuleDestroy {
	private socket: Socket;
	private taskResults = new Map<string, Subject<Task>>();

	constructor() {
		this.socket = io("http://localhost:1212"); // Task Master URL
		this.setupSocketHandlers();
	}

	onModuleInit() {
		this.socket.connect();
	}

	onModuleDestroy() {
		this.socket.disconnect();
	}

	private setupSocketHandlers() {
		this.socket.on("task:completed", (task: Task) => {
			const subject = this.taskResults.get(task.id);
			if (subject) {
				subject.next(task);
				subject.complete();
				this.taskResults.delete(task.id);
			}
		});

		this.socket.on("task:error", (task: Task) => {
			const subject = this.taskResults.get(task.id);
			if (subject) {
				subject.error(new Error(task.error));
				this.taskResults.delete(task.id);
			}
		});
	}

	async submitTask(request: LLMRequest): Promise<Task> {
		const { taskId } = await this.socket.emitWithAck("task:submit", request);
		const subject = new Subject<Task>();
		this.taskResults.set(taskId, subject);

		return new Promise((resolve, reject) => {
			subject.subscribe({
				next: resolve,
				error: reject,
			});
		});
	}
}
