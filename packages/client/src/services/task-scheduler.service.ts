import type { LLMRequest } from "@ai-gateway/types";
import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type { TaskClientService } from "./task-client.service";

@Injectable()
export class TaskSchedulerService {
	constructor(private taskClient: TaskClientService) {}

	@Cron("*/5 * * * *") // Run every 5 minutes
	async handleScheduledTasks() {
		// Example scheduled task
		const request: LLMRequest = {
			model: "gpt-3.5-turbo",
			userPrompt: "Scheduled task prompt",
			responseType: "text",
		};

		try {
			const result = await this.taskClient.submitTask(request);
			console.log("Scheduled task completed:", result);
		} catch (error) {
			console.error("Scheduled task failed:", error);
		}
	}

	async scheduleCustomTask(request: LLMRequest) {
		try {
			const result = await this.taskClient.submitTask(request);
			return result;
		} catch (error) {
			throw new Error(`Failed to schedule custom task: ${error.message}`);
		}
	}
}
