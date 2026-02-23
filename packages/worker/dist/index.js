Object.defineProperty(exports, "__esModule", { value: true });
exports.Worker = void 0;
const worker_1 = require("./worker");
Object.defineProperty(exports, "Worker", {
	enumerable: true,
	get: () => worker_1.Worker,
});
// Example usage:
if (require.main === module) {
	const worker = new worker_1.Worker("http://localhost:3000", {
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
