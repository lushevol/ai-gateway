import {
	type Worker,
	type WorkerMetadata,
	WorkerStatus,
} from "@ai-gateway/types";
import { Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class WorkerRegistryService {
	private workers: Map<string, Worker> = new Map();

	registerWorker(metadata: WorkerMetadata): Worker {
		const worker: Worker = {
			id: uuidv4(),
			status: WorkerStatus.ONLINE,
			lastHeartbeat: new Date(),
			metadata,
		};

		this.workers.set(worker.id, worker);
		return worker;
	}

	updateHeartbeat(workerId: string) {
		const worker = this.workers.get(workerId);
		if (!worker) throw new Error(`Worker ${workerId} not found`);

		worker.lastHeartbeat = new Date();
		worker.status = WorkerStatus.ONLINE;
		this.workers.set(workerId, worker);
	}

	getAvailableWorkers(): Worker[] {
		const now = new Date();
		const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);

		return Array.from(this.workers.values()).filter(
			(worker) =>
				worker.status === WorkerStatus.ONLINE &&
				worker.lastHeartbeat > threeMinutesAgo,
		);
	}

	markWorkerOffline(workerId: string) {
		const worker = this.workers.get(workerId);
		if (worker) {
			worker.status = WorkerStatus.OFFLINE;
			this.workers.set(workerId, worker);
		}
	}

	cleanupInactiveWorkers() {
		const now = new Date();
		const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);

		for (const [id, worker] of this.workers.entries()) {
			if (worker.lastHeartbeat < threeMinutesAgo) {
				worker.status = WorkerStatus.OFFLINE;
				this.workers.set(id, worker);
			}
		}
	}

	getWorker(workerId: string): Worker | undefined {
		return this.workers.get(workerId);
	}
}
