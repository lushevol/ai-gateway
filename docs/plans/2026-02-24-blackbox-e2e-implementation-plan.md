# Black-Box OpenAI/Claude E2E Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add black-box process-level E2E tests for OpenAI/Claude gateway APIs, including stream/non-stream usage and OpenAI Vercel AI SDK tool-calling.

**Architecture:** Add a dedicated E2E test project under `packages/ws-gateway-server/e2e` that starts real gateway and websocket client child processes, targets `copilot-api` on `http://127.0.0.1:4141`, and verifies HTTP/SSE behavior through actual network boundaries. Add helper utilities for process lifecycle, readiness checks, HTTP/SSE parsing, and Vercel AI SDK calls through gateway.

**Tech Stack:** Jest + TypeScript (`ts-jest`), Node child processes, Node `fetch`, SSE parsing helpers, Vercel `ai` + `@ai-sdk/openai`.

---

### Task 1: Create E2E project scaffolding

**Files:**
- Create: `packages/ws-gateway-server/e2e/package.json`
- Create: `packages/ws-gateway-server/e2e/tsconfig.json`
- Create: `packages/ws-gateway-server/e2e/jest.config.ts`
- Modify: `pnpm-workspace.yaml`

**Step 1: Write the failing test**
```ts
// packages/ws-gateway-server/e2e/tests/smoke.test.ts
test('e2e scaffold boots test runtime', () => {
  expect(true).toBe(false);
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @ai-gateway/ws-gateway-server-e2e test`
Expected: FAIL with `Expected: false Received: true`

**Step 3: Write minimal implementation**
Create project config and switch test expectation to true.

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @ai-gateway/ws-gateway-server-e2e test`
Expected: PASS for scaffold test.

**Step 5: Commit**
```bash
git add pnpm-workspace.yaml packages/ws-gateway-server/e2e
git commit -m "test: scaffold ws-gateway-server e2e project"
```

### Task 2: Add process harness utilities (gateway + ws client)

**Files:**
- Create: `packages/ws-gateway-server/e2e/src/harness/process.ts`
- Create: `packages/ws-gateway-server/e2e/src/harness/wait.ts`
- Create: `packages/ws-gateway-server/e2e/src/harness/http.ts`
- Create: `packages/ws-gateway-server/e2e/tests/process-harness.test.ts`

**Step 1: Write the failing test**
```ts
test('process harness can start and stop gateway/client and detect readiness', async () => {
  const harness = await startHarness();
  await expect(waitForGatewayReady(harness.baseUrl)).resolves.toBeUndefined();
  await stopHarness(harness);
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @ai-gateway/ws-gateway-server-e2e test -- process-harness`
Expected: FAIL because `startHarness`/`waitForGatewayReady` are missing.

**Step 3: Write minimal implementation**
Implement child-process spawn, bounded polling, and teardown.

**Step 4: Run test to verify it passes**
Run: same command
Expected: PASS.

**Step 5: Commit**
```bash
git add packages/ws-gateway-server/e2e/src/harness packages/ws-gateway-server/e2e/tests/process-harness.test.ts
git commit -m "test: add e2e process harness for gateway and ws client"
```

### Task 3: Add direct HTTP API E2E tests (non-stream)

**Files:**
- Create: `packages/ws-gateway-server/e2e/tests/openai-claude-nonstream.e2e.test.ts`
- Modify: `packages/ws-gateway-server/e2e/src/harness/http.ts`

**Step 1: Write the failing test**
Create failing tests for:
- `GET /v1/models`
- `POST /v1/embeddings`
- `POST /v1/chat/completions` non-stream
- `POST /v1/messages` non-stream

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @ai-gateway/ws-gateway-server-e2e test -- nonstream`
Expected: FAIL on response shape assertions.

**Step 3: Write minimal implementation**
Implement request helpers and adjust assertions to exact gateway payload contracts.

**Step 4: Run test to verify it passes**
Run: same command
Expected: PASS.

**Step 5: Commit**
```bash
git add packages/ws-gateway-server/e2e/tests/openai-claude-nonstream.e2e.test.ts packages/ws-gateway-server/e2e/src/harness/http.ts
git commit -m "test: add non-stream e2e coverage for openai and claude endpoints"
```

### Task 4: Add stream E2E tests with SSE parsing

**Files:**
- Create: `packages/ws-gateway-server/e2e/src/harness/sse.ts`
- Create: `packages/ws-gateway-server/e2e/tests/openai-claude-stream.e2e.test.ts`

**Step 1: Write the failing test**
Create failing tests for:
- OpenAI chat stream includes `chat.completion.chunk` and terminal `[DONE]`
- Claude messages stream includes `event:`/`data:` and terminal `message_stop`

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @ai-gateway/ws-gateway-server-e2e test -- stream.e2e`
Expected: FAIL on frame parsing/assertions.

**Step 3: Write minimal implementation**
Implement robust SSE parsing and normalize frames for deterministic assertions.

**Step 4: Run test to verify it passes**
Run: same command
Expected: PASS.

**Step 5: Commit**
```bash
git add packages/ws-gateway-server/e2e/src/harness/sse.ts packages/ws-gateway-server/e2e/tests/openai-claude-stream.e2e.test.ts
git commit -m "test: add stream e2e coverage for openai and claude"
```

### Task 5: Add Vercel AI SDK OpenAI compatibility tests (incl. tool calling)

**Files:**
- Modify: `packages/ws-gateway-server/e2e/package.json`
- Create: `packages/ws-gateway-server/e2e/tests/vercel-ai-openai.e2e.test.ts`

**Step 1: Write the failing test**
Add failing tests for:
- `generateText` non-stream via gateway OpenAI chat-completions
- `streamText` streaming via gateway
- weather tool call: user asks weather today in NY; tool is invoked with NY args; final text includes tool result

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @ai-gateway/ws-gateway-server-e2e test -- vercel-ai-openai`
Expected: FAIL before SDK dependencies/config are wired.

**Step 3: Write minimal implementation**
Add `ai`, `@ai-sdk/openai`, `zod` and configure provider with gateway `baseURL`.

**Step 4: Run test to verify it passes**
Run: same command
Expected: PASS.

**Step 5: Commit**
```bash
git add packages/ws-gateway-server/e2e/package.json packages/ws-gateway-server/e2e/tests/vercel-ai-openai.e2e.test.ts
git commit -m "test: add vercel ai sdk openai e2e including tool-call scenario"
```

### Task 6: Verify full suite and document execution

**Files:**
- Create: `packages/ws-gateway-server/e2e/README.md`

**Step 1: Write the failing test**
N/A (verification/documentation task).

**Step 2: Run test to verify it fails**
N/A.

**Step 3: Write minimal implementation**
Document prerequisites (`copilot-api` on `127.0.0.1:4141`), run command, and troubleshooting.

**Step 4: Run test to verify it passes**
Run:
- `pnpm --filter @ai-gateway/ws-gateway-server-e2e test`
Expected: PASS all tests.

**Step 5: Commit**
```bash
git add packages/ws-gateway-server/e2e/README.md
git commit -m "docs: add e2e runbook for gateway black-box tests"
```
