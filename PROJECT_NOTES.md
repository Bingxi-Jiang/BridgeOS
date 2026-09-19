# BridgeOS project notes

## Product concept

BridgeOS is a voice-native relationship memory for high-context environments such as hackathons and conferences. It turns conversations, notes, and documents into a living map of people, topics, commitments, opportunities, and useful next actions.

The MVP is deliberately narrow: capture one conversation, understand the relationship context, ask questions across multiple memories, and draft a contextual follow-up or introduction.

## Architecture decisions

- Single-page static web app for the fastest reliable hackathon demo.
- Structured in-browser demo data models people, conversations, topics, commitments, and evidence.
- A deterministic local reasoning layer keeps the full demo working without API keys; production adapters can replace it without changing the user flow.
- Relationship answers show their supporting memories so the experience feels grounded rather than like generic chat.
- No authentication or backend persistence in the first slice.

## Sponsor integrations

- Deepgram: represented as the intended real-time transcription and diarization source; voice capture currently runs in demo mode.
- Dropbox: represented as a document memory source and picker entry point; the live API is not connected yet.
- ElevenLabs: the product flow is designed for a conversational voice agent with memory tools; live agent audio is not connected yet.
- OpenAI: planned as the extraction, entity resolution, recommendation, and tool-reasoning layer; the current demo uses local deterministic reasoning.
- Elastic: planned as hybrid searchable storage for people, conversations, documents, topics, and commitments; not connected in the static demo.
- Meta: product story and introduction flow focus on strengthening human connections rather than transactional contact collection.

## Still mocked

- Audio recording, transcription, diarization, and spoken agent responses.
- Dropbox file picker and ingestion.
- LLM extraction/reasoning, embeddings, and Elasticsearch retrieval.
- Durable storage and real message sending.

## Demo steps

1. Start on the evening brief and show the three ranked next actions.
2. Ask “Who mentioned software engineering opportunities?” and open the evidence-backed answer.
3. Use Capture memory to process the sample conversation with Amara from Vercel.
4. Open Lena from the relationship map and show what to ask next.
5. Draft Theo’s contextual follow-up or introduce Mina and Ravi.
6. Tap the microphone to demonstrate the intended voice-native query loop.

## How Codex helped

- Translated a broad sponsor brief into a coherent, aggressively scoped MVP.
- Designed and implemented the complete working interaction model and responsive UI.
- Created realistic cross-conversation seed data and evidence-backed reasoning paths for the judging demo.
- Added demo-safe fallbacks so the core story remains reliable without sponsor credentials.
