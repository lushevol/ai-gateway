# OpenAI/Claude Black-Box E2E Design

## Goal
Add full end-to-end test coverage for gateway OpenAI/Claude APIs in true black-box mode, including streaming and non-streaming behavior, plus Vercel AI SDK compatibility and OpenAI tool-calling.

## Scope
- OpenAI endpoints:
  - `GET /v1/models`
  - `POST /v1/embeddings`
  - `POST /v1/chat/completions` (stream and non-stream)
- Claude endpoint:
  - `POST /v1/messages` (stream and non-stream)
- Vercel AI SDK coverage (OpenAI chat-completions path only):
  - non-stream smoke
  - stream smoke
  - tool-call scenario (weather tool, user asks weather today in NY)

## Runtime Assumptions
- `copilot-api` is already running on `http://127.0.0.1:4141`.
- E2E suite owns process lifecycle for:
  - `@ai-gateway/ws-gateway-server`
  - `@ai-gateway/local-llm-ws-client`
- Tests use real HTTP and websocket transport (no controller/service mocks).

## Architecture
- Create a dedicated E2E runner under `packages/ws-gateway-server/e2e/`.
- E2E harness starts child processes for gateway and ws client.
- Harness waits for readiness by polling gateway endpoints.
- Tests perform real HTTP requests to gateway and parse SSE for stream assertions.
- Harness hard-kills child processes in teardown to avoid orphan processes.

## Test Matrix
1. `GET /v1/models` returns OpenAI model list shape.
2. `POST /v1/embeddings` returns embedding list with vectors and usage.
3. `POST /v1/chat/completions` non-stream returns valid completion payload.
4. `POST /v1/chat/completions` stream returns chunk frames and terminal `[DONE]`.
5. `POST /v1/messages` non-stream returns Anthropic message payload.
6. `POST /v1/messages` stream returns `event:`/`data:` SSE and terminal stop event.
7. Vercel AI SDK OpenAI non-stream smoke through gateway.
8. Vercel AI SDK OpenAI stream smoke through gateway.
9. Vercel AI SDK OpenAI tool-call case:
   - define `getWeather` tool
   - user asks for weather today in NY
   - assert tool invocation args reference NY
   - assert final text contains the tool result

## Error Handling and Stability
- Use bounded readiness and request timeouts.
- Assert on parsed SSE frames, not only raw text, to reduce flakiness.
- Include robust teardown with SIGTERM + timeout fallback.
- Keep tests deterministic and independent.

## Out of Scope
- Claude tool-calling through AI SDK.
- Mock-only/in-process controller tests.
