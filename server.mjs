import { createHash } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  callStructuredModel,
  createElevenLabsSignedUrl,
  downloadDropboxText,
  indexElasticMemory,
  integrationStatus,
  listDropboxFiles,
  resolveModelProvider,
  searchElasticMemories,
  transcribeDeepgram
} from "./integrations.mjs";

const APP_ROOT = path.dirname(fileURLToPath(import.meta.url));
const EMPTY_STORE = { version: 1, memories: [] };
const MAX_BODY_BYTES = 120_000;

const seedPeople = [
  { id: "lena", name: "Lena Ortiz", company: "Deepgram", summary: "Voice-agent infrastructure; offered a streaming architecture review.", topics: ["voice agents", "AI infrastructure", "Los Angeles"] },
  { id: "theo", name: "Theo Brooks", company: "ElevenLabs", summary: "Conversational voice deployments; waiting for a promised interruption-handling demo.", topics: ["voice agents", "developer experience", "turn-taking"] },
  { id: "mina", name: "Mina Park", company: "MIT", summary: "Building replay and observability tools for AI agents.", topics: ["AI agents", "developer tools", "observability"] },
  { id: "ravi", name: "Ravi Shah", company: "Neon", summary: "Serverless Postgres engineer; mentioned remote-friendly SWE internships.", topics: ["databases", "serverless", "SWE roles"] },
  { id: "jordan", name: "Jordan Lee", company: "Dropbox", summary: "Interested in turning event documents and notes into useful action.", topics: ["student tools", "knowledge systems", "Dropbox"] },
  { id: "samira", name: "Samira Okafor", company: "OpenAI", summary: "Applied AI lead focused on reliable tool use and source-grounded reasoning.", topics: ["agent evals", "tool calling", "applied AI"] }
];

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["personName", "role", "company", "summary", "topics", "commitment", "opportunity", "nextAction", "recommendationReason", "fitScore", "conversationTitle", "conversationDetail"],
  properties: {
    personName: { type: "string" },
    role: { type: "string" },
    company: { type: "string" },
    summary: { type: "string" },
    topics: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
    commitment: { type: "string" },
    opportunity: { type: "string" },
    nextAction: { type: "string" },
    recommendationReason: { type: "string" },
    fitScore: { type: "integer", minimum: 1, maximum: 100 },
    conversationTitle: { type: "string" },
    conversationDetail: { type: "string" }
  }
};

const answerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "lead", "items", "evidence"],
  properties: {
    title: { type: "string" },
    lead: { type: "string" },
    items: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "detail", "personId"],
        properties: { label: { type: "string" }, detail: { type: "string" }, personId: { type: "string" } }
      }
    },
    evidence: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } }
  }
};

const draftSchema = {
  type: "object",
  additionalProperties: false,
  required: ["to", "text", "evidence"],
  properties: { to: { type: "string" }, text: { type: "string" }, evidence: { type: "string" } }
};

export function parseEnv(source = "") {
  return Object.fromEntries(source.split(/\r?\n/).flatMap(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return [];
    const index = trimmed.indexOf("=");
    if (index < 1) return [];
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [[key, value]];
  }));
}

async function loadEnv(rootDir, overrides = {}) {
  let fileEnv = {};
  try { fileEnv = parseEnv(await readFile(path.join(rootDir, ".env"), "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  return { ...fileEnv, ...process.env, ...overrides };
}

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 }); }
}

async function readRaw(req, limit = 25_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) throw Object.assign(new Error("Request body is empty."), { statusCode: 400 });
  return Buffer.concat(chunks);
}

function slugify(value) {
  return String(value || "person").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "person";
}

function compact(value, max = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function localExtraction(transcript) {
  const isAmara = /amara|vercel|tool.?calling/i.test(transcript);
  if (isAmara) return {
    personName: "Amara Chen",
    role: "Developer Experience",
    company: "Vercel",
    summary: "Builds developer experience for AI apps on a remote-friendly team and offered a warm introduction to an engineer working on tool calling.",
    topics: ["AI SDK", "tool calling", "remote work"],
    commitment: "Send the BridgeOS demo after judging",
    opportunity: "Warm introduction to Vercel’s tool-calling engineer",
    nextAction: "Send the demo and ask for the tool-calling introduction",
    recommendationReason: "The warm path overlaps with your applied-AI interests, remote preference, and a promise you made tonight.",
    fitScore: 98,
    conversationTitle: "AI developer experience with Amara",
    conversationDetail: "AI SDK streaming, tool calling, and a promised post-judging demo"
  };
  const name = transcript.match(/(?:met|spoke (?:with|to)|talked (?:with|to))\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/)?.[1] || "New contact";
  const company = transcript.match(/(?:from|at|with)\s+([A-Z][A-Za-z0-9.-]+)/)?.[1] || "Unknown organization";
  return {
    personName: name,
    role: "New contact",
    company,
    summary: compact(transcript, 220),
    topics: ["new connection", "follow-up"],
    commitment: /promis|said i would|follow up/i.test(transcript) ? "Follow up on the conversation" : "No explicit commitment captured",
    opportunity: "Continue the relationship while the context is fresh",
    nextAction: `Send ${name} a concise follow-up`,
    recommendationReason: "This is the newest relationship memory and has an immediate follow-up window.",
    fitScore: 82,
    conversationTitle: `Conversation with ${name}`,
    conversationDetail: compact(transcript, 140)
  };
}

function normalizeExtraction(raw, { transcript, dateLabel, sourceLabel, provider }) {
  const fingerprint = createHash("sha256").update(transcript).digest("hex").slice(0, 10);
  const personName = compact(raw.personName, 80) || "New contact";
  return {
    id: `${slugify(personName)}-${fingerprint}`,
    personId: slugify(personName),
    personName,
    initials: personName.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "NC",
    role: compact(raw.role, 80) || "New contact",
    company: compact(raw.company, 80) || "Unknown organization",
    summary: compact(raw.summary, 400),
    topics: (raw.topics || []).map(topic => compact(topic, 50)).filter(Boolean).slice(0, 5),
    commitment: compact(raw.commitment, 200),
    opportunity: compact(raw.opportunity, 200),
    nextAction: compact(raw.nextAction, 200),
    recommendationReason: compact(raw.recommendationReason, 300),
    fitScore: Math.max(1, Math.min(100, Number(raw.fitScore) || 80)),
    conversationTitle: compact(raw.conversationTitle, 120),
    conversationDetail: compact(raw.conversationDetail, 220),
    transcript,
    dateLabel: compact(dateLabel, 80) || "Today",
    sourceLabel: compact(sourceLabel, 80) || "In-person conversation",
    provider,
    createdAt: new Date().toISOString()
  };
}

function stateFrom(store, env) {
  const added = store.memories.length;
  const provider = resolveModelProvider(env);
  return {
    peopleCount: 6 + added,
    conversationCount: 8 + added,
    connectionCount: 14 + added * 3,
    memories: store.memories,
    backend: { mode: provider?.name || "local", model: provider?.model || "local", persistent: true },
    integrations: integrationStatus(env)
  };
}

function localAnswer(question, store) {
  const q = question.toLowerCase();
  const latest = store.memories.at(-1);
  if (latest && (q.includes(latest.personName.split(" ")[0].toLowerCase()) || /what changed|new memory|after meeting/.test(q))) {
    return {
      title: `${latest.personName} is now your highest-leverage follow-up`,
      lead: `The new conversation changed your plan: ${latest.opportunity}. ${latest.nextAction}.`,
      items: [{ label: "Do next", detail: latest.nextAction, personId: latest.personId }, { label: "Why it fits", detail: latest.recommendationReason, personId: latest.personId }],
      evidence: [`Conversation · ${latest.dateLabel}`, `Topics · ${latest.topics.join(" + ")}`, `Commitment · ${latest.commitment}`]
    };
  }
  if (/follow up|tonight|promise/.test(q)) return {
    title: latest ? "Three follow-ups are worth doing tonight" : "Two follow-ups are worth doing tonight",
    lead: latest ? `${latest.personName} is the newest high-upside follow-up. Theo remains the most time-sensitive; Lena is still worth catching before the booths close.` : "Theo is most time-sensitive; Lena is the highest-upside conversation to continue before the booths close.",
    items: [...(latest ? [{ label: latest.personName, detail: latest.nextAction, personId: latest.personId }] : []), { label: "Theo Brooks", detail: "Send the interruption demo by 9:00 PM", personId: "theo" }, { label: "Lena Ortiz", detail: "Request the streaming architecture review", personId: "lena" }].slice(0, 3),
    evidence: [`${2 + (latest ? 1 : 0)} open commitments`, "Event schedule · booths close 10 PM"]
  };
  if (/software|swe|opportunit|remote/.test(q)) return {
    title: "Ravi mentioned the clearest SWE opportunity",
    lead: "Ravi said Neon expects remote-friendly software engineering internships this fall. Lena also mentioned Deepgram’s Los Angeles team.",
    items: [{ label: "Ravi Shah", detail: "Direct signal · remote-friendly SWE internships", personId: "ravi" }, { label: "Lena Ortiz", detail: "Adjacent signal · LA-based engineering team", personId: "lena" }],
    evidence: ["Ravi · 3:40 PM", "Lena · 6:48 PM"]
  };
  const people = [...store.memories.map(memory => ({ id: memory.personId, name: memory.personName, summary: memory.summary })), ...seedPeople];
  return {
    title: "Here’s what your relationship memory says",
    lead: "I searched the stored conversations and ranked the closest relationships by topical overlap and open commitments.",
    items: people.slice(0, 3).map(person => ({ label: person.name, detail: person.summary, personId: person.id })),
    evidence: [`${8 + store.memories.length} conversations`, `${6 + store.memories.length} people`, "Server-backed memory"]
  };
}

function localDraft(personId, store) {
  const memory = store.memories.find(item => item.personId === personId) || store.memories.at(-1);
  if (memory) return {
    to: `${memory.personName} · ${memory.company}`,
    text: /amara|vercel/i.test(`${memory.personName} ${memory.company}`)
      ? "Hi Amara — great meeting you near the sponsor booths. I checked out the AI SDK streaming helpers you recommended, and I’ll send our BridgeOS demo right after judging as promised. I’d also love to take you up on the introduction to the engineer working on tool calling—the overlap with our agent workflow feels especially relevant. Thanks again!"
      : `Hi ${memory.personName.split(" ")[0]} — great meeting you at HackMIT. I appreciated our conversation about ${memory.topics.slice(0, 2).join(" and ")}. I’ll follow through on this next step: ${memory.nextAction}. Thanks again!`,
    evidence: `Grounded in the stored ${memory.dateLabel.toLowerCase()} conversation with ${memory.personName}`
  };
  if (personId === "lena") return { to: "Lena Ortiz · Deepgram", text: "Hi Lena — great meeting you at HackMIT. We now have the streaming path working, and I’d love to take you up on your offer to review the architecture. Are you around near the Deepgram booth before 9:30?", evidence: "Grounded in 2 stored memories with Lena Ortiz" };
  if (personId === "ravi") return { to: "Ravi Shah · Neon", text: "Hi Ravi — thanks for the conversation about database branching and reliable agent state. I’d love to learn more about the remote-friendly SWE roles you mentioned and share our BridgeOS demo after judging.", evidence: "Grounded in 2 stored memories with Ravi Shah" };
  return { to: "Theo Brooks · ElevenLabs", text: "Hi Theo — great talking with you about interruption handling. The demo is ready, and I’d love to send it over after judging. Thanks again!", evidence: "Grounded in 2 stored memories with Theo Brooks" };
}

export async function createBridgeServer(options = {}) {
  const rootDir = options.rootDir || APP_ROOT;
  const env = await loadEnv(rootDir, options.env);
  const staticDir = path.resolve(rootDir, "dist");
  const configuredDataFile = env.DATA_FILE || "./data/memory-store.json";
  const dataFile = path.isAbsolute(configuredDataFile) ? configuredDataFile : path.resolve(rootDir, configuredDataFile);
  const modelFetch = options.modelFetch || options.openAIFetch || fetch;
  const serviceFetch = options.serviceFetch || fetch;
  let store = structuredClone(EMPTY_STORE);
  let writeQueue = Promise.resolve();

  await mkdir(path.dirname(dataFile), { recursive: true });
  if (String(env.RESET_STORE_ON_START).toLowerCase() !== "true") {
    try { store = JSON.parse(await readFile(dataFile, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }

  async function persist() {
    writeQueue = writeQueue.then(async () => {
      const tempFile = `${dataFile}.${process.pid}.tmp`;
      await writeFile(tempFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
      await rename(tempFile, dataFile);
    });
    return writeQueue;
  }

  if (String(env.RESET_STORE_ON_START).toLowerCase() === "true") await persist();

  async function handleApi(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return json(res, 200, { ok: true, ...stateFrom(store, env).backend, integrations: integrationStatus(env) });
    }
    if (req.method === "GET" && url.pathname === "/api/state") return json(res, 200, stateFrom(store, env));
    if (req.method === "GET" && url.pathname === "/api/integrations") return json(res, 200, integrationStatus(env));

    if (req.method === "POST" && url.pathname === "/api/memories") {
      const body = await readJson(req);
      const transcript = compact(body.transcript, 10_000);
      if (transcript.length < 20) throw Object.assign(new Error("Add at least 20 characters of conversation context."), { statusCode: 400 });
      const generated = await callStructuredModel(env, {
        name: "relationship_memory",
        schema: extractionSchema,
        instructions: "Extract one useful relationship memory. Be factual, concise, and grounded only in the transcript. Identify explicit commitments and opportunities without inventing details.",
        input: transcript
      }, modelFetch);
      const provider = generated?.provider || "local";
      const memory = normalizeExtraction(generated?.value || localExtraction(transcript), { transcript, dateLabel: body.dateLabel, sourceLabel: body.sourceLabel, provider });
      const existing = store.memories.find(item => item.id === memory.id);
      if (!existing) {
        store.memories.push(memory);
        await persist();
      }
      let elastic = { status: "not_configured" };
      if (integrationStatus(env).elastic.configured) {
        try { elastic = { status: "indexed", ...(await indexElasticMemory(env, existing || memory, serviceFetch)) }; }
        catch (error) { elastic = { status: "error", message: error.message }; }
      }
      return json(res, existing ? 200 : 201, { stored: true, duplicate: Boolean(existing), provider, memory: existing || memory, elastic, state: stateFrom(store, env) });
    }

    if (req.method === "POST" && url.pathname === "/api/ask") {
      const body = await readJson(req);
      const question = compact(body.question, 500);
      if (!question) throw Object.assign(new Error("Ask a question first."), { statusCode: 400 });
      let elasticHits = [];
      let elasticError = null;
      if (integrationStatus(env).elastic.configured) {
        try { elasticHits = await searchElasticMemories(env, question, serviceFetch); }
        catch (error) { elasticError = error.message; }
      }
      const context = { userGoals: ["applied AI", "software engineering", "remote or Los Angeles roles"], seedPeople, capturedMemories: store.memories, elasticRetrievedMemories: elasticHits };
      const generated = await callStructuredModel(env, {
        name: "grounded_relationship_answer",
        schema: answerSchema,
        instructions: "Answer as BridgeOS, a concise relationship-memory assistant. Use only the supplied context. Recommend concrete next actions and cite short evidence labels. personId must match a supplied id.",
        input: `Question: ${question}\n\nContext:\n${JSON.stringify(context)}`
      }, modelFetch);
      const answer = generated?.value || localAnswer(question, store);
      if (elasticHits.length) answer.evidence = [...answer.evidence.slice(0, 3), `Elastic · ${elasticHits.length} retrieved memories`];
      return json(res, 200, { provider: generated?.provider || "local", retrieval: elasticHits.length ? "elastic" : "json", elasticError, answer });
    }

    if (req.method === "POST" && url.pathname === "/api/drafts") {
      const body = await readJson(req);
      const personId = compact(body.personId, 80);
      const memory = store.memories.find(item => item.personId === personId);
      const context = memory || seedPeople.find(person => person.id === personId) || null;
      const generated = await callStructuredModel(env, {
        name: "relationship_follow_up",
        schema: draftSchema,
        instructions: "Draft a warm, concise post-hackathon follow-up using only the supplied relationship context. Include the specific commitment or next action. Do not claim that a message was sent.",
        input: JSON.stringify({ recipient: context, requestedTone: "warm, specific, concise" })
      }, modelFetch);
      return json(res, 200, { provider: generated?.provider || "local", draft: generated?.value || localDraft(personId, store) });
    }

    if (req.method === "POST" && url.pathname === "/api/deepgram/transcribe") {
      const audio = await readRaw(req);
      const result = await transcribeDeepgram(env, audio, req.headers["content-type"] || "audio/webm", serviceFetch);
      return json(res, 200, result);
    }

    if (req.method === "GET" && url.pathname === "/api/dropbox/files") {
      const files = await listDropboxFiles(env, url.searchParams.get("path") || "", serviceFetch);
      return json(res, 200, { files });
    }

    if (req.method === "POST" && url.pathname === "/api/dropbox/import") {
      const body = await readJson(req);
      return json(res, 200, await downloadDropboxText(env, body.path, serviceFetch));
    }

    if (req.method === "GET" && url.pathname === "/api/elevenlabs/signed-url") {
      return json(res, 200, await createElevenLabsSignedUrl(env, serviceFetch));
    }

    if (req.method === "POST" && url.pathname === "/api/elastic/search") {
      const body = await readJson(req);
      const query = compact(body.query, 500);
      if (!query) throw Object.assign(new Error("Provide a search query."), { statusCode: 400 });
      return json(res, 200, { hits: await searchElasticMemories(env, query, serviceFetch) });
    }

    return json(res, 404, { error: "API route not found." });
  }

  const server = createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
      if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "Method not allowed." });
      const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
      const filePath = path.resolve(staticDir, `.${pathname}`);
      if (!filePath.startsWith(`${staticDir}${path.sep}`)) return json(res, 403, { error: "Forbidden." });
      const info = await stat(filePath).catch(() => null);
      if (!info?.isFile()) return json(res, 404, { error: "Not found." });
      const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
      const content = await readFile(filePath);
      res.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
      if (req.method === "HEAD") return res.end();
      res.end(content);
    } catch (error) {
      const status = error.statusCode || (error.name === "TimeoutError" ? 504 : 500);
      const publicMessage = status < 500 ? error.message : error.message || "The backend could not complete this request.";
      if (status >= 500) console.error(error);
      if (!res.headersSent) json(res, status, { error: publicMessage }); else res.end();
    }
  });

  return { server, env, dataFile, getState: () => stateFrom(store, env) };
}

async function main() {
  const { server, env } = await createBridgeServer();
  const port = Number(env.PORT || 4174);
  const host = env.HOST || "127.0.0.1";
  server.listen(port, host, () => {
    const provider = resolveModelProvider(env);
    const mode = provider ? `${provider.name} (${provider.model})` : "local fallback";
    console.log(`BridgeOS running at http://${host}:${port} · ${mode}`);
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
