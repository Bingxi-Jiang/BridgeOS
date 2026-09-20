import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createBridgeServer } from "../server.mjs";

test("backend persists a captured memory and grounds later answers", async t => {
  const temp = await mkdtemp(path.join(tmpdir(), "bridgeos-"));
  const { server } = await createBridgeServer({
    rootDir: path.resolve(import.meta.dirname, ".."),
    env: { OPENAI_API_KEY: "", RESET_STORE_ON_START: "true", DATA_FILE: path.join(temp, "store.json") }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(temp, { recursive: true, force: true });
  });
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${origin}/api/health`).then(response => response.json());
  assert.deepEqual({ ok: health.ok, mode: health.mode, persistent: health.persistent }, { ok: true, mode: "local", persistent: true });

  const createdResponse = await fetch(`${origin}/api/memories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript: "I met Amara Chen from Vercel. She offered an introduction to a tool-calling engineer, and I promised to send our demo after judging." })
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.stored, true);
  assert.equal(created.memory.personName, "Amara Chen");

  const state = await fetch(`${origin}/api/state`).then(response => response.json());
  assert.equal(state.memories.length, 1);
  assert.equal(state.peopleCount, 7);

  const answer = await fetch(`${origin}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "What changed after meeting Amara?" })
  }).then(response => response.json());
  assert.match(answer.answer.title, /Amara/);
  assert.ok(answer.answer.evidence.some(item => item.includes("Commitment")));
});

test("OPENAI_API_KEY activates the Responses API structured-output path", async t => {
  const temp = await mkdtemp(path.join(tmpdir(), "bridgeos-openai-"));
  let outbound;
  const openAIFetch = async (url, options) => {
    outbound = { url, options, body: JSON.parse(options.body) };
    const extraction = {
      personName: "Avery Stone",
      role: "Developer Advocate",
      company: "ExampleAI",
      summary: "Works on developer tooling and offered product feedback.",
      topics: ["developer tools", "AI"],
      commitment: "Send the demo tomorrow",
      opportunity: "Product feedback session",
      nextAction: "Send Avery the demo tomorrow",
      recommendationReason: "The conversation produced a concrete, time-bound commitment.",
      fitScore: 91,
      conversationTitle: "Developer tooling with Avery",
      conversationDetail: "AI developer tools and a promised demo"
    };
    return new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(extraction) }] }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const { server } = await createBridgeServer({
    rootDir: path.resolve(import.meta.dirname, ".."),
    openAIFetch,
    env: { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "gpt-5-mini", RESET_STORE_ON_START: "true", DATA_FILE: path.join(temp, "store.json") }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(temp, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const created = await fetch(`${origin}/api/memories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript: "I spoke with Avery Stone at ExampleAI about developer tools and promised to send the demo tomorrow." })
  }).then(response => response.json());

  assert.equal(created.provider, "openai");
  assert.equal(created.memory.personName, "Avery Stone");
  assert.equal(outbound.url, "https://api.openai.com/v1/responses");
  assert.equal(outbound.options.headers.Authorization, "Bearer test-key");
  assert.equal(outbound.body.model, "gpt-5-mini");
  assert.equal(outbound.body.text.format.type, "json_schema");
  assert.equal(outbound.body.text.format.strict, true);
});

test("MODEL_API_KEY activates Meta Model API with the same structured memory contract", async t => {
  const temp = await mkdtemp(path.join(tmpdir(), "bridgeos-meta-"));
  let outbound;
  const modelFetch = async (url, options) => {
    outbound = { url, options, body: JSON.parse(options.body) };
    const extraction = {
      personName: "Morgan Li", role: "Engineer", company: "Meta", summary: "Builds tools that help small groups stay connected.", topics: ["human connection", "AI"], commitment: "Share the demo", opportunity: "Introduce two builders", nextAction: "Send Morgan the demo", recommendationReason: "The project directly supports stronger human connections.", fitScore: 93, conversationTitle: "Human connection with Morgan", conversationDetail: "Relationship memory and useful introductions"
    };
    return new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(extraction) }] }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const { server } = await createBridgeServer({
    rootDir: path.resolve(import.meta.dirname, ".."),
    modelFetch,
    env: { MODEL_API_KEY: "meta-test-key", META_MODEL: "muse-spark-1.3", AI_PROVIDER: "meta", RESET_STORE_ON_START: "true", DATA_FILE: path.join(temp, "store.json") }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(temp, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const created = await fetch(`${origin}/api/memories`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: "I met Morgan Li from Meta and promised to share our relationship-memory demo." })
  }).then(response => response.json());
  assert.equal(created.provider, "meta");
  assert.equal(outbound.url, "https://api.meta.ai/v1/responses");
  assert.equal(outbound.options.headers.Authorization, "Bearer meta-test-key");
  assert.equal(outbound.body.model, "muse-spark-1.3");
  assert.equal(outbound.body.text.format.type, "json_schema");
});

test("Deepgram, Elastic, Dropbox, and ElevenLabs routes use configured sponsor APIs", async t => {
  const temp = await mkdtemp(path.join(tmpdir(), "bridgeos-sponsors-"));
  const calls = [];
  const serviceFetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.startsWith("https://api.deepgram.com/v1/listen")) return new Response(JSON.stringify({ results: { channels: [{ alternatives: [{ transcript: "I met Amara from Vercel and promised to send the demo.", confidence: 0.97 }] }], utterances: [{ speaker: 0, transcript: "I met Amara from Vercel." }, { speaker: 1, transcript: "I promised to send the demo." }] } }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("/_doc/")) return new Response(JSON.stringify({ result: "created", _id: "memory-1" }), { status: 201, headers: { "Content-Type": "application/json" } });
    if (url.endsWith("/_search")) return new Response(JSON.stringify({ hits: { hits: [{ _id: "memory-1", _score: 4.2, _source: { personName: "Amara Chen", personId: "amara-chen", summary: "Vercel developer experience", topics: ["tool calling"] } }] } }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url === "https://api.dropboxapi.com/2/files/list_folder") return new Response(JSON.stringify({ entries: [{ ".tag": "file", id: "id:1", name: "hackmit-notes.md", path_lower: "/hackmit-notes.md", size: 1200 }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url === "https://content.dropboxapi.com/2/files/download") return new Response("Met Amara from Vercel and discussed tool calling.", { status: 200, headers: { "Content-Type": "application/octet-stream" } });
    if (url.startsWith("https://api.elevenlabs.io/v1/convai/conversation/get-signed-url")) return new Response(JSON.stringify({ signed_url: "wss://api.elevenlabs.io/v1/convai/conversation?token=test" }), { status: 200, headers: { "Content-Type": "application/json" } });
    throw new Error(`Unexpected sponsor URL: ${url}`);
  };
  const { server } = await createBridgeServer({
    rootDir: path.resolve(import.meta.dirname, ".."),
    serviceFetch,
    env: {
      OPENAI_API_KEY: "", MODEL_API_KEY: "", DEEPGRAM_API_KEY: "dg-test", ELASTICSEARCH_URL: "https://elastic.example", ELASTIC_API_KEY: "elastic-test", DROPBOX_ACCESS_TOKEN: "dropbox-test", ELEVENLABS_API_KEY: "eleven-test", ELEVENLABS_AGENT_ID: "agent-test", RESET_STORE_ON_START: "true", DATA_FILE: path.join(temp, "store.json")
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(temp, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${server.address().port}`;

  const memory = await fetch(`${origin}/api/memories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: "I met Amara Chen from Vercel and promised to send the demo after judging." }) }).then(response => response.json());
  assert.equal(memory.elastic.status, "indexed");
  const answer = await fetch(`${origin}/api/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "What changed after meeting Amara?" }) }).then(response => response.json());
  assert.equal(answer.retrieval, "elastic");

  const transcription = await fetch(`${origin}/api/deepgram/transcribe`, { method: "POST", headers: { "Content-Type": "audio/webm" }, body: Buffer.from("fake-audio") }).then(response => response.json());
  assert.match(transcription.transcript, /Speaker 1/);
  const files = await fetch(`${origin}/api/dropbox/files`).then(response => response.json());
  assert.equal(files.files[0].name, "hackmit-notes.md");
  const imported = await fetch(`${origin}/api/dropbox/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: "/hackmit-notes.md" }) }).then(response => response.json());
  assert.match(imported.text, /Amara/);
  const signed = await fetch(`${origin}/api/elevenlabs/signed-url`).then(response => response.json());
  assert.match(signed.signedUrl, /^wss:/);

  assert.ok(calls.some(call => call.options.headers?.Authorization === "Token dg-test"));
  assert.ok(calls.some(call => call.options.headers?.Authorization === "ApiKey elastic-test"));
  assert.ok(calls.some(call => call.options.headers?.Authorization === "Bearer dropbox-test"));
  assert.ok(calls.some(call => call.options.headers?.["xi-api-key"] === "eleven-test"));
});
