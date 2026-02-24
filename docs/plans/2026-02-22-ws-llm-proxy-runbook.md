# WS LLM Proxy Runbook

## Start services

1. Start gateway server:
```bash
pnpm --filter @ai-gateway/ws-gateway-server dev
```

2. Start local websocket client:
```bash
GATEWAY_WS_URL=http://127.0.0.1:1212 \
GATEWAY_WS_NAMESPACE=/llm-proxy \
LOCAL_LLM_BASE_URL=http://127.0.0.1:11434 \
pnpm --filter @ai-gateway/local-llm-ws-client dev
```

## OpenAI Chat (non-stream)

```bash
curl -s http://127.0.0.1:1212/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Say hello"}],
    "stream": false
  }'
```

## OpenAI Chat (stream)

```bash
curl -N http://127.0.0.1:1212/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Count 1 to 3"}],
    "stream": true
  }'
```

## OpenAI Embeddings

```bash
curl -s http://127.0.0.1:1212/v1/embeddings \
  -H 'content-type: application/json' \
  -d '{
    "model": "text-embedding-3-small",
    "input": "hello world"
  }'
```

## OpenAI Models (dynamic from websocket clients)

```bash
curl -s http://127.0.0.1:1212/v1/models
```

## Claude Messages (non-stream)

```bash
curl -s http://127.0.0.1:1212/v1/messages \
  -H 'content-type: application/json' \
  -d '{
    "model": "claude-3-5-sonnet-latest",
    "messages": [{"role": "user", "content": "Say hello"}],
    "stream": false
  }'
```

## Claude Messages (stream)

```bash
curl -N http://127.0.0.1:1212/v1/messages \
  -H 'content-type: application/json' \
  -d '{
    "model": "claude-3-5-sonnet-latest",
    "messages": [{"role": "user", "content": "Count 1 to 3"}],
    "stream": true
  }'
```

## Verification commands

```bash
pnpm --filter @ai-gateway/ws-gateway-server test
pnpm --filter @ai-gateway/local-llm-ws-client test
pnpm --filter @ai-gateway/ws-gateway-server build
pnpm --filter @ai-gateway/local-llm-ws-client build
```
