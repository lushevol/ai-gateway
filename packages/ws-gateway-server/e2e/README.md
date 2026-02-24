# ws-gateway-server E2E Tests

Black-box E2E coverage for gateway OpenAI/Claude APIs and Vercel AI SDK OpenAI compatibility.

## Prerequisites

- `copilot-api` is running on `http://127.0.0.1:4141`
- workspace dependencies installed (`pnpm install`)

## Run

```bash
pnpm --filter @ai-gateway/ws-gateway-server-e2e test
```

## Coverage

- OpenAI `GET /v1/models`
- OpenAI `POST /v1/embeddings`
- OpenAI `POST /v1/chat/completions` (stream + non-stream)
- Claude `POST /v1/messages` (stream + non-stream)
- Vercel AI SDK via OpenAI chat-completions:
  - `generateText` non-stream
  - `streamText` stream
  - `streamText` tool-call flow (`toolCalls` from streamed run)
  - tool-call case (`getWeather`)

## Notes

- The harness starts/stops real gateway and websocket-client processes.
- Claude and embeddings assertions accept provider capability errors mapped through gateway (`502`) when upstream rejects request format.
