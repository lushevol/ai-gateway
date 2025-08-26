Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerStatus = exports.TaskStatus = void 0;
var TaskStatus;
((TaskStatus) => {
	TaskStatus["QUEUED"] = "queued";
	TaskStatus["PROCESSING"] = "processing";
	TaskStatus["COMPLETED"] = "completed";
	TaskStatus["ERROR"] = "error";
})((TaskStatus = exports.TaskStatus || (exports.TaskStatus = {})));
var WorkerStatus;
((WorkerStatus) => {
	WorkerStatus["ONLINE"] = "online";
	WorkerStatus["OFFLINE"] = "offline";
})((WorkerStatus = exports.WorkerStatus || (exports.WorkerStatus = {})));
