# WebSocket LLM Proxy Design

**Date:** 2026-02-22  
**Status:** Approved

## 1. Goal
Build two new packages:
- A globally exposed HTTP API gateway service that is OpenAI/Claude-compatible.
- A websocket client runtime that runs on user machines and proxies requests to local LLM APIs (e.g. copilot-api).

The old logic in existing packages remains untouched.

## 2. Requirements
- Create two new packages (do not reuse previous logic).
- Server exposes OpenAI-compatible and Claude-compatible HTTP APIs.
- Server proxies all inference requests to websocket clients.
- Websocket clients call local LLM endpoints and return results.
- Support both non-streaming and streaming responses.
- No auth on HTTP routes for v1.
- Dispatch policy across online clients: round-robin.
- OpenAI support must include models and embeddings.
- `/v1/models` must be dynamically aggregated from connected clients.

## 3. Chosen Approach
Approach 1: **Raw protocol bridge** (recommended and approved)

The server normalizes OpenAI/Claude HTTP requests to one internal websocket job protocol. Clients execute jobs against local APIs and stream/result back using provider-agnostic events. Server then rehydrates provider-specific HTTP responses.

## 4. Package Architecture

### 4.1 `packages/ws-gateway-server`
NestJS app with:
- HTTP controllers:
  - OpenAI: `POST /v1/chat/completions`, `POST /v1/embeddings`, `GET /v1/models`
  - Claude: `POST /v1/messages`
- SSE support for streaming variants.
- Socket.IO gateway for client sessions.
- Services:
  - `ClientRegistryService`: online clients, heartbeat, round-robin cursor.
  - `ProxyTaskService`: task lifecycle, timeout, correlation, stream/session state.
  - `ProviderAdapterService`: OpenAI/Claude in/out conversion.
  - `ModelsAggregationService`: fan-out model discovery and dedup.

### 4.2 `packages/local-llm-ws-client`
Node websocket client with:
- Socket.IO connection and register/heartbeat.
- Task handlers for sync and stream modes.
- Local API adapter that calls configured local endpoint.
- Stream parser/forwarder for upstream SSE.

## 5. Internal WebSocket Protocol

### 5.1 Registration and liveness
- `client:register` (client -> server)
  - `{ clientName, version, localBaseUrl, capabilities }`
- `client:heartbeat` (client -> server)
  - `{ ts }`

### 5.2 Task execution
- `task:create` (server -> client)
  - `{ taskId, provider, taskType, responseMode, request }`
- `task:chunk` (client -> server, streaming)
  - `{ taskId, chunkIndex, chunk, providerHint }`
- `task:complete` (client -> server)
  - `{ taskId, result, usage?, finishReason? }`
- `task:error` (client -> server)
  - `{ taskId, code, message, retriable }`

### 5.3 Model discovery
- `models:request` (server -> client)
  - `{ requestId }`
- `models:response` (client -> server)
  - `{ requestId, models: [{ id, owned_by?, context_window?, embedding? }] }`

## 6. Request Lifecycles

### 6.1 Non-streaming
Applies to OpenAI chat, OpenAI embeddings, Claude messages when `stream=false`.
1. HTTP request enters provider adapter.
2. Server normalizes to internal `ProxyTask`.
3. Round-robin client selected.
4. Server emits `task:create` and waits with timeout.
5. Client calls local LLM endpoint and returns `task:complete` or `task:error`.
6. Server converts normalized response back to provider HTTP JSON.

### 6.2 Streaming
Applies to OpenAI chat / Claude messages when `stream=true`.
1. Same dispatch, with `responseMode=stream`.
2. HTTP handler starts SSE response.
3. Client emits incremental `task:chunk` events.
4. Server maps chunks to provider SSE format.
5. Client emits `task:complete`; server sends terminal event and closes.
6. On timeout/error, server sends provider-compatible SSE error event and closes.

### 6.3 Dynamic OpenAI models
`GET /v1/models`:
1. Server fans out `models:request` to all online clients with short timeout.
2. Clients return local model lists.
3. Server deduplicates by model id and returns OpenAI list object.

## 7. Error and Timeout Policy
- No online clients: HTTP `503` provider-compatible error body.
- Client disconnect during task: HTTP `502` (or SSE error event then close).
- Task timeout (default 120s configurable): HTTP `504`.
- No retries in v1 to keep generation semantics predictable.

## 8. Configuration

### 8.1 Server
- `PORT` (default 3000)
- `WS_NAMESPACE` (default `/llm-proxy`)
- `TASK_TIMEOUT_MS` (default 120000)
- `HEARTBEAT_TTL_MS` (default 180000)
- `MODELS_QUERY_TIMEOUT_MS` (default 2000)

### 8.2 Client
- `GATEWAY_WS_URL` (required)
- `GATEWAY_WS_NAMESPACE` (default `/llm-proxy`)
- `LOCAL_LLM_BASE_URL` (required)
- `LOCAL_LLM_TIMEOUT_MS` (default 120000)
- `CLIENT_NAME` (default hostname)
- `CLIENT_HEARTBEAT_INTERVAL_MS` (default 30000)

## 9. Testing Strategy

### 9.1 Server package
- Unit: round-robin selector, adapter mapping, timeout mapping.
- Integration: HTTP -> websocket mock client -> expected provider payload.
- Integration: stream bridging (SSE framing).
- Integration: models fan-out + dedup.

### 9.2 Client package
- Unit: local API adapter conversion and stream forwarding.
- Integration: websocket mock server + mocked local API (sync and stream).

### 9.3 Contract coverage
Golden tests for:
- OpenAI chat (stream/non-stream)
- OpenAI embeddings
- OpenAI models
- Claude messages (stream/non-stream)

## 10. Out of Scope (v1)
- Authentication/authorization
- Weighted/model-aware scheduling
- Automatic retries and idempotency keys
- Persistence of task history

