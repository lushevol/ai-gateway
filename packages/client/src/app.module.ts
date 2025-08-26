import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { TaskClientService } from "./services/task-client.service";
import { TaskSchedulerService } from "./services/task-scheduler.service";

@Module({
	imports: [ScheduleModule.forRoot()],
	providers: [TaskClientService, TaskSchedulerService],
})
export class AppModule {}
