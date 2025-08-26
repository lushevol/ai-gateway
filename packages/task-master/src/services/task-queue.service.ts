import { type LLMRequest, type Task, TaskStatus } from "@ai-gateway/types";
import { Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class TaskQueueService {
	private tasks: Map<string, Task> = new Map();
	private queue: string[] = [];

	createTask(request: LLMRequest): Task {
		const task: Task = {
			id: uuidv4(),
			status: TaskStatus.QUEUED,
			request,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		this.tasks.set(task.id, task);
		this.queue.push(task.id);
		return task;
	}

	getNextTask(): Task | null {
		const taskId = this.queue.shift();
		if (!taskId) return null;
		return this.tasks.get(taskId) || null;
	}

	updateTask(taskId: string, updates: Partial<Task>): Task {
		const task = this.tasks.get(taskId);
		if (!task) throw new Error(`Task ${taskId} not found`);

		const updatedTask = {
			...task,
			...updates,
			updatedAt: new Date(),
		};

		this.tasks.set(taskId, updatedTask);
		return updatedTask;
	}

	getTask(taskId: string): Task | undefined {
		return this.tasks.get(taskId);
	}

	handleWorkerFailure(workerId: string) {
		for (const task of this.tasks.values()) {
			if (task.workerId === workerId && task.status === TaskStatus.PROCESSING) {
				const updatedTask = this.updateTask(task.id, {
					status: TaskStatus.QUEUED,
					workerId: undefined,
				});
				this.queue.push(updatedTask.id);
			}
		}
	}
}
