export interface Task {
	id: string;
	status: TaskStatus;
	request: LLMRequest;
	response?: LLMResponse;
	error?: string;
	createdAt: Date;
	updatedAt: Date;
	workerId?: string;
}
export interface LLMRequest {
	model: string;
	systemPrompt?: string;
	userPrompt: string;
	variables?: Record<string, any>;
	temperature?: number;
	maxTokens?: number;
	responseType: "text" | "json";
	responseSchema?: JSONSchema;
	stopSequences?: string[];
	contextWindow?: number;
	attachments?: Array<{
		type: string;
		content: string;
	}>;
}
export interface LLMResponse {
	content: string | object;
	usage: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	model: string;
}
export type JSONSchema = {
	type: string;
	properties?: Record<string, JSONSchema>;
	items?: JSONSchema;
	required?: string[];
	enum?: any[];
	description?: string;
};
export declare enum TaskStatus {
	QUEUED = "queued",
	PROCESSING = "processing",
	COMPLETED = "completed",
	ERROR = "error",
}
export interface Worker {
	id: string;
	status: WorkerStatus;
	lastHeartbeat: Date;
	metadata: WorkerMetadata;
}
export declare enum WorkerStatus {
	ONLINE = "online",
	OFFLINE = "offline",
}
export interface WorkerMetadata {
	version: string;
	capabilities: string[];
	load: number;
}
export interface ClientEvents {
	"task:submit": (request: LLMRequest) => void;
	"task:result": (taskId: string) => void;
}
export interface WorkerEvents {
	"worker:register": (metadata: WorkerMetadata) => void;
	"worker:heartbeat": () => void;
	"task:complete": (taskId: string, response: LLMResponse) => void;
	"task:error": (taskId: string, error: string) => void;
}
