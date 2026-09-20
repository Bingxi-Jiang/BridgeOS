# BridgeOS

BridgeOS is a server-backed relationship-memory demo built for a focused HackMIT judging flow.

## Run it

Requirements: Node.js 20 or newer. There are no package dependencies to install.

1. Copy `.env.example` to `.env` if `.env` is missing.
2. Add the sponsor credentials you want to demonstrate to `.env`. With no credentials, BridgeOS stays in an explicitly labeled local fallback mode.
3. Start the app:

   ```powershell
   node server.mjs
   ```

4. Open [http://127.0.0.1:4174](http://127.0.0.1:4174).

The header reports **Meta AI live**, **AI backend live**, or **Local backend**. The sidebar separately reports whether Deepgram, Dropbox, ElevenLabs, Elastic, and Meta are configured.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `HOST` | `127.0.0.1` | Bind address. |
| `PORT` | `4174` | HTTP port. |
| `AI_PROVIDER` | `auto` | `auto`, `meta`, or `openai`. Auto prefers Meta when both keys exist. |
| `MODEL_API_KEY` | empty | Enables Meta Model API. |
| `META_MODEL` | `muse-spark-1.3` | Meta model for structured extraction, answers, and drafts. |
| `OPENAI_API_KEY` | empty | Enables the OpenAI Responses API path. Keep this server-side. |
| `OPENAI_MODEL` | `gpt-5-mini` | Model used for structured extraction, grounded answers, and drafts. |
| `DEEPGRAM_API_KEY` | empty | Enables browser recording and diarized transcription. |
| `ELEVENLABS_API_KEY` | empty | Server credential for a private ElevenLabs Agent. |
| `ELEVENLABS_AGENT_ID` | empty | Agent used by the live voice button. |
| `ELASTICSEARCH_URL` | empty | Elasticsearch deployment URL. |
| `ELASTIC_API_KEY` | empty | Enables indexing and retrieval of captured memories. |
| `ELASTIC_INDEX` | `bridgeos-memory` | Index receiving relationship-memory documents. |
| `DROPBOX_ACCESS_TOKEN` | empty | Enables file listing and text-file download. |
| `DROPBOX_ROOT_PATH` | empty | Optional folder to use as the Dropbox import root. |
| `DATA_FILE` | `./data/memory-store.json` | JSON persistence path. |
| `RESET_STORE_ON_START` | `true` | Starts every server run from a clean judge-demo state. Set `false` for durable restarts. |

## API

- `GET /api/health` — backend mode and readiness.
- `GET /api/state` — persisted memories and derived counts.
- `POST /api/memories` — extract and persist relationship memory from a transcript.
- `POST /api/ask` — answer a question using seeded and captured memories.
- `POST /api/drafts` — draft a follow-up grounded in the selected person’s memory.
- `POST /api/deepgram/transcribe` — transcribe recorded audio with speaker turns.
- `GET /api/dropbox/files` and `POST /api/dropbox/import` — select and import Dropbox text context.
- `POST /api/elastic/search` — inspect Elastic relationship-memory retrieval.
- `GET /api/elevenlabs/signed-url` — create a private ElevenLabs Agent session without exposing its API key.
- `GET /api/integrations` — inspect sponsor configuration status.

## Sponsor setup

### Meta

Set `MODEL_API_KEY` and `AI_PROVIDER=meta`. The same extraction, reasoning, and drafting schemas will run through `https://api.meta.ai/v1/responses` using Muse Spark.

### Deepgram

Set `DEEPGRAM_API_KEY`, restart, open **Capture memory → Voice note**, record, and stop. The browser uploads the recording to the backend; Deepgram Nova transcribes and diarizes it before returning it to the normal memory-extraction step.

### Elastic

Set `ELASTICSEARCH_URL` and `ELASTIC_API_KEY`. Every captured memory is indexed with `refresh=wait_for`. Questions retrieve up to five matching relationship memories with multi-field search and pass those results into the reasoning context.

### Dropbox

Create an access token with `files.metadata.read` and `files.content.read`, then set `DROPBOX_ACCESS_TOKEN`. **Capture memory → Document → Browse Dropbox** lists files and imports `.txt`, `.md`, `.markdown`, `.json`, or `.csv` context into the normal extraction pipeline.

### ElevenLabs

Set `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID`. The microphone button requests a signed private-agent WebSocket, streams 16 kHz PCM microphone audio, plays returned PCM audio, and sends current BridgeOS memories as a contextual update.

For tool-grounded voice answers, configure a client tool named `ask_bridge_memory` on the ElevenLabs Agent with one string parameter named `question`. The browser executes that tool through `/api/ask` and returns the grounded result to the agent.

## Verify it

```powershell
node --check server.mjs
node --check dist/app.js
node --test
```

The tests exercise persistence plus the request contracts for Meta Model API, OpenAI, Deepgram, Elastic, Dropbox, and ElevenLabs without requiring real credentials.
