import { Module } from "@nestjs/common";
import { OpenAIController } from "./controllers/openai.controller";
import { TaskGateway } from "./gateways/task.gateway";
import { TaskQueueService } from "./services/task-queue.service";
import { WorkerRegistryService } from "./services/worker-registry.service";

@Module({
	imports: [],
	controllers: [OpenAIController],
	providers: [TaskQueueService, WorkerRegistryService, TaskGateway],
})
export class AppModule {}
