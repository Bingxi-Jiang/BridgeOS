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
