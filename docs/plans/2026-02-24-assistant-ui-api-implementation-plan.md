# Assistant UI API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `packages/assistant-ui-api`, a NestJS API that serves `POST /api/chat` and streams assistant-ui UI messages using AI SDK and local gateway provider.

**Architecture:** Add a small Nest module with a controller/service split. Controller validates and streams HTTP response via Express `Response`. Service builds and executes `streamText` calls using OpenAI-compatible provider at localhost:4141 and returns a UI message stream.

**Tech Stack:** NestJS, TypeScript, Jest, AI SDK (`ai`, `@ai-sdk/openai`).

---

### Task 1: Scaffold package and app bootstrap

**Files:**
- Create: `packages/assistant-ui-api/package.json`
- Create: `packages/assistant-ui-api/tsconfig.json`
- Create: `packages/assistant-ui-api/src/main.ts`
- Create: `packages/assistant-ui-api/src/app.module.ts`

**Step 1: Write failing test**
- Not applicable for initial scaffolding.

**Step 2: Create minimal package and bootstrap files**
- Add scripts: `build`, `dev`, `test`.
- Add Nest and TypeScript dependencies.

**Step 3: Verify build command wiring**
Run: `pnpm --filter @ai-gateway/assistant-ui-api build`
Expected: TypeScript build succeeds after remaining files are added.

### Task 2: Add service TDD for streamText integration

**Files:**
- Create: `packages/assistant-ui-api/src/services/chat.service.ts`
- Create: `packages/assistant-ui-api/src/__tests__/chat.service.test.ts`

**Step 1: Write failing test**
- Assert `streamText` called with converted model messages, tools, and `stopWhen: stepCountIs(2)`.

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @ai-gateway/assistant-ui-api test -- chat.service.test.ts`
Expected: FAIL because service not implemented.

**Step 3: Write minimal implementation**
- Build provider client to localhost:4141.
- Implement service method returning `toUIMessageStream()` result.

**Step 4: Run test to verify it passes**
Run: same command
Expected: PASS.

### Task 3: Add controller TDD for validation and response piping

**Files:**
- Create: `packages/assistant-ui-api/src/controllers/chat.controller.ts`
- Create: `packages/assistant-ui-api/src/__tests__/chat.controller.test.ts`

**Step 1: Write failing tests**
- Reject invalid `messages` with `BadRequestException`.
- On valid input, call service and `pipeUIMessageStreamToResponse`.

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @ai-gateway/assistant-ui-api test -- chat.controller.test.ts`
Expected: FAIL because controller missing.

**Step 3: Write minimal implementation**
- Add `@Post('chat')` route under `@Controller('api')`.
- Validate `messages` array.
- Pipe returned stream to response.

**Step 4: Run test to verify it passes**
Run: same command
Expected: PASS.

### Task 4: Wire module and document usage

**Files:**
- Modify: `packages/assistant-ui-api/src/app.module.ts`
- Create: `packages/assistant-ui-api/README.md`

**Step 1: Register controller/service in module**
- Include in Nest module metadata.

**Step 2: Add README example for assistant-ui fetch usage**
- Include endpoint, sample body, and local env defaults.

### Task 5: Final verification

**Files:**
- Modify as needed from previous tasks.

**Step 1: Run package tests**
Run: `pnpm --filter @ai-gateway/assistant-ui-api test`
Expected: PASS.

**Step 2: Run package build**
Run: `pnpm --filter @ai-gateway/assistant-ui-api build`
Expected: PASS.
