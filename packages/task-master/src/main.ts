import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	await app.listen(1212);
	console.log("Task Master service is running on port 1212");
}

bootstrap();
