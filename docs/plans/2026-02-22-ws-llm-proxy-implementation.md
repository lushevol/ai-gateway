# WebSocket LLM Proxy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add two new packages: a websocket gateway server exposing OpenAI/Claude-compatible APIs globally, and a websocket client that proxies requests to local LLM APIs (including streaming, OpenAI models, and OpenAI embeddings).

**Architecture:** Build provider adapters on the server that map HTTP OpenAI/Claude payloads to one internal websocket task protocol. Route tasks to online clients with round-robin scheduling. Let clients call local APIs and emit chunk/final/error protocol events so the server can rehydrate provider-compatible JSON/SSE responses.

**Tech Stack:** TypeScript, NestJS, Socket.IO, Node.js fetch/ReadableStream, Jest + ts-jest, pnpm workspace.

---

### Task 1: Scaffold `ws-gateway-server` package

**Files:**
- Create: `packages/ws-gateway-server/package.json`
- Create: `packages/ws-gateway-server/tsconfig.json`
- Create: `packages/ws-gateway-server/src/main.ts`
- Create: `packages/ws-gateway-server/src/app.module.ts`
- Create: `packages/ws-gateway-server/src/controllers/openai.controller.ts`
- Create: `packages/ws-gateway-server/src/controllers/claude.controller.ts`
- Create: `packages/ws-gateway-server/src/gateways/proxy.gateway.ts`
- Create: `packages/ws-gateway-server/src/services/client-registry.service.ts`
- Create: `packages/ws-gateway-server/src/services/proxy-task.service.ts`
- Create: `packages/ws-gateway-server/src/services/provider-adapter.service.ts`
- Create: `packages/ws-gateway-server/src/services/models-aggregation.service.ts`
- Create: `packages/ws-gateway-server/src/types/proxy-protocol.ts`

**Step 1: Write the failing package smoke test**

```typescript
// packages/ws-gateway-server/src/__tests__/bootstrap.test.ts
import { AppModule } from '../app.module';

test('AppModule is defined', () => {
  expect(AppModule).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-gateway/ws-gateway-server test`  
Expected: FAIL with missing package/scripts/modules.

**Step 3: Write minimal implementation scaffolding**

```typescript
// app.module.ts
@Module({ controllers: [OpenAIController, ClaudeController], providers: [ProxyGateway, ClientRegistryService, ProxyTaskService, ProviderAdapterService, ModelsAggregationService] })
export class AppModule {}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai-gateway/ws-gateway-server test`  
Expected: PASS bootstrap test.

**Step 5: Commit**

```bash
git add packages/ws-gateway-server
git commit -m "feat(ws-gateway-server): scaffold new gateway package"
```

### Task 2: Add server websocket protocol + round-robin registry

**Files:**
- Test: `packages/ws-gateway-server/src/__tests__/client-registry.service.test.ts`
- Modify: `packages/ws-gateway-server/src/services/client-registry.service.ts`
- Modify: `packages/ws-gateway-server/src/gateways/proxy.gateway.ts`
- Modify: `packages/ws-gateway-server/src/types/proxy-protocol.ts`

**Step 1: Write the failing test**

```typescript
test('selectNextClient returns clients in round-robin order', () => {
  const svc = new ClientRegistryService();
  svc.registerSocket('a', { clientName: 'A' });
  svc.registerSocket('b', { clientName: 'B' });
  expect(svc.selectNextClient()?.socketId).toBe('a');
  expect(svc.selectNextClient()?.socketId).toBe('b');
  expect(svc.selectNextClient()?.socketId).toBe('a');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-gateway/ws-gateway-server test client-registry.service.test.ts`  
Expected: FAIL with missing methods.

**Step 3: Write minimal implementation**

```typescript
registerSocket(socketId: string, meta: RegisterPayload) { /* add map entry */ }
selectNextClient(): ConnectedClient | null { /* index modulo length */ }
markHeartbeat(socketId: string): void { /* update lastSeen */ }
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai-gateway/ws-gateway-server test client-registry.service.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/ws-gateway-server/src/services/client-registry.service.ts packages/ws-gateway-server/src/gateways/proxy.gateway.ts packages/ws-gateway-server/src/types/proxy-protocol.ts packages/ws-gateway-server/src/__tests__/client-registry.service.test.ts
git commit -m "feat(ws-gateway-server): add client registry and round-robin selection"
```

### Task 3: Implement server task correlation + timeout handling

**Files:**
- Test: `packages/ws-gateway-server/src/__tests__/proxy-task.service.test.ts`
- Modify: `packages/ws-gateway-server/src/services/proxy-task.service.ts`

**Step 1: Write the failing tests**

```typescript
test('resolveTask fulfills waiting promise', async () => { /* createTaskWaiter, resolveTask */ });
test('timeout rejects waiting promise with gateway timeout', async () => { /* short timeout */ });
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-gateway/ws-gateway-server test proxy-task.service.test.ts`  
Expected: FAIL with missing API.

**Step 3: Write minimal implementation**

```typescript
createPendingTask(taskId: string, mode: 'sync'|'stream', timeoutMs: number): PendingTaskHandle
resolveTask(taskId: string, payload: TaskCompletePayload): void
rejectTask(taskId: string, error: TaskErrorPayload): void
appendChunk(taskId: string, chunk: TaskChunkPayload): void
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai-gateway/ws-gateway-server test proxy-task.service.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/ws-gateway-server/src/services/proxy-task.service.ts packages/ws-gateway-server/src/__tests__/proxy-task.service.test.ts
git commit -m "feat(ws-gateway-server): add task correlation and timeout lifecycle"
```

### Task 4: Add OpenAI adapters (chat, embeddings, models)

**Files:**
- Test: `packages/ws-gateway-server/src/__tests__/openai.adapter.test.ts`
- Modify: `packages/ws-gateway-server/src/services/provider-adapter.service.ts`
- Modify: `packages/ws-gateway-server/src/controllers/openai.controller.ts`
- Modify: `packages/ws-gateway-server/src/services/models-aggregation.service.ts`

**Step 1: Write failing adapter/controller tests**

```typescript
test('maps OpenAI chat request to proxy task payload', () => { /* assert taskType openai.chat */ });
test('maps embeddings response to OpenAI embeddings schema', () => { /* assert data[] */ });
test('GET /v1/models aggregates and dedups model ids', async () => { /* fan-out mock */ });
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-gateway/ws-gateway-server test openai.adapter.test.ts`  
Expected: FAIL on mapping mismatch/missing methods.

**Step 3: Write minimal implementation**

```typescript
@Post('/v1/chat/completions')
@Post('/v1/embeddings')
@Get('/v1/models')
```

Implement:
- `toProxyTaskFromOpenAIChat(...)`
- `toProxyTaskFromOpenAIEmbeddings(...)`
- `toOpenAIChatResponse(...)`
- `toOpenAIEmbeddingResponse(...)`
- models fan-out request/collect/dedup.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai-gateway/ws-gateway-server test openai.adapter.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/ws-gateway-server/src/controllers/openai.controller.ts packages/ws-gateway-server/src/services/provider-adapter.service.ts packages/ws-gateway-server/src/services/models-aggregation.service.ts packages/ws-gateway-server/src/__tests__/openai.adapter.test.ts
git commit -m "feat(ws-gateway-server): add OpenAI chat embeddings and models adapters"
```

### Task 5: Add Claude adapters + SSE streaming bridge

**Files:**
- Test: `packages/ws-gateway-server/src/__tests__/claude-streaming.test.ts`
- Modify: `packages/ws-gateway-server/src/controllers/claude.controller.ts`
- Modify: `packages/ws-gateway-server/src/controllers/openai.controller.ts`
- Modify: `packages/ws-gateway-server/src/services/provider-adapter.service.ts`

**Step 1: Write failing streaming tests**

```typescript
test('OpenAI stream sends delta chunks and [DONE]', async () => { /* SSE assertions */ });
test('Claude stream maps normalized chunks to Claude SSE events', async () => { /* event frame assertions */ });
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-gateway/ws-gateway-server test claude-streaming.test.ts`  
Expected: FAIL missing SSE frame mapping.

**Step 3: Write minimal implementation**

```typescript
if (body.stream) {
  // writeHead text/event-stream
  // subscribe task chunks
  // map chunk -> provider frame
}
```

Ensure terminal behaviors:
- OpenAI `data: [DONE]`
- Claude terminal message/done event
- On error: provider-compatible error event then close.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai-gateway/ws-gateway-server test claude-streaming.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/ws-gateway-server/src/controllers/claude.controller.ts packages/ws-gateway-server/src/controllers/openai.controller.ts packages/ws-gateway-server/src/services/provider-adapter.service.ts packages/ws-gateway-server/src/__tests__/claude-streaming.test.ts
git commit -m "feat(ws-gateway-server): add Claude API and streaming SSE bridge"
```

### Task 6: Scaffold `local-llm-ws-client` package

**Files:**
- Create: `packages/local-llm-ws-client/package.json`
- Create: `packages/local-llm-ws-client/tsconfig.json`
- Create: `packages/local-llm-ws-client/src/index.ts`
- Create: `packages/local-llm-ws-client/src/client.ts`
- Create: `packages/local-llm-ws-client/src/local-api-adapter.ts`
- Create: `packages/local-llm-ws-client/src/types.ts`
- Test: `packages/local-llm-ws-client/src/__tests__/bootstrap.test.ts`

**Step 1: Write failing bootstrap test**

```typescript
import { startClient } from '../index';

test('exports startClient', () => {
  expect(typeof startClient).toBe('function');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-gateway/local-llm-ws-client test`  
Expected: FAIL missing package/files.

**Step 3: Write minimal scaffolding implementation**

```typescript
export function startClient(): void {
  // wire socket connection bootstrap
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai-gateway/local-llm-ws-client test`  
Expected: PASS bootstrap test.

**Step 5: Commit**

```bash
git add packages/local-llm-ws-client
git commit -m "feat(local-llm-ws-client): scaffold websocket client package"
```

### Task 7: Implement client local API proxying (sync + stream + models)

**Files:**
- Test: `packages/local-llm-ws-client/src/__tests__/local-api-adapter.test.ts`
- Test: `packages/local-llm-ws-client/src/__tests__/client-protocol.test.ts`
- Modify: `packages/local-llm-ws-client/src/local-api-adapter.ts`
- Modify: `packages/local-llm-ws-client/src/client.ts`

**Step 1: Write failing tests**

```typescript
test('handles task:create openai.chat sync and emits task:complete', async () => {});
test('handles task:create stream and emits ordered task:chunk then task:complete', async () => {});
test('responds to models:request with local model list', async () => {});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ai-gateway/local-llm-ws-client test local-api-adapter.test.ts client-protocol.test.ts`  
Expected: FAIL missing handlers/methods.

**Step 3: Write minimal implementation**

```typescript
socket.on('task:create', async (task) => { /* fetch local endpoint, emit chunk/complete/error */ });
socket.on('models:request', async ({ requestId }) => { /* GET /v1/models local */ });
```

Implement stream parsing from local SSE and re-emit normalized chunks.

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ai-gateway/local-llm-ws-client test local-api-adapter.test.ts client-protocol.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/local-llm-ws-client/src/client.ts packages/local-llm-ws-client/src/local-api-adapter.ts packages/local-llm-ws-client/src/__tests__/local-api-adapter.test.ts packages/local-llm-ws-client/src/__tests__/client-protocol.test.ts
git commit -m "feat(local-llm-ws-client): implement task proxying and model discovery"
```

### Task 8: Wire workspace + end-to-end verification

**Files:**
- Modify: `pnpm-workspace.yaml` (if needed for new package glob compatibility)
- Modify: root `package.json` (optional scripts for focused dev)
- Create: `docs/plans/2026-02-22-ws-llm-proxy-runbook.md`

**Step 1: Write failing end-to-end test/verification script**

```bash
# script should fail before full wiring
pnpm --filter @ai-gateway/ws-gateway-server build
pnpm --filter @ai-gateway/local-llm-ws-client build
```

**Step 2: Run to verify failure**

Run above commands; expected initial FAIL until all package metadata/scripts are correct.

**Step 3: Add minimal wiring + runbook**

Runbook includes:
- start server
- start client
- curl examples for:
  - OpenAI chat (sync + stream)
  - OpenAI embeddings
  - OpenAI models
  - Claude messages (sync + stream)

**Step 4: Verify green**

Run:
- `pnpm --filter @ai-gateway/ws-gateway-server test`
- `pnpm --filter @ai-gateway/local-llm-ws-client test`
- `pnpm --filter @ai-gateway/ws-gateway-server build`
- `pnpm --filter @ai-gateway/local-llm-ws-client build`

Expected: PASS for all tests/builds.

**Step 5: Commit**

```bash
git add pnpm-workspace.yaml package.json docs/plans/2026-02-22-ws-llm-proxy-runbook.md
git commit -m "docs: add ws llm proxy runbook and finalize package wiring"
```

## Final Verification Checklist
- [ ] New server package compiles/tests pass.
- [ ] New client package compiles/tests pass.
- [ ] OpenAI chat works sync + stream.
- [ ] OpenAI embeddings works.
- [ ] OpenAI models is dynamically aggregated from connected clients.
- [ ] Claude messages works sync + stream.
- [ ] Round-robin dispatch verified with >=2 connected clients.
- [ ] Timeout/no-client/disconnect error paths verified.
- [ ] Existing legacy packages remain untouched.

