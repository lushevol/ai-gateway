# assistant-ui-api

NestJS API for assistant-ui streaming chat.

## Run

```bash
pnpm --filter @ai-gateway/assistant-ui-api dev
```

Default server: `http://127.0.0.1:1313`

## Endpoint

- `POST /api/chat`

Body:

```json
{
  "messages": [{ "id": "1", "role": "user", "parts": [{ "type": "text", "text": "Hello" }] }],
  "model": "gpt-4o-mini",
  "system": "You are helpful",
  "temperature": 0.2
}
```

It streams assistant-ui compatible UI message chunks.

## Env

- `COPILOT_API_BASE_URL` default: `http://127.0.0.1:4141/v1`
- `COPILOT_API_KEY` default: `dummy`
