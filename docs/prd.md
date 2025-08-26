# Product Requirements
This product is a software applications, no gui. There are 3 components,
1. a client service, connects to the task master service and publish tasks to it.
1. a task master service, contains a task queue
2. a worker service, processes tasks from the queue

task master service expose a websocket endpoint for clients to connect and get tasks from the queue.
worker service would be multiple instances that connects to the task master service. Once connected, task master service will distribute tasks to the worker instances and processes tasks concurrently.

When a client sends a task request to the task master service, it will add the task to the task queue and notify the worker instances to start processing the tasks. After the worker instances finish processing the tasks, they will send the results back to the task master service, which will then forward the results to the clients.

task master service expose a openai compatible api for receiving messages from the client service and publishing tasks to the task queue.

client service connects to the task master service and sends task requests to it. It will also listen for task results from the task master service and handle them accordingly.

When worker service connect to the task master service, a worker register list will add the worker info to the list, including worker ID, status (online/offline), and any other relevant metadata. After disconnected, the worker info will be marked as offline. Also have health check per min.

# Tech Stack
- Task Master Service: Built with NestJS, using WebSocket for real-time communication.
- Worker Service: Built with Node.js, could be built into a npm package and imported by other services.
- Client Service: Built with NestJS, it's a scheduled task runner that connects to the task master service and submits tasks.

Please confirm task status is reasonable, including task ID, status (queued, processing, completed), and any error messages if applicable. Once task is published to worker, it will change to processing. It will change to completed once the worker sends back the result. And it will change to queued if the task waiting 3 mins timeout.