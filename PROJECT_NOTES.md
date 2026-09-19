# BridgeOS project notes

## Product concept

BridgeOS is a voice-native relationship memory for high-context environments such as hackathons and conferences. It turns conversations, notes, and documents into a living map of people, topics, commitments, opportunities, and useful next actions.

The MVP is deliberately narrow: capture one conversation, watch it change the relationship graph and ranked next actions, ask questions across multiple memories, and draft a contextual follow-up or introduction.

## Architecture decisions

- Single-page static web app for the fastest reliable hackathon demo.
- Structured in-browser demo data models people, conversations, topics, commitments, and evidence.
- A deterministic local reasoning layer keeps the full demo working without API keys; ingesting the sample conversation now mutates people, conversations, relationship counts, answers, and ranked next actions.
- Relationship answers show their supporting memories so the experience feels grounded rather than like generic chat.
- No authentication or backend persistence in the first slice.

## Sponsor integration status

- Substantive product alignment: Meta’s human-connection thesis is embodied in relationship recall, suggested reconnections, and the two-person introduction workflow.
- Substantive build contribution: Codex scoped the MVP, implemented it, found the broken post-capture payoff through a screenshot audit, and repaired the full state-change path.
- Interactive but mocked: Deepgram voice capture/transcription and Dropbox document ingestion have clear UI entry points, but do not call live APIs yet.
- Planned only: ElevenLabs voice agent, OpenAI extraction/reasoning, and Elasticsearch retrieval are not connected in the static demo.

## Still mocked

- Audio recording, transcription, diarization, and spoken agent responses.
- Dropbox file picker and ingestion.
- LLM extraction/reasoning, embeddings, and Elasticsearch retrieval.
- Durable storage and real message sending.

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
