const people = {
  lena: {
    id: "lena", initials: "LO", avatar: "avatar-lena", name: "Lena Ortiz", role: "Developer Advocate", company: "Deepgram",
    summary: "Builds with speech infrastructure and voice agents. Based in Los Angeles; offered feedback on your streaming architecture.",
    topics: ["voice agents", "AI infrastructure", "Los Angeles"], met: "Today · 6:48 PM", memories: 2,
    timeline: ["Compared turn-taking approaches for real-time voice agents.", "Mentioned an LA-based team and offered to review your streaming architecture."],
    ask: "Ask how Deepgram handles endpointing when users interrupt an agent mid-response."
  },
  theo: {
    id: "theo", initials: "TB", avatar: "avatar-theo", name: "Theo Brooks", role: "Solutions Engineer", company: "ElevenLabs",
    summary: "Works on conversational voice deployments. Wants to see your interruption-handling demo after judging.",
    topics: ["voice agents", "developer experience", "turn-taking"], met: "Today · 5:22 PM", memories: 2,
    timeline: ["Discussed natural pacing, interruption handling, and tool-aware voice agents.", "You promised to send a 30-second demo tonight."],
    ask: "Ask what makes a hackathon voice demo feel production-ready in under two minutes."
  },
  mina: {
    id: "mina", initials: "MP", avatar: "avatar-mina", name: "Mina Park", role: "Hacker", company: "MIT",
    summary: "Prototyping observability tools for AI agents and looking for technical collaborators after the hackathon.",
    topics: ["AI agents", "developer tools", "observability"], met: "Today · 4:15 PM", memories: 1,
    timeline: ["Shared her prototype for replaying failed agent tool calls and asked about voice-agent evals."],
    ask: "Ask whether she wants to test her replay tool against your voice-agent traces."
  },
  ravi: {
    id: "ravi", initials: "RS", avatar: "avatar-ravi", name: "Ravi Shah", role: "Software Engineer", company: "Neon",
    summary: "Builds serverless Postgres infrastructure. His team has remote-friendly software engineering internships.",
    topics: ["databases", "serverless", "SWE roles"], met: "Today · 3:40 PM", memories: 2,
    timeline: ["Explained how branch-per-preview helps teams test agent state changes.", "Mentioned remote-friendly SWE internships opening this fall."],
    ask: "Ask what project best demonstrates infrastructure judgment for their internship interviews."
  },
  jordan: {
    id: "jordan", initials: "JL", avatar: "avatar-jordan", name: "Jordan Lee", role: "Product Engineer", company: "Dropbox",
    summary: "Interested in turning student information overload into useful action. Suggested using event docs as living context.",
    topics: ["student tools", "knowledge systems", "Dropbox"], met: "Today · 2:55 PM", memories: 1,
    timeline: ["Discussed a StudentOS that connects classes, events, projects, and relationships—not just files."],
    ask: "Ask which Dropbox content workflows make the strongest demo of turning chaos into action."
  },
  samira: {
    id: "samira", initials: "SO", avatar: "avatar-samira", name: "Samira Okafor", role: "Applied AI Lead", company: "OpenAI",
    summary: "Works on agent evaluation and reliable tool use. Recommended showing source-grounded reasoning in the demo.",
    topics: ["agent evals", "tool calling", "applied AI"], met: "Today · 1:20 PM", memories: 1,
    timeline: ["Recommended making every recommendation traceable to an interaction or document."],
    ask: "Ask how she would evaluate whether relationship recommendations are genuinely helpful."
  }
};

const conversations = [
  { day: "SAT", time: "6:48", title: "Voice infrastructure with Lena", person: "lena", detail: "Endpointing, streaming architecture, and the Deepgram LA team", duration: "11 min" },
  { day: "SAT", time: "5:22", title: "Conversational AI with Theo", person: "theo", detail: "Turn-taking, interruptions, and a promised demo", duration: "8 min" },
  { day: "SAT", time: "4:15", title: "Agent observability with Mina", person: "mina", detail: "Replaying failed tool calls and post-hackathon collaboration", duration: "6 min" },
  { day: "SAT", time: "3:40", title: "Serverless backends with Ravi", person: "ravi", detail: "Database branching and remote SWE internships", duration: "9 min" },
  { day: "SAT", time: "2:55", title: "Student knowledge systems with Jordan", person: "jordan", detail: "Turning event documents and notes into next actions", duration: "7 min" },
  { day: "SAT", time: "1:20", title: "Grounded agents with Samira", person: "samira", detail: "Evals, reliable tool use, and visible evidence", duration: "5 min" }
];

let memoryIngested = false;
let latestMemory = null;
let pendingMemory = null;
let latestBackendState = null;
let backendMode = "offline";
let sponsorStatus = {};
let deepgramRecorder = null;
let deepgramStream = null;
let elevenSession = null;

const els = Object.fromEntries([
  "backdrop", "captureDrawer", "detailDrawer", "composer", "toast", "askInput", "answerPanel", "answerTitle", "answerBody",
  "peopleDirectory", "conversationList", "peopleList", "mapView", "todayView", "peopleView", "conversationsView", "changePanel"
].map(id => [id, document.getElementById(id)]));

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Backend request failed (${response.status}).`);
  return payload;
}

function setBackendStatus(mode, model = "") {
  backendMode = mode;
  const status = document.getElementById("backendStatus");
  status.className = `backend-status ${mode}`;
  if (mode === "meta") {
    status.innerHTML = `<i></i> Meta AI live`;
    status.title = `Meta Model API · ${model}`;
  } else if (mode === "openai") {
    status.innerHTML = `<i></i> AI backend live`;
    status.title = `OpenAI Responses API · ${model}`;
  } else if (mode === "local") {
    status.innerHTML = `<i></i> Local backend`;
    status.title = "Server-backed persistence with deterministic local reasoning. Add Meta or OpenAI credentials to .env for model-backed intelligence.";
  } else {
    status.innerHTML = `<i></i> Backend offline`;
    status.title = "Start BridgeOS with node server.mjs.";
  }
}

function updateSponsorStatus(integrations = {}) {
  sponsorStatus = integrations;
  const mapping = { meta: "metaState", deepgram: "deepgramState", elevenlabs: "elevenlabsState", elastic: "elasticState", dropbox: "dropboxState" };
  for (const [name, id] of Object.entries(mapping)) {
    const element = document.getElementById(id);
    const configured = Boolean(integrations[name]?.configured);
    element.textContent = configured ? "live" : "off";
    element.classList.toggle("live", configured);
    element.title = configured ? `${name} configured on the backend` : `Add ${name} credentials to .env`;
  }
}

function avatar(person) {
  return `<span class="avatar ${escapeHtml(person.avatar)}">${escapeHtml(person.initials)}</span>`;
}

function renderPeople(query = "") {
  const q = query.trim().toLowerCase();
  const matches = Object.values(people).filter(p => [p.name, p.role, p.company, p.summary, ...p.topics].join(" ").toLowerCase().includes(q));
  els.peopleDirectory.innerHTML = matches.map(p => `
    <button class="directory-card" data-person="${escapeHtml(p.id)}">
      <div class="directory-top">${avatar(p)}<div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.role)} · ${escapeHtml(p.company)}</small></div></div>
      <p>${escapeHtml(p.summary)}</p>
      <div class="topic-row">${p.topics.map(t => `<span>${escapeHtml(t)}</span>`).join("")}</div>
      <div class="memory-count">${escapeHtml(p.memories)} ${p.memories === 1 ? "memory" : "memories"} · last seen ${escapeHtml(p.met.toLowerCase())}</div>
    </button>`).join("") || `<p class="reason">No one matches that search yet.</p>`;
}

function renderLists() {
  els.peopleList.innerHTML = Object.values(people).map(p => `<button class="list-person" data-person="${escapeHtml(p.id)}">${avatar(p)}<span><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.company)} · ${escapeHtml(p.topics[0])}</small></span></button>`).join("");
  els.conversationList.innerHTML = conversations.map(c => {
    const p = people[c.person];
    return `<button class="conversation-item" data-person="${escapeHtml(p.id)}"><div class="conversation-date"><strong>${escapeHtml(c.time)}</strong>${escapeHtml(c.day)}</div><div><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.detail)}</p></div><span>${escapeHtml(c.duration)} →</span></button>`;
  }).join("");
  renderPeople();
}

function addCapturedMemory(memory, state = {}) {
  if (!memory) return;
  latestMemory = memory;
  const personId = memory.personId || "amara";
  const firstName = memory.personName.split(" ")[0];
  memoryIngested = true;
  people[personId] = {
    id: personId,
    initials: memory.initials || firstName.slice(0, 2).toUpperCase(),
    avatar: "avatar-amara",
    name: memory.personName,
    role: memory.role,
    company: memory.company,
    summary: memory.summary,
    topics: memory.topics,
    met: memory.dateLabel || "Today",
    memories: 1,
    timeline: [memory.opportunity, `Commitment: ${memory.commitment}`],
    ask: `Ask what context would make “${memory.nextAction}” most useful.`
  };
  if (!conversations.some(item => item.memoryId === memory.id)) {
    const time = memory.dateLabel?.match(/\d{1,2}:\d{2}/)?.[0] || "NOW";
    conversations.unshift({ memoryId: memory.id, day: "SAT", time, title: memory.conversationTitle, person: personId, detail: memory.conversationDetail, duration: "4 min" });
  }
  document.getElementById("peopleCount").textContent = String(state.peopleCount || 7);
  document.getElementById("conversationCount").textContent = String(state.conversationCount || 9);
  document.getElementById("connectionCount").textContent = String(state.connectionCount || 17);
  document.getElementById("briefingEyebrow").textContent = "YOUR UPDATED BRIEF";
  document.getElementById("briefingTitle").textContent = "New context. Three higher-signal moves.";
  document.getElementById("topPriority").classList.add("is-new");
  document.getElementById("topPriority").innerHTML = `
    <div class="card-kicker"><span class="rank">01</span> FOLLOW UP NOW <span class="new-badge">NEW</span></div>
    <div class="person-line">
      <span class="avatar avatar-amara">${escapeHtml(people[personId].initials)}</span>
      <div><h3>${escapeHtml(memory.personName)}</h3><p>${escapeHtml(memory.role)} · ${escapeHtml(memory.company)}</p></div>
      <span class="match">${escapeHtml(memory.fitScore)}% fit</span>
    </div>
    <p class="reason">${escapeHtml(memory.recommendationReason)}</p>
    <div class="topic-row">${memory.topics.slice(0, 3).map(topic => `<span>${escapeHtml(topic)}</span>`).join("")}</div>
    <div class="card-actions">
      <button class="primary-action" data-action="draft" data-person="${escapeHtml(personId)}">Draft follow-up <span>→</span></button>
      <button class="icon-action" data-person="${escapeHtml(personId)}" aria-label="Open ${escapeHtml(memory.personName)} memory">•••</button>
    </div>`;
  const suggestion = document.querySelector("[data-question='Who mentioned software engineering opportunities?']");
  if (suggestion) {
    suggestion.dataset.question = `What changed after meeting ${firstName}?`;
    suggestion.textContent = "What changed?";
  }
  document.getElementById("changeEyebrow").textContent = "MEMORY UPDATED · 3 NEW LINKS";
  document.getElementById("changeTitle").textContent = `${firstName} changed your highest-priority next move.`;
  document.getElementById("changeReason").textContent = memory.recommendationReason;
  document.getElementById("traceConversation").textContent = `${firstName} · ${memory.company}`;
  document.getElementById("traceAction").textContent = memory.nextAction;
  document.getElementById("explainChange").dataset.question = `What changed after meeting ${firstName}?`;
  document.getElementById("draftChange").dataset.person = personId;
  renderLists();
}

function setView(view) {
  document.querySelectorAll(".nav-item").forEach(b => {
    const active = b.dataset.view === view;
    b.classList.toggle("active", active);
    if (active) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  els.todayView.classList.toggle("hidden", view !== "today");
  document.getElementById("memorySection").classList.toggle("hidden", view !== "today");
  els.peopleView.classList.toggle("hidden", view !== "people");
  els.conversationsView.classList.toggle("hidden", view !== "conversations");
  if (view !== "today") els.answerPanel.classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showOverlay(element) {
  els.backdrop.classList.remove("hidden");
  element.classList.remove("hidden");
  element.removeAttribute("inert");
  requestAnimationFrame(() => element.classList.add("open"));
  element.setAttribute?.("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeOverlays() {
  [els.captureDrawer, els.detailDrawer].forEach(el => { el.classList.remove("open"); el.setAttribute("aria-hidden", "true"); el.setAttribute("inert", ""); });
  els.composer.classList.add("hidden");
  els.backdrop.classList.add("hidden");
  document.body.style.overflow = "";
}

function openPerson(id) {
  const p = people[id];
  if (!p) return;
  document.getElementById("detailContent").innerHTML = `
    <div class="detail-hero">${avatar(p)}<div><h2 id="detailName">${escapeHtml(p.name)}</h2><p>${escapeHtml(p.role)} · ${escapeHtml(p.company)}</p></div></div>
    <div class="detail-block"><h3>WHAT YOU KNOW</h3><p>${escapeHtml(p.summary)}</p><div class="topic-row">${p.topics.map(t => `<span>${escapeHtml(t)}</span>`).join("")}</div></div>
    <div class="detail-block"><h3>ASK NEXT</h3><p>${escapeHtml(p.ask)}</p></div>
    <div class="detail-block"><h3>MEMORY TRAIL</h3>${p.timeline.map((m, i) => `<div class="memory-event"><small>${i ? "Inferred context" : escapeHtml(p.met)}</small><p>${escapeHtml(m)}</p></div>`).join("")}</div>
    <button class="process-button" data-detail-draft="${escapeHtml(p.id)}">Draft a follow-up <span>→</span></button>`;
  els.captureDrawer.classList.remove("open");
  showOverlay(els.detailDrawer);
}

async function draft(type, id) {
  let to, text, evidence;
  if (type === "intro") {
    to = "Mina Park + Ravi Shah";
    text = `Hey Mina and Ravi — I wanted to connect you two after our conversations today.\n\nMina is building observability and replay tools for AI agents, and Ravi works on serverless Postgres infrastructure at Neon. You both had interesting perspectives on state, reproducibility, and AI-native developer tooling, so I thought you’d have a lot to compare.\n\nI’ll let you take it from here!`;
    evidence = "Grounded in 3 memories across 2 people";
  } else {
    const p = people[id] || people.theo;
    to = `${p.name} · ${p.company}`;
    text = "Drafting a grounded follow-up…";
    evidence = `Reading stored context for ${p.name}`;
  }
  document.getElementById("messageTo").textContent = `To: ${to}`;
  document.getElementById("messageText").value = text;
  document.getElementById("draftEvidence").textContent = evidence;
  els.detailDrawer.classList.remove("open");
  els.composer.classList.remove("hidden");
  els.backdrop.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  if (type === "intro") return;
  try {
    const result = await api("/api/drafts", { method: "POST", body: JSON.stringify({ personId: id }) });
    document.getElementById("messageTo").textContent = `To: ${result.draft.to}`;
    document.getElementById("messageText").value = result.draft.text;
    const source = result.provider === "meta" ? "Meta generated" : result.provider === "openai" ? "OpenAI generated" : "local backend";
    document.getElementById("draftEvidence").textContent = `${result.draft.evidence} · ${source}`;
  } catch (error) {
    closeOverlays();
    toast(error.message);
  }
}

async function answerQuestion(question) {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) return;
  els.askInput.value = cleanQuestion;
  els.answerPanel.classList.remove("hidden");
  els.answerTitle.textContent = "Searching your relationship memory…";
  els.answerBody.innerHTML = `<p>Connecting stored conversations, commitments, and goals.</p>`;
  els.answerPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  try {
    const result = await api("/api/ask", { method: "POST", body: JSON.stringify({ question: cleanQuestion }) });
    const { title, lead, items, evidence } = result.answer;
    els.answerTitle.textContent = title;
    const providerLabel = result.provider === "meta" ? "✦ Meta" : result.provider === "openai" ? "✦ OpenAI" : "⌁ Local backend";
    const retrievalLabel = result.retrieval === "elastic" ? `<button class="evidence-chip">⌕ Elastic retrieval</button>` : "";
    els.answerBody.innerHTML = `<p>${escapeHtml(lead)}</p><div class="answer-list">${items.map((item, i) => `<div class="answer-item"><span class="answer-num">0${i + 1}</span><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></div><button data-answer-person="${escapeHtml(item.personId)}">Open →</button></div>`).join("")}</div><div class="evidence-line">${evidence.map(item => `<button class="evidence-chip">⌁ ${escapeHtml(item)}</button>`).join("")}${retrievalLabel}<button class="evidence-chip">${providerLabel}</button></div>`;
  } catch (error) {
    els.answerTitle.textContent = "The backend needs attention";
    els.answerBody.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2400);
}

function resetCapture() {
  pendingMemory = null;
  document.getElementById("processingState").classList.add("hidden");
  document.getElementById("memoryResult").classList.add("hidden");
  document.getElementById("transcriptCapture").classList.remove("hidden");
  document.querySelector(".capture-tabs").classList.remove("hidden");
}

async function hydrateBackend() {
  try {
    const health = await api("/api/health");
    setBackendStatus(health.mode, health.model);
    updateSponsorStatus(health.integrations || {});
    const state = await api("/api/state");
    latestBackendState = state;
    if (state.memories.length) {
      state.memories.forEach(memory => addCapturedMemory(memory, state));
      els.changePanel.classList.remove("hidden");
    }
  } catch {
    setBackendStatus("offline");
    updateSponsorStatus({});
  }
}

function registerBridgeTools() {
  const modelContext = document.modelContext ?? navigator.modelContext;
  if (typeof modelContext?.registerTool !== "function") return;
  const tools = [
    {
      name: "get_bridge_memory_context",
      description: "Read the people, topics, commitments, and conversations currently loaded in BridgeOS. Captured memories are persisted by the local backend.",
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: async () => ({
        event: "HackMIT 2026",
        userInterests: ["software engineering", "applied AI", "voice agents", "Los Angeles or remote roles"],
        people: Object.values(people).map(({ id, name, role, company, summary, topics, met, memories, timeline, ask }) => ({ id, name, role, company, summary, topics, met, memories, timeline, suggestedQuestion: ask })),
        conversations,
        openCommitments: [
          ...(memoryIngested ? [{ personId: "amara", action: "Send the BridgeOS demo and ask for the tool-calling introduction", due: "After judging" }] : []),
          { personId: "theo", action: "Send the 30-second interruption demo", due: "Tonight at 9:00 PM" },
          { personId: "lena", action: "Ask for a streaming architecture review", due: "Before sponsor booths close" }
        ]
      })
    },
    {
      name: "ask_bridge_memory",
      description: "Ask a natural-language question across the relationship memories in this open BridgeOS demo. The answer is shown in the page and returned with its evidence.",
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: { question: { type: "string", minLength: 1, maxLength: 500 } },
        required: ["question"],
        additionalProperties: false
      },
      execute: async ({ question }) => {
        if (typeof question !== "string" || !question.trim() || question.length > 500) throw new Error("Provide a question between 1 and 500 characters.");
        await answerQuestion(question.trim());
        return { question: question.trim(), title: els.answerTitle.textContent, answer: els.answerBody.innerText };
      }
    },
    {
      name: "open_bridge_capture",
      description: "Open the BridgeOS memory-capture drawer and optionally prefill it with a transcript or rough conversation notes. Processing the transcript sends it to the configured BridgeOS backend and persists the extracted memory.",
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: { transcript: { type: "string", maxLength: 10000 } },
        additionalProperties: false
      },
      execute: async ({ transcript } = {}) => {
        if (transcript !== undefined && typeof transcript !== "string") throw new Error("Transcript must be text.");
        resetCapture();
        if (transcript?.trim()) document.getElementById("transcriptInput").value = transcript.trim();
        showOverlay(els.captureDrawer);
        return { opened: true, prefilled: Boolean(transcript?.trim()), persistence: "server-backed" };
      }
    }
  ];
  for (const tool of tools) {
    try { Promise.resolve(modelContext.registerTool(tool)).catch(error => console.warn(`Unable to register ${tool.name}`, error)); }
    catch (error) { console.warn(`Unable to register ${tool.name}`, error); }
  }
}

function showTranscriptCapture(transcript, sourceLabel) {
  document.querySelector('[data-capture-mode="transcript"]').click();
  document.getElementById("transcriptInput").value = transcript;
  document.querySelector(".capture-meta select").value = sourceLabel;
  document.getElementById("transcriptInput").focus();
}

async function toggleDeepgramRecording() {
  const button = document.getElementById("recordOrb");
  const title = document.getElementById("voiceCaptureTitle");
  const copy = document.getElementById("voiceCaptureCopy");
  if (deepgramRecorder?.state === "recording") {
    deepgramRecorder.stop();
    button.classList.remove("recording");
    button.setAttribute("aria-label", "Start voice recording");
    title.textContent = "Transcribing with Deepgram…";
    copy.textContent = "Speaker turns will feed the same relationship-memory pipeline.";
    return;
  }
  if (!sponsorStatus.deepgram?.configured) return toast("Add DEEPGRAM_API_KEY to .env first");
  try {
    deepgramStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const preferred = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    const chunks = [];
    deepgramRecorder = new MediaRecorder(deepgramStream, { mimeType: preferred });
    deepgramRecorder.addEventListener("dataavailable", event => { if (event.data.size) chunks.push(event.data); });
    deepgramRecorder.addEventListener("stop", async () => {
      try {
        deepgramStream?.getTracks().forEach(track => track.stop());
        const audio = new Blob(chunks, { type: deepgramRecorder.mimeType || preferred });
        const response = await fetch("/api/deepgram/transcribe", { method: "POST", headers: { "Content-Type": audio.type }, body: audio });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Deepgram transcription failed.");
        showTranscriptCapture(result.transcript, "Deepgram voice note");
        toast(`Deepgram captured ${result.utterances || 1} speaker turn${result.utterances === 1 ? "" : "s"}`);
      } catch (error) {
        toast(error.message);
      } finally {
        deepgramRecorder = null;
        deepgramStream = null;
        button.classList.remove("recording");
        title.textContent = "Tap to record a quick memory";
        copy.textContent = "Deepgram will transcribe it; BridgeOS will identify people, topics, and promises.";
      }
    }, { once: true });
    deepgramRecorder.start(500);
    button.classList.add("recording");
    button.setAttribute("aria-label", "Stop voice recording");
    title.textContent = "Recording conversation…";
    copy.textContent = "Tap again when you are finished.";
  } catch (error) {
    toast(error.name === "NotAllowedError" ? "Microphone access was not allowed" : error.message);
  }
}

async function browseDropbox() {
  const container = document.getElementById("dropboxFiles");
  if (!sponsorStatus.dropbox?.configured) return toast("Add DROPBOX_ACCESS_TOKEN to .env first");
  container.classList.remove("hidden");
  container.innerHTML = "<p>Loading Dropbox files…</p>";
  try {
    const result = await api("/api/dropbox/files");
    container.innerHTML = result.files.length
      ? result.files.map(file => `<button data-dropbox-path="${escapeHtml(file.path)}"><span>${escapeHtml(file.name)}</span><small>${Math.max(1, Math.round(file.size / 1024))} KB</small></button>`).join("")
      : "<p>No supported files found in this Dropbox folder.</p>";
  } catch (error) {
    container.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

async function importDropbox(path) {
  const container = document.getElementById("dropboxFiles");
  container.innerHTML = "<p>Importing file context…</p>";
  try {
    const result = await api("/api/dropbox/import", { method: "POST", body: JSON.stringify({ path }) });
    showTranscriptCapture(`Dropbox file: ${result.name}\n\n${result.text}`, "Dropbox document");
    toast(`${result.name} imported from Dropbox`);
  } catch (error) {
    container.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function downsampleToPcm16(samples, sourceRate, targetRate = 16000) {
  const ratio = sourceRate / targetRate;
  const length = Math.max(1, Math.round(samples.length / ratio));
  const pcm = new Int16Array(length);
  for (let index = 0; index < length; index++) {
    const start = Math.floor(index * ratio);
    const end = Math.min(samples.length, Math.floor((index + 1) * ratio));
    let total = 0;
    for (let cursor = start; cursor < end; cursor++) total += samples[cursor];
    const value = Math.max(-1, Math.min(1, total / Math.max(1, end - start)));
    pcm[index] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }
  return new Uint8Array(pcm.buffer);
}

function playElevenAudio(base64Audio) {
  const session = elevenSession;
  if (!session?.outputContext) return;
  const bytes = base64ToBytes(base64Audio);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const frameCount = Math.floor(bytes.byteLength / 2);
  const audioBuffer = session.outputContext.createBuffer(1, frameCount, session.outputRate || 16000);
  const channel = audioBuffer.getChannelData(0);
  for (let index = 0; index < frameCount; index++) channel[index] = view.getInt16(index * 2, true) / 32768;
  const source = session.outputContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(session.outputContext.destination);
  const startAt = Math.max(session.outputContext.currentTime, session.nextPlayTime || 0);
  source.start(startAt);
  session.nextPlayTime = startAt + audioBuffer.duration;
}

async function stopElevenConversation(message = "Voice agent stopped") {
  const session = elevenSession;
  elevenSession = null;
  document.getElementById("voiceButton").classList.remove("listening");
  document.getElementById("voiceButton").setAttribute("aria-pressed", "false");
  if (!session) return;
  session.processor?.disconnect();
  session.inputSource?.disconnect();
  session.stream?.getTracks().forEach(track => track.stop());
  if (session.socket?.readyState === WebSocket.OPEN) session.socket.close(1000, "User ended conversation");
  await Promise.allSettled([session.inputContext?.close(), session.outputContext?.close()]);
  if (message) toast(message);
}

async function startElevenConversation() {
  if (elevenSession) return stopElevenConversation();
  if (!sponsorStatus.elevenlabs?.configured) return toast("Add ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID to .env first");
  const button = document.getElementById("voiceButton");
  try {
    const [{ signedUrl }, state, stream] = await Promise.all([
      api("/api/elevenlabs/signed-url"),
      api("/api/state"),
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    ]);
    const inputContext = new AudioContext();
    const outputContext = new AudioContext();
    const socket = new WebSocket(signedUrl);
    const inputSource = inputContext.createMediaStreamSource(stream);
    const processor = inputContext.createScriptProcessor(4096, 1, 1);
    const mute = inputContext.createGain();
    mute.gain.value = 0;
    inputSource.connect(processor);
    processor.connect(mute);
    mute.connect(inputContext.destination);
    elevenSession = { socket, stream, inputContext, outputContext, inputSource, processor, mute, outputRate: 16000, nextPlayTime: 0, context: state };
    processor.onaudioprocess = event => {
      if (socket.readyState !== WebSocket.OPEN) return;
      const pcm = downsampleToPcm16(event.inputBuffer.getChannelData(0), inputContext.sampleRate, 16000);
      socket.send(JSON.stringify({ user_audio_chunk: bytesToBase64(pcm) }));
    };
    socket.addEventListener("open", () => {
      button.classList.add("listening");
      button.setAttribute("aria-pressed", "true");
      socket.send(JSON.stringify({ type: "contextual_update", text: `BridgeOS relationship memory: ${JSON.stringify({ goals: ["applied AI", "software engineering", "remote or Los Angeles roles"], memories: state.memories })}` }));
      toast("ElevenLabs voice agent is listening");
    });
    socket.addEventListener("message", async event => {
      const message = JSON.parse(event.data);
      if (message.type === "conversation_initiation_metadata") {
        const format = message.conversation_initiation_metadata_event?.agent_output_audio_format || "pcm_16000";
        elevenSession.outputRate = Number(format.match(/pcm_(\d+)/)?.[1] || 16000);
      } else if (message.type === "audio") {
        playElevenAudio(message.audio_event?.audio_base_64);
      } else if (message.type === "user_transcript") {
        els.askInput.value = message.user_transcription_event?.user_transcript || els.askInput.value;
      } else if (message.type === "agent_response") {
        els.answerPanel.classList.remove("hidden");
        els.answerTitle.textContent = "ElevenLabs voice agent";
        els.answerBody.innerHTML = `<p>${escapeHtml(message.agent_response_event?.agent_response || "")}</p><div class="evidence-line"><button class="evidence-chip">◉ Live voice</button><button class="evidence-chip">⌁ BridgeOS context</button></div>`;
      } else if (message.type === "ping") {
        socket.send(JSON.stringify({ type: "pong", event_id: message.ping_event?.event_id }));
      } else if (message.type === "client_tool_call" && message.client_tool_call?.tool_name === "ask_bridge_memory") {
        const result = await api("/api/ask", { method: "POST", body: JSON.stringify({ question: message.client_tool_call.parameters?.question || "Who should I follow up with?" }) });
        socket.send(JSON.stringify({ type: "client_tool_result", tool_call_id: message.client_tool_call.tool_call_id, result: JSON.stringify(result.answer), is_error: false }));
      }
    });
    socket.addEventListener("close", () => { if (elevenSession?.socket === socket) stopElevenConversation(""); });
    socket.addEventListener("error", () => { if (elevenSession?.socket === socket) stopElevenConversation("ElevenLabs voice connection failed"); });
  } catch (error) {
    await stopElevenConversation("");
    toast(error.name === "NotAllowedError" ? "Microphone access was not allowed" : error.message);
  }
}

document.addEventListener("click", e => {
  const nav = e.target.closest("[data-view]"); if (nav) setView(nav.dataset.view);
  const question = e.target.closest("[data-question]"); if (question) answerQuestion(question.dataset.question);
  const person = e.target.closest("[data-person]"); if (person && !e.target.closest("[data-action]")) openPerson(person.dataset.person);
  const answerPerson = e.target.closest("[data-answer-person]"); if (answerPerson) openPerson(answerPerson.dataset.answerPerson);
  const action = e.target.closest("[data-action]");
  if (action) action.dataset.action === "intro" ? draft("intro") : action.dataset.action === "prep" ? openPerson(action.dataset.person) : draft("followup", action.dataset.person);
  const detailDraft = e.target.closest("[data-detail-draft]"); if (detailDraft) draft("followup", detailDraft.dataset.detailDraft);
  const dropboxFile = e.target.closest("[data-dropbox-path]"); if (dropboxFile) importDropbox(dropboxFile.dataset.dropboxPath);
});

document.getElementById("captureButton").addEventListener("click", () => { resetCapture(); showOverlay(els.captureDrawer); });
document.getElementById("closeCapture").addEventListener("click", closeOverlays);
document.getElementById("closeDetail").addEventListener("click", closeOverlays);
document.getElementById("closeComposer").addEventListener("click", closeOverlays);
document.getElementById("backdrop").addEventListener("click", closeOverlays);
document.getElementById("askButton").addEventListener("click", () => answerQuestion(els.askInput.value));
els.askInput.addEventListener("keydown", e => { if (e.key === "Enter") answerQuestion(els.askInput.value); });
document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); els.askInput.focus(); }
  if (e.key === "Escape") closeOverlays();
});

document.getElementById("voiceButton").addEventListener("click", startElevenConversation);

document.querySelectorAll("[data-memory-view]").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll("[data-memory-view]").forEach(b => b.classList.toggle("active", b === button));
  els.mapView.classList.toggle("hidden", button.dataset.memoryView !== "map");
  els.peopleList.classList.toggle("hidden", button.dataset.memoryView !== "list");
}));

document.getElementById("peopleSearch").addEventListener("input", e => renderPeople(e.target.value));

document.querySelectorAll("[data-capture-mode]").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll("[data-capture-mode]").forEach(b => {
    b.classList.toggle("active", b === button);
    b.setAttribute("aria-selected", String(b === button));
  });
  ["transcriptCapture", "voiceCapture", "documentCapture"].forEach(id => document.getElementById(id).classList.add("hidden"));
  document.getElementById(`${button.dataset.captureMode}Capture`).classList.remove("hidden");
}));

document.getElementById("processMemory").addEventListener("click", async () => {
  const processButton = document.getElementById("processMemory");
  const transcript = document.getElementById("transcriptInput").value.trim();
  if (transcript.length < 20) return toast("Add a little more conversation context first");
  processButton.disabled = true;
  document.getElementById("transcriptCapture").classList.add("hidden");
  document.querySelector(".capture-tabs").classList.add("hidden");
  document.getElementById("processingState").classList.remove("hidden");
  document.getElementById("processingTitle").textContent = backendMode === "openai" ? "OpenAI is building relationship memory…" : "Backend is building relationship memory…";
  try {
    const result = await api("/api/memories", {
      method: "POST",
      body: JSON.stringify({
        transcript,
        dateLabel: document.querySelector(".capture-meta input").value,
        sourceLabel: document.querySelector(".capture-meta select").value
      })
    });
    pendingMemory = result.memory;
    latestBackendState = result.state;
    document.querySelectorAll("#processingState li").forEach(item => item.classList.add("done"));
    const providerLabel = result.provider === "meta" ? "META EXTRACTED" : result.provider === "openai" ? "OPENAI EXTRACTED" : "LOCAL BACKEND";
    const elasticLabel = result.elastic?.status === "indexed" ? " · ELASTIC INDEXED" : "";
    document.getElementById("memoryProvider").textContent = `MEMORY ADDED · ${providerLabel}${elasticLabel}`;
    document.getElementById("memoryPerson").textContent = `${result.memory.personName} · ${result.memory.company}`;
    document.getElementById("memorySummary").textContent = result.memory.summary;
    document.getElementById("memoryTopics").textContent = result.memory.topics.join(", ");
    document.getElementById("memoryCommitment").textContent = result.memory.commitment;
    document.getElementById("memoryOpportunity").textContent = result.memory.opportunity;
    await new Promise(resolve => setTimeout(resolve, 450));
    document.getElementById("processingState").classList.add("hidden");
    document.getElementById("memoryResult").classList.remove("hidden");
  } catch (error) {
    document.getElementById("processingState").classList.add("hidden");
    document.getElementById("transcriptCapture").classList.remove("hidden");
    document.querySelector(".capture-tabs").classList.remove("hidden");
    toast(error.message);
  } finally {
    processButton.disabled = false;
  }
});

document.getElementById("finishCapture").addEventListener("click", () => {
  if (!pendingMemory) return toast("Process a memory first");
  addCapturedMemory(pendingMemory, latestBackendState || {});
  closeOverlays();
  els.answerPanel.classList.add("hidden");
  els.changePanel.classList.remove("hidden");
  els.changePanel.scrollIntoView({ behavior: "smooth", block: "center" });
  toast(`${pendingMemory.personName} added · brief recalculated`);
});
document.getElementById("recordOrb").addEventListener("click", toggleDeepgramRecording);
document.getElementById("mockDropbox").addEventListener("click", browseDropbox);
document.getElementById("closeAnswer").addEventListener("click", () => els.answerPanel.classList.add("hidden"));
document.getElementById("copyDraft").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(document.getElementById("messageText").value); toast("Draft copied"); }
  catch { toast("Select the draft text to copy"); }
});
document.getElementById("sendDraft").addEventListener("click", () => { closeOverlays(); toast("Follow-up marked as sent"); });

renderLists();
hydrateBackend().finally(registerBridgeTools);
