# Assistant UI API Design

**Context**
- Build a new NestJS package under `packages/`.
- Expose an assistant-ui compatible streaming API.
- Use local gateway endpoint at `http://127.0.0.1:4141`.

## API Contract
- Endpoint: `POST /api/chat`
- Body:
  - `messages` (required): assistant-ui messages
  - `model` (optional): defaults to `gpt-4o-mini`
  - `system` (optional)
  - `temperature` (optional)
- Response: streamed UI message output consumable by assistant-ui.

## Streaming Pipeline
- Provider: `@ai-sdk/openai` via `createOpenAI`.
- Base URL: `http://127.0.0.1:4141/v1`.
- Request processing:
  - Convert incoming UI messages using `convertToModelMessages(messages)`.
  - Call `streamText` with:
    - `model`
    - `system`
    - `messages`
    - `tools`
    - `stopWhen: stepCountIs(2)`
    - `temperature`
- Response processing:
  - Use `toUIMessageStream()`.
  - Pipe with `pipeUIMessageStreamToResponse({ response: res, stream })`.

## Tools
- Define server-controlled tools in the stream layer.
- Start with safe minimal examples suitable for local development.

## Validation and Errors
- Return `400` when `messages` is missing or not an array.
- Pre-stream exceptions return JSON error.
- Stream-level errors are delegated to the SDK stream handling.

## Testing
- Service tests assert `streamText` invocation includes:
  - `convertToModelMessages(messages)` result
  - `tools`
  - `stopWhen: stepCountIs(2)`
- Controller tests assert:
  - input validation
  - service invocation
  - `pipeUIMessageStreamToResponse` called with response + stream
