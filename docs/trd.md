# Technical Design Document

## System Architecture

### Components Overview
1. **Client Service (NestJS)**
   - Scheduled task runner
   - WebSocket client connection to Task Master
   - Task submission and result handling

2. **Task Master Service (NestJS)**
   - WebSocket server for real-time communication
   - Task queue management
   - Worker registry management
   - OpenAI-compatible API endpoint

3. **Worker Service (Node.js)**
   - NPM package implementation
   - WebSocket client connection to Task Master
   - Task processing capabilities
   - Health check ping implementation

## Type Definitions

```typescript
// Task related types
interface Task {
  id: string;
  status: TaskStatus;
  request: LLMRequest;
  response?: LLMResponse;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  workerId?: string;
}

interface LLMRequest {
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  variables?: Record<string, any>;
  temperature?: number;
  maxTokens?: number;
  responseType: 'text' | 'json';
  responseSchema?: JSONSchema;
  stopSequences?: string[];
  contextWindow?: number;
  attachments?: Array<{
    type: string;
    content: string;
  }>;
}

interface LLMResponse {
  content: string | object;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

type JSONSchema = {
  type: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: any[];
  description?: string;
}

enum TaskStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

// Worker related types
interface Worker {
  id: string;
  status: WorkerStatus;
  lastHeartbeat: Date;
  metadata: WorkerMetadata;
}

enum WorkerStatus {
  ONLINE = 'online',
  OFFLINE = 'offline'
}

interface WorkerMetadata {
  version: string;
  capabilities: string[];
  load: number;
}
```

## Technical Workflows

### Task Processing Flow
1. Client submits task via OpenAI-compatible API
   - Task is created with QUEUED status
   - Task is added to queue

2. Task Master Distribution
   - Identifies available workers from registry
   - Selects worker based on load balancing
   - Updates task status to PROCESSING
   - Sends task to selected worker via WebSocket

3. Worker Processing
   - Receives task and processes it
   - Sends periodic health checks
   - Returns result or error to Task Master
   - Task status updated to COMPLETED or ERROR

4. Result Handling
   - Task Master receives result
   - Updates task status and stores result
   - Notifies client of completion via WebSocket

### Worker Registration Flow
1. Worker Connection
   - Worker establishes WebSocket connection
   - Sends registration request with metadata
   - Added to worker registry with ONLINE status

2. Health Check System
   - Worker sends heartbeat every 60 seconds
   - Task Master updates lastHeartbeat timestamp
   - If heartbeat missing for 180 seconds:
     - Mark worker as OFFLINE
     - Reassign any PROCESSING tasks to QUEUED

### Task Timeout Handling
1. Task Monitoring
   - Task Master monitors processing time
   - If task in PROCESSING > 3 minutes:
     - Reset to QUEUED status
     - Log timeout event
     - Reassign to different worker

## API Specifications

### OpenAI-Compatible Endpoint
```typescript
POST /v1/chat/completions
{
  "model": "string",
  "messages": [{
    "role": "user|system|assistant",
    "content": "string"
  }],
  "temperature": number,
  // Other OpenAI-compatible parameters
}
```

### WebSocket Events
```typescript
// Client Events
interface ClientEvents {
  'task:submit': (request: LLMRequest) => void;
  'task:result': (taskId: string) => void;
}

// Worker Events
interface WorkerEvents {
  'worker:register': (metadata: WorkerMetadata) => void;
  'worker:heartbeat': () => void;
  'task:complete': (taskId: string, response: LLMResponse) => void;
  'task:error': (taskId: string, error: string) => void;
}
```

## Data Storage
- In-memory task queue for active tasks
- Persistent storage (database) for:
  - Task history
  - Worker registry
  - System metrics

## Error Handling
- Failed tasks retry mechanism (max 3 attempts)
- Worker failure detection and recovery
- Task timeout management
- Rate limiting for API endpoints
- Error logging and monitoring