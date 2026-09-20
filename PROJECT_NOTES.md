# BridgeOS project notes

## Product concept

BridgeOS is a voice-native relationship memory for high-context environments such as hackathons and conferences. It turns conversations, notes, and documents into a living map of people, topics, commitments, opportunities, and useful next actions.

The MVP is deliberately narrow: capture one conversation, watch it change the relationship graph and ranked next actions, ask questions across multiple memories, and draft a contextual follow-up or introduction.

## Architecture decisions

- Dependency-free Node.js HTTP backend serves the existing single-page interface and owns all new memory extraction, persistence, grounded Q&A, and follow-up drafting.
- Captured memories are stored atomically in `data/memory-store.json`; the file is configurable through `.env` and ignored by Git.
- When `OPENAI_API_KEY` is set, the backend uses the OpenAI Responses API with strict JSON schemas for extraction, answers, and drafts.
- Without a key, an explicitly labeled local fallback keeps the same HTTP and persistence path working for reliable rehearsals.
- `RESET_STORE_ON_START=true` gives each server start a clean judging state while still proving refresh persistence during the demo.
- Relationship answers show their supporting memories so the experience feels grounded rather than like generic chat.

## Sponsor integration status

- Substantive product alignment: Meta’s human-connection thesis is embodied in relationship recall, suggested reconnections, and the two-person introduction workflow.
- Substantive build contribution: Codex scoped the MVP, implemented it, found the broken post-capture payoff through a screenshot audit, and repaired the full state-change path.
- Implemented and credential-gated: OpenAI extraction, reasoning, and drafting run through the Responses API when `OPENAI_API_KEY` is present in `.env`. The header exposes the active backend mode.
- Interactive but mocked: Deepgram voice capture/transcription and Dropbox document ingestion have clear UI entry points, but do not call live APIs yet.
- Planned only: ElevenLabs voice agent and Elasticsearch retrieval are not connected.

## Still mocked

- Audio recording, transcription, diarization, and spoken agent responses.
- Dropbox file picker and ingestion.
- Embeddings and Elasticsearch retrieval.
- Authentication, multi-user storage, and real message sending.

## Demo steps

1. Start on the evening brief and establish that BridgeOS already knows the user’s people, commitments, and event deadline.
2. Capture the sample conversation with Amara from Vercel and show the extracted person, topics, commitment, and opportunity.
3. Click “See what this changed” to reveal the recalculated top recommendation and the three-source reasoning trace.
4. Ask “What changed after meeting Amara?” and show the evidence-backed answer.
5. Draft Amara’s contextual follow-up, including the promised demo and warm-introduction ask.

## How Codex helped

- Translated a broad sponsor brief into a coherent, aggressively scoped MVP.
- Designed and implemented the complete working interaction model and responsive UI.
- Created realistic cross-conversation seed data and evidence-backed reasoning paths for the judging demo.
- Added demo-safe fallbacks so the core story remains reliable without sponsor credentials.
- Audited the judge flow from captured screens and fixed the highest-risk credibility gap: captured memory now visibly changes the product state and recommendation.
