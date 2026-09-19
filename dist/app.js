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
const amaraRecord = {
  id: "amara", initials: "AC", avatar: "avatar-amara", name: "Amara Chen", role: "Developer Experience", company: "Vercel",
  summary: "Builds developer experience for AI apps on a remote-friendly team. Offered a warm introduction to an engineer working on tool calling.",
  topics: ["AI SDK", "tool calling", "remote work"], met: "Today · 7:38 PM", memories: 1,
  timeline: ["Recommended the AI SDK streaming helpers and offered an introduction to a tool-calling engineer.", "You promised to send the BridgeOS demo after judging."],
  ask: "Ask which tool-calling failure modes their developer-experience team sees most often."
};

const els = Object.fromEntries([
  "backdrop", "captureDrawer", "detailDrawer", "composer", "toast", "askInput", "answerPanel", "answerTitle", "answerBody",
  "peopleDirectory", "conversationList", "peopleList", "mapView", "todayView", "peopleView", "conversationsView", "changePanel"
].map(id => [id, document.getElementById(id)]));

function avatar(person) {
  return `<span class="avatar ${person.avatar}">${person.initials}</span>`;
}

function renderPeople(query = "") {
  const q = query.trim().toLowerCase();
  const matches = Object.values(people).filter(p => [p.name, p.role, p.company, p.summary, ...p.topics].join(" ").toLowerCase().includes(q));
  els.peopleDirectory.innerHTML = matches.map(p => `
    <button class="directory-card" data-person="${p.id}">
      <div class="directory-top">${avatar(p)}<div><strong>${p.name}</strong><small>${p.role} · ${p.company}</small></div></div>
      <p>${p.summary}</p>
      <div class="topic-row">${p.topics.map(t => `<span>${t}</span>`).join("")}</div>
      <div class="memory-count">${p.memories} ${p.memories === 1 ? "memory" : "memories"} · last seen ${p.met.toLowerCase()}</div>
    </button>`).join("") || `<p class="reason">No one matches that search yet.</p>`;
}

function renderLists() {
  els.peopleList.innerHTML = Object.values(people).map(p => `<button class="list-person" data-person="${p.id}">${avatar(p)}<span><strong>${p.name}</strong><small>${p.company} · ${p.topics[0]}</small></span></button>`).join("");
  els.conversationList.innerHTML = conversations.map(c => {
    const p = people[c.person];
    return `<button class="conversation-item" data-person="${p.id}"><div class="conversation-date"><strong>${c.time}</strong>${c.day}</div><div><h3>${c.title}</h3><p>${c.detail}</p></div><span>${c.duration} →</span></button>`;
  }).join("");
  renderPeople();
}

function addAmaraMemory() {
  if (memoryIngested) return;
  memoryIngested = true;
  people.amara = amaraRecord;
  conversations.unshift({ day: "SAT", time: "7:38", title: "AI developer experience with Amara", person: "amara", detail: "AI SDK streaming, tool calling, and a promised post-judging demo", duration: "4 min" });
  document.getElementById("peopleCount").textContent = "7";
  document.getElementById("conversationCount").textContent = "9";
  document.getElementById("connectionCount").textContent = "17";
  document.getElementById("briefingEyebrow").textContent = "YOUR UPDATED BRIEF";
  document.getElementById("briefingTitle").textContent = "New context. Three higher-signal moves.";
  document.getElementById("topPriority").classList.add("is-new");
  document.getElementById("topPriority").innerHTML = `
    <div class="card-kicker"><span class="rank">01</span> FOLLOW UP NOW <span class="new-badge">NEW</span></div>
    <div class="person-line">
      <span class="avatar avatar-amara">AC</span>
      <div><h3>Amara Chen</h3><p>Developer Experience · Vercel</p></div>
      <span class="match">98% fit</span>
    </div>
    <p class="reason">Your new conversation created a warm path to Vercel’s tool-calling team—and you promised to send the demo after judging.</p>
    <div class="topic-row"><span>AI SDK</span><span>tool calling</span><span>remote-friendly</span></div>
    <div class="card-actions">
      <button class="primary-action" data-action="draft" data-person="amara">Draft follow-up <span>→</span></button>
      <button class="icon-action" data-person="amara" aria-label="Open Amara's memory">•••</button>
    </div>`;
  const suggestion = document.querySelector("[data-question='Who mentioned software engineering opportunities?']");
  if (suggestion) {
    suggestion.dataset.question = "What changed after meeting Amara?";
    suggestion.textContent = "What changed?";
  }
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
    <div class="detail-hero">${avatar(p)}<div><h2 id="detailName">${p.name}</h2><p>${p.role} · ${p.company}</p></div></div>
    <div class="detail-block"><h3>WHAT YOU KNOW</h3><p>${p.summary}</p><div class="topic-row">${p.topics.map(t => `<span>${t}</span>`).join("")}</div></div>
    <div class="detail-block"><h3>ASK NEXT</h3><p>${p.ask}</p></div>
    <div class="detail-block"><h3>MEMORY TRAIL</h3>${p.timeline.map((m, i) => `<div class="memory-event"><small>${i ? "Inferred context" : p.met}</small><p>${m}</p></div>`).join("")}</div>
    <button class="process-button" data-detail-draft="${p.id}">Draft a follow-up <span>→</span></button>`;
  els.captureDrawer.classList.remove("open");
  showOverlay(els.detailDrawer);
}

function draft(type, id) {
  let to, text, evidence;
  if (type === "intro") {
    to = "Mina Park + Ravi Shah";
    text = `Hey Mina and Ravi — I wanted to connect you two after our conversations today.\n\nMina is building observability and replay tools for AI agents, and Ravi works on serverless Postgres infrastructure at Neon. You both had interesting perspectives on state, reproducibility, and AI-native developer tooling, so I thought you’d have a lot to compare.\n\nI’ll let you take it from here!`;
    evidence = "Grounded in 3 memories across 2 people";
  } else {
    const p = people[id] || people.theo;
    to = `${p.name} · ${p.company}`;
    text = id === "lena"
      ? `Hi Lena — great meeting you at HackMIT. I kept thinking about our conversation on endpointing and interruption handling for real-time voice agents. We’ve now got the streaming path working, and I’d love to take you up on your offer to review the architecture. Are you around near the Deepgram booth before 9:30?`
      : id === "amara"
        ? `Hi Amara — great meeting you near the sponsor booths. I checked out the AI SDK streaming helpers you recommended, and I’ll send our BridgeOS demo right after judging as promised. I’d also love to take you up on the introduction to the engineer working on tool calling—the overlap with our agent workflow feels especially relevant. Thanks again!`
        : `Hi Theo — great talking with you about making voice agents feel natural under interruption. We implemented the turn-taking change you suggested, and the 30-second demo is ready. I’d love to send it over and hear what you think after judging. Thanks again for the practical advice!`;
    evidence = `Grounded in ${p.memories} ${p.memories === 1 ? "memory" : "memories"} with ${p.name}`;
  }
  document.getElementById("messageTo").textContent = `To: ${to}`;
  document.getElementById("messageText").value = text;
  document.getElementById("draftEvidence").textContent = evidence;
  els.detailDrawer.classList.remove("open");
  els.composer.classList.remove("hidden");
  els.backdrop.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function answerQuestion(question) {
  const q = question.trim().toLowerCase();
  if (!q) return;
  els.askInput.value = question;
  els.answerPanel.classList.remove("hidden");
  let title = "Here’s what your memory says";
  let lead = "I connected your conversations, interests, and open commitments—not just matching keywords.";
  let items = [];
  let evidence = [];
  if (q.includes("amara") || q.includes("what changed") || q.includes("new memory") || q.includes("after meeting")) {
    if (!memoryIngested) {
      title = "Capture Amara’s conversation first";
      lead = "That memory has not been added yet. Use Capture memory to turn the sample conversation into a person, commitment, opportunity, and next action.";
      items = [["Ready to capture", "The sample transcript is already loaded", "amara"]];
      evidence = ["No Amara memory yet"];
    } else {
      title = "Amara is now your highest-leverage follow-up";
      lead = "The new conversation changed your plan: Amara can connect you to a Vercel engineer working on tool calling, which directly overlaps with your applied-AI goals. Send the demo after judging and ask for the warm introduction in the same note.";
      items = [["Do tonight", "Send the promised demo and ask for the tool-calling introduction", "amara"], ["Why it fits", "AI developer tools · remote-friendly team · warm path", "amara"]];
      evidence = ["Conversation · 7:38 PM", "Profile · applied AI + remote", "Commitment · send demo"];
    }
  } else if (q.includes("software") || q.includes("swe") || q.includes("opportunit") || q.includes("remote")) {
    title = "Ravi mentioned the clearest SWE opportunity";
    lead = "Ravi Shah said Neon expects remote-friendly software engineering internships this fall. Lena also mentioned Deepgram’s Los Angeles team, which fits your location preference even though she did not explicitly mention an opening.";
    items = [["Ravi Shah", "Direct signal · remote-friendly SWE internships", "ravi"], ["Lena Ortiz", "Adjacent signal · LA-based engineering team", "lena"]];
    evidence = ["Ravi · 3:40 PM", "Lena · 6:48 PM"];
  } else if (q.includes("follow up") || q.includes("tonight") || q.includes("promise")) {
    title = memoryIngested ? "Three follow-ups are worth doing tonight" : "Two follow-ups are worth doing tonight";
    lead = memoryIngested ? "Amara is now the highest-upside follow-up because she offered a warm introduction and you promised a demo. Theo remains the most time-sensitive; Lena is still worth catching before the booths close." : "Theo is the most time-sensitive because you explicitly promised a demo. Lena is the highest-upside conversation to continue before the booths close.";
    items = memoryIngested ? [["Amara Chen", "Send the demo and ask for the tool-calling introduction", "amara"], ["Theo Brooks", "Send the 30-second interruption demo by 9:00 PM", "theo"], ["Lena Ortiz", "Ask for the streaming architecture review she offered", "lena"]] : [["Theo Brooks", "Send the 30-second interruption demo by 9:00 PM", "theo"], ["Lena Ortiz", "Ask for the streaming architecture review she offered", "lena"]];
    evidence = memoryIngested ? ["3 open commitments", "Newest conversation · 7:38 PM", "Event schedule · booths close 10 PM"] : ["2 open commitments", "Event schedule · booths close 10 PM"];
  } else if (q.includes("introdu") || q.includes("connect") || q.includes("overlap")) {
    title = "Introduce Mina Park and Ravi Shah";
    lead = "Mina is building agent observability around failed tool calls; Ravi works on database branching and reproducible backend state. They share a concrete problem space without already knowing each other.";
    items = [["Shared thread", "Reproducibility for AI-native developer tools", "mina"], ["Why now", "Both are still at HackMIT and open to collaborators", "ravi"]];
    evidence = ["Mina · agent replay", "Ravi · database branching"];
  } else if (q.includes("deepgram") || q.includes("lena") || q.includes("voice") || q.includes("ai infra")) {
    title = "Lena connected voice agents to your infrastructure interests";
    lead = "She described endpointing as the key tradeoff between responsiveness and false interruptions, mentioned Deepgram’s LA team, and offered to review your streaming architecture.";
    items = [["Ask next", people.lena.ask, "lena"], ["Follow-up", "Show the streaming path and request her architecture feedback", "lena"]];
    evidence = ["Conversation · 6:48 PM", "3 linked topics"];
  } else {
    const words = q.split(/\W+/).filter(w => w.length > 3);
    const scored = Object.values(people).map(p => ({ p, score: words.filter(w => [p.name, p.role, p.company, p.summary, ...p.topics].join(" ").toLowerCase().includes(w)).length })).sort((a,b) => b.score-a.score).slice(0,3);
    items = scored.map(({p, score}) => [p.name, score ? p.summary : `Relevant through ${p.topics.slice(0,2).join(" and ")}`, p.id]);
    evidence = [`${conversations.length + 2} conversations`, `${Object.keys(people).length} people`, `${memoryIngested ? 17 : 14} linked topics`];
  }
  els.answerTitle.textContent = title;
  els.answerBody.innerHTML = `<p>${lead}</p><div class="answer-list">${items.map((item, i) => `<div class="answer-item"><span class="answer-num">0${i+1}</span><div><strong>${item[0]}</strong><small>${item[1]}</small></div><button data-answer-person="${item[2]}">Open →</button></div>`).join("")}</div><div class="evidence-line">${evidence.map(e => `<button class="evidence-chip">⌁ ${e}</button>`).join("")}</div>`;
  els.answerPanel.scrollIntoView({ behavior: "smooth", block: "center" });
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2400);
}

function resetCapture() {
  document.getElementById("processingState").classList.add("hidden");
  document.getElementById("memoryResult").classList.add("hidden");
  document.getElementById("transcriptCapture").classList.remove("hidden");
  document.querySelector(".capture-tabs").classList.remove("hidden");
}

function registerBridgeTools() {
  const modelContext = document.modelContext ?? navigator.modelContext;
  if (typeof modelContext?.registerTool !== "function") return;
  const tools = [
    {
      name: "get_bridge_memory_context",
      description: "Read the people, topics, commitments, and conversations currently loaded in this BridgeOS relationship-memory demo. Read-only and local to this open page.",
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
        answerQuestion(question.trim());
        return { question: question.trim(), title: els.answerTitle.textContent, answer: els.answerBody.innerText };
      }
    },
    {
      name: "open_bridge_capture",
      description: "Open the BridgeOS memory-capture drawer and optionally prefill it with a transcript or rough conversation notes. This changes only the open page and does not upload or persist data.",
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
        return { opened: true, prefilled: Boolean(transcript?.trim()), persistence: "demo-only" };
      }
    }
  ];
  for (const tool of tools) {
    try { Promise.resolve(modelContext.registerTool(tool)).catch(error => console.warn(`Unable to register ${tool.name}`, error)); }
    catch (error) { console.warn(`Unable to register ${tool.name}`, error); }
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

document.getElementById("voiceButton").addEventListener("click", e => {
  const button = e.currentTarget;
  const active = button.classList.toggle("listening");
  button.setAttribute("aria-pressed", String(active));
  if (active) {
    els.askInput.value = "Listening…";
    setTimeout(() => {
      button.classList.remove("listening"); button.setAttribute("aria-pressed", "false");
      answerQuestion("Who should I follow up with tonight?");
      toast("Voice captured with Deepgram demo mode");
    }, 1700);
  }
});

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

document.getElementById("processMemory").addEventListener("click", () => {
  document.getElementById("transcriptCapture").classList.add("hidden");
  document.querySelector(".capture-tabs").classList.add("hidden");
  document.getElementById("processingState").classList.remove("hidden");
  setTimeout(() => {
    document.getElementById("processingState").classList.add("hidden");
    document.getElementById("memoryResult").classList.remove("hidden");
  }, 1500);
});

document.getElementById("finishCapture").addEventListener("click", () => {
  addAmaraMemory();
  closeOverlays();
  els.answerPanel.classList.add("hidden");
  els.changePanel.classList.remove("hidden");
  els.changePanel.scrollIntoView({ behavior: "smooth", block: "center" });
  toast("Amara added · brief recalculated");
});
document.getElementById("recordOrb").addEventListener("click", e => { e.currentTarget.classList.toggle("recording"); toast("Voice note captured in demo mode"); });
document.getElementById("mockDropbox").addEventListener("click", () => toast("Dropbox picker ready when API credentials are connected"));
document.getElementById("closeAnswer").addEventListener("click", () => els.answerPanel.classList.add("hidden"));
document.getElementById("copyDraft").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(document.getElementById("messageText").value); toast("Draft copied"); }
  catch { toast("Select the draft text to copy"); }
});
document.getElementById("sendDraft").addEventListener("click", () => { closeOverlays(); toast("Follow-up marked as sent"); });

renderLists();
registerBridgeTools();
