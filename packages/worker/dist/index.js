var __createBinding =
	(this && this.__createBinding) ||
	(Object.create
		? (o, m, k, k2) => {
				if (k2 === undefined) k2 = k;
				var desc = Object.getOwnPropertyDescriptor(m, k);
				if (
					!desc ||
					("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
				) {
					desc = { enumerable: true, get: () => m[k] };
				}
				Object.defineProperty(o, k2, desc);
			}
		: (o, m, k, k2) => {
				if (k2 === undefined) k2 = k;
				o[k2] = m[k];
			});
var __exportStar =
	(this && this.__exportStar) ||
	((m, exports) => {
		for (var p in m)
			if (p !== "default" && !Object.hasOwn(exports, p))
				__createBinding(exports, m, p);
	});
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./worker"), exports);
// Example usage:
if (require.main === module) {
	const worker = new Worker("http://localhost:3000", {
		version: "1.0.0",
		capabilities: ["text-generation"],
		load: 0,
	});
	worker.on("ready", (workerId) => {
		console.log(`Worker ${workerId} is connected and ready`);
	});
	worker.on("disconnected", () => {
		console.log("Worker disconnected from Task Master");
	});
}
