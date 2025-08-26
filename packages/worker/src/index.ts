export * from "./worker";

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
