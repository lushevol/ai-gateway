Object.defineProperty(exports, "__esModule", { value: true });
exports.Worker = void 0;
const events_1 = require("events");
const socket_io_client_1 = require("socket.io-client");
class Worker extends events_1.EventEmitter {
	constructor(masterUrl, metadata) {
		super();
		this.masterUrl = masterUrl;
		this.metadata = metadata;
		this.workerId = "";
		this.heartbeatInterval = null;
		this.socket = (0, socket_io_client_1.io)(masterUrl);
		this.setupSocketHandlers();
	}
	setupSocketHandlers() {
		this.socket.on("connect", this.handleConnect.bind(this));
		this.socket.on("task:process", this.handleTask.bind(this));
		this.socket.on("disconnect", this.handleDisconnect.bind(this));
	}
	async handleConnect() {
		const { workerId } = await this.socket.emitWithAck(
			"worker:register",
			this.metadata,
		);
		this.workerId = workerId;
		this.startHeartbeat();
		this.emit("ready", workerId);
	}
	startHeartbeat() {
		this.heartbeatInterval = setInterval(() => {
			this.socket.emit("worker:heartbeat", this.workerId);
		}, 60000); // 60 seconds
	}
	async handleTask(task) {
		try {
			const response = await this.processTask(task);
			this.socket.emit("task:complete", {
				taskId: task.id,
				response,
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			this.socket.emit("task:error", {
				taskId: task.id,
				error: errorMessage,
			});
		}
	}
	handleDisconnect() {
		this.heartbeatInterval && clearInterval(this.heartbeatInterval);
		this.emit("disconnected");
		// Attempt to reconnect after delay
		setTimeout(() => {
			this.socket.connect();
		}, 5000);
	}
	async processTask(task) {
		// This method should be implemented by specific worker implementations
		throw new Error("processTask must be implemented by worker implementation");
	}
	disconnect() {
		this.heartbeatInterval && clearInterval(this.heartbeatInterval);
		this.socket.disconnect();
	}
}
exports.Worker = Worker;
