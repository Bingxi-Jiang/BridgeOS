# BridgeOS

BridgeOS is a server-backed relationship-memory demo built for a focused HackMIT judging flow.

## Run it

Requirements: Node.js 20 or newer. There are no package dependencies to install.

1. Copy `.env.example` to `.env` if `.env` is missing.
2. Optionally set `OPENAI_API_KEY` in `.env` for model-backed extraction, Q&A, and follow-up drafting.
3. Start the app:

   ```powershell
   node server.mjs
   ```

4. Open [http://127.0.0.1:4174](http://127.0.0.1:4174).

The header reports **AI backend live** when an OpenAI key is configured and **Local backend** when the explicit deterministic fallback is active. The fallback still uses the real HTTP API and disk persistence; it does not make third-party API calls.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `HOST` | `127.0.0.1` | Bind address. |
| `PORT` | `4174` | HTTP port. |
| `OPENAI_API_KEY` | empty | Enables the OpenAI Responses API path. Keep this server-side. |
| `OPENAI_MODEL` | `gpt-5-mini` | Model used for structured extraction, grounded answers, and drafts. |
| `DATA_FILE` | `./data/memory-store.json` | JSON persistence path. |
| `RESET_STORE_ON_START` | `true` | Starts every server run from a clean judge-demo state. Set `false` for durable restarts. |

## API

- `GET /api/health` — backend mode and readiness.
- `GET /api/state` — persisted memories and derived counts.
- `POST /api/memories` — extract and persist relationship memory from a transcript.
- `POST /api/ask` — answer a question using seeded and captured memories.
- `POST /api/drafts` — draft a follow-up grounded in the selected person’s memory.

## Verify it

```powershell
node --check server.mjs
node --check dist/app.js
node --test
```

The tests exercise persistence, grounded retrieval, and the OpenAI structured-output request path without requiring a real API key.
