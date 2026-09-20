const DEFAULT_TIMEOUT_MS = 20_000;

function trimSlash(value = "") {
  return value.replace(/\/+$/, "");
}

function requireValue(value, message) {
  if (!value?.trim()) throw Object.assign(new Error(message), { statusCode: 503 });
  return value.trim();
}

async function responsePayload(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json().catch(() => ({}));
  return response.text().catch(() => "");
}

async function assertOk(response, service) {
  if (response.ok) return response;
  const payload = await responsePayload(response);
  const detail = typeof payload === "string" ? payload.slice(0, 300) : payload.error?.message || payload.error_summary || payload.message;
  throw Object.assign(new Error(`${service} request failed (${response.status})${detail ? `: ${detail}` : "."}`), { statusCode: 502 });
}

function extractResponseText(response) {
  if (typeof response.output_text === "string" && response.output_text) return response.output_text;
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if ((content.type === "output_text" || content.type === "text") && typeof content.text === "string") return content.text;
    }
  }
  throw new Error("The model provider returned no text output.");
}

export function resolveModelProvider(env) {
  const preference = (env.AI_PROVIDER || "auto").toLowerCase();
  const metaKey = env.MODEL_API_KEY?.trim() || env.META_MODEL_API_KEY?.trim();
  const openAIKey = env.OPENAI_API_KEY?.trim();
  if ((preference === "meta" || preference === "auto") && metaKey) {
    return {
      name: "meta",
      key: metaKey,
      baseUrl: trimSlash(env.META_BASE_URL || "https://api.meta.ai/v1"),
      model: env.META_MODEL || "muse-spark-1.3"
    };
  }
  if ((preference === "openai" || preference === "auto") && openAIKey) {
    return {
      name: "openai",
      key: openAIKey,
      baseUrl: trimSlash(env.OPENAI_BASE_URL || "https://api.openai.com/v1"),
      model: env.OPENAI_MODEL || "gpt-5-mini"
    };
  }
  return null;
}

export function integrationStatus(env) {
  const provider = resolveModelProvider(env);
  return {
    ai: { configured: Boolean(provider), provider: provider?.name || "local", model: provider?.model || "local" },
    meta: { configured: Boolean(env.MODEL_API_KEY?.trim() || env.META_MODEL_API_KEY?.trim()), model: env.META_MODEL || "muse-spark-1.3" },
    openai: { configured: Boolean(env.OPENAI_API_KEY?.trim()), model: env.OPENAI_MODEL || "gpt-5-mini" },
    deepgram: { configured: Boolean(env.DEEPGRAM_API_KEY?.trim()), model: env.DEEPGRAM_MODEL || "nova-3" },
    elevenlabs: { configured: Boolean(env.ELEVENLABS_API_KEY?.trim() && env.ELEVENLABS_AGENT_ID?.trim()), agentId: env.ELEVENLABS_AGENT_ID?.trim() || null },
    elastic: { configured: Boolean(env.ELASTICSEARCH_URL?.trim() && env.ELASTIC_API_KEY?.trim()), index: env.ELASTIC_INDEX || "bridgeos-memory" },
    dropbox: { configured: Boolean(env.DROPBOX_ACCESS_TOKEN?.trim()), root: env.DROPBOX_ROOT_PATH || "" }
  };
}

export async function callStructuredModel(env, { name, schema, instructions, input }, fetchImpl = fetch) {
  const provider = resolveModelProvider(env);
  if (!provider) return null;
  const response = await fetchImpl(`${provider.baseUrl}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: provider.model,
      store: false,
      instructions,
      input,
      max_output_tokens: 1400,
      text: { format: { type: "json_schema", name, strict: true, schema } }
    }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  });
  await assertOk(response, provider.name === "meta" ? "Meta Model API" : "OpenAI");
  const payload = await response.json();
  return { value: JSON.parse(extractResponseText(payload)), provider: provider.name, model: provider.model };
}

export async function transcribeDeepgram(env, audio, contentType, fetchImpl = fetch) {
  const apiKey = requireValue(env.DEEPGRAM_API_KEY, "Add DEEPGRAM_API_KEY to .env to transcribe recorded conversations.");
  const params = new URLSearchParams({
    model: env.DEEPGRAM_MODEL || "nova-3",
    smart_format: "true",
    utterances: "true",
    diarize_model: env.DEEPGRAM_DIARIZE_MODEL || "latest"
  });
  const response = await fetchImpl(`https://api.deepgram.com/v1/listen?${params}`, {
    method: "POST",
    headers: { Authorization: `Token ${apiKey}`, "Content-Type": contentType || "audio/webm" },
    body: audio,
    signal: AbortSignal.timeout(45_000)
  });
  await assertOk(response, "Deepgram");
  const payload = await response.json();
  const alternative = payload.results?.channels?.[0]?.alternatives?.[0];
  const utterances = payload.results?.utterances || [];
  const transcript = utterances.length
    ? utterances.map(item => `Speaker ${Number(item.speaker || 0) + 1}: ${item.transcript}`).join("\n")
    : alternative?.transcript;
  if (!transcript?.trim()) throw Object.assign(new Error("Deepgram returned an empty transcript."), { statusCode: 502 });
  return { transcript: transcript.trim(), confidence: alternative?.confidence ?? null, utterances: utterances.length, provider: "deepgram" };
}

function elasticHeaders(env) {
  return { Authorization: `ApiKey ${requireValue(env.ELASTIC_API_KEY, "Add ELASTIC_API_KEY to .env.")}`, "Content-Type": "application/json" };
}

export async function indexElasticMemory(env, memory, fetchImpl = fetch) {
  const baseUrl = trimSlash(requireValue(env.ELASTICSEARCH_URL, "Add ELASTICSEARCH_URL to .env."));
  const index = encodeURIComponent(env.ELASTIC_INDEX || "bridgeos-memory");
  const response = await fetchImpl(`${baseUrl}/${index}/_doc/${encodeURIComponent(memory.id)}?refresh=wait_for`, {
    method: "PUT",
    headers: elasticHeaders(env),
    body: JSON.stringify({ ...memory, searchableText: [memory.personName, memory.company, memory.summary, ...(memory.topics || []), memory.commitment, memory.opportunity, memory.nextAction, memory.transcript].filter(Boolean).join("\n") }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  });
  await assertOk(response, "Elasticsearch");
  const payload = await response.json();
  return { result: payload.result, index: env.ELASTIC_INDEX || "bridgeos-memory", id: payload._id || memory.id };
}

export async function searchElasticMemories(env, query, fetchImpl = fetch) {
  const baseUrl = trimSlash(requireValue(env.ELASTICSEARCH_URL, "Add ELASTICSEARCH_URL to .env."));
  const index = encodeURIComponent(env.ELASTIC_INDEX || "bridgeos-memory");
  const response = await fetchImpl(`${baseUrl}/${index}/_search`, {
    method: "POST",
    headers: elasticHeaders(env),
    body: JSON.stringify({
      size: 5,
      query: {
        multi_match: {
          query,
          fields: ["personName^4", "company^3", "topics^3", "commitment^2", "opportunity^2", "nextAction^2", "summary", "transcript", "searchableText"],
          type: "best_fields",
          fuzziness: "AUTO"
        }
      }
    }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  });
  await assertOk(response, "Elasticsearch");
  const payload = await response.json();
  return (payload.hits?.hits || []).map(hit => ({ ...hit._source, elasticScore: hit._score, elasticId: hit._id }));
}

export async function listDropboxFiles(env, requestedPath = "", fetchImpl = fetch) {
  const token = requireValue(env.DROPBOX_ACCESS_TOKEN, "Add DROPBOX_ACCESS_TOKEN to .env to import notes from Dropbox.");
  const path = requestedPath || env.DROPBOX_ROOT_PATH || "";
  const response = await fetchImpl("https://api.dropboxapi.com/2/files/list_folder", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path, recursive: false, include_non_downloadable_files: false, limit: 100 }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  });
  await assertOk(response, "Dropbox");
  const payload = await response.json();
  return (payload.entries || []).filter(entry => entry[".tag"] === "file").map(entry => ({ id: entry.id, name: entry.name, path: entry.path_lower || entry.path_display, size: entry.size || 0 }));
}

export async function downloadDropboxText(env, filePath, fetchImpl = fetch) {
  const token = requireValue(env.DROPBOX_ACCESS_TOKEN, "Add DROPBOX_ACCESS_TOKEN to .env to import notes from Dropbox.");
  const normalizedPath = requireValue(filePath, "Choose a Dropbox file first.");
  if (!/\.(txt|md|markdown|json|csv)$/i.test(normalizedPath)) throw Object.assign(new Error("For the demo, choose a text, Markdown, JSON, or CSV file."), { statusCode: 400 });
  const response = await fetchImpl("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Dropbox-API-Arg": JSON.stringify({ path: normalizedPath }) },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  });
  await assertOk(response, "Dropbox");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 2_000_000) throw Object.assign(new Error("Choose a Dropbox text file smaller than 2 MB for this demo."), { statusCode: 413 });
  return { path: normalizedPath, name: normalizedPath.split("/").at(-1), text: buffer.toString("utf8"), provider: "dropbox" };
}

export async function createElevenLabsSignedUrl(env, fetchImpl = fetch) {
  const apiKey = requireValue(env.ELEVENLABS_API_KEY, "Add ELEVENLABS_API_KEY to .env.");
  const agentId = requireValue(env.ELEVENLABS_AGENT_ID, "Add ELEVENLABS_AGENT_ID to .env.");
  const response = await fetchImpl(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`, {
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  });
  await assertOk(response, "ElevenLabs");
  const payload = await response.json();
  if (!payload.signed_url) throw Object.assign(new Error("ElevenLabs returned no signed conversation URL."), { statusCode: 502 });
  return { signedUrl: payload.signed_url, agentId };
}
