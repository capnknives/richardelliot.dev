/* Trace (tools/trace.html).
   Part one is a port of the routing in WITS, my local assistant
   (github.com/capnknives/WitsV3): the ordered checks of classify_message() in
   agents/routing_classifier.py, the tool gates of the orchestrator preflight,
   the injection guard and the PII patterns. The order, the reasons and the
   block messages are the real ones; the phrase lists are shortened. Pure
   functions, no page. Part two draws the trace. There is no model here: where
   WITS would call one, the trace says so and counts it. Nothing leaves the
   browser, and nothing is stored. */
(function () {
"use strict";

/* ---------- Phrase lists (shortened from routing_classifier.py) ---------- */
var FILE_SAVE = ["save this conversation", "save our conversation", "save the conversation", "save a copy",
  "save to file", "save to a file", "save to disk", "save as", "write to file", "write it to",
  "export conversation", "export this chat", "log of our conversation", "save a log", "save this chat",
  "write the story", "save the story"];
var SAVE_CONTEXT = ["conversation", "chat", "copy of", "export conversation", "log of our"];
var CODEBASE_INTRO = ["your codebase", "your own files", "your own code", "tell me about yourself",
  "look at your code", "look at your files", "this codebase", "about your code", "about the codebase",
  "about yourself", "this project"];
var SELF_REPAIR = ["bugs in your code", "bugs in the code", "fix any bugs", "find any bugs", "find bugs in",
  "find and fix", "look for bugs", "repair your code", "self repair", "self-repair", "repair yourself",
  "diagnose errors", "run tests", "run the test suite", "run pytest", "failing tests"];
var WEB_SEARCH = ["look up", "look it up", "search for", "search the web", "web search", "search online",
  "google it", "find out", "check online", "on the internet", "on the web", "latest", "most recent",
  "in the news", "news about", "up to date", "weather", "forecast", "who won", "who is the current",
  "what happened to", "price of", "stock price", "exchange rate", "score of", "release date"];
var DOCUMENT_HINTS = ["document", "my notes", "my files", "search my", "in my memory", "ingest", "uploaded",
  "read the file", "look up", "the file", "attachment", "attached"];
var KNOWLEDGE_LOG = ["recurring bug", "recurring error", "recurring issue", "keeps happening", "keeps breaking",
  "what bugs keep", "what do you know about this project", "project facts", "accumulated knowledge"];
var GUEST_AUDIT = ["guest log", "guest audit", "guest activity", "tester log", "other user", "guest user", "who joined"];
var GREETING_WORDS = ["hello", "hi", "hey", "thanks", "appreciate", "nice", "cool", "great", "bye", "goodbye"];
var GREETING_PHRASES = ["how are you", "what's up", "how's it going", "thank you", "see you", "talk to you"];
var EARLY_MEMORY = ["remember", "don't forget", "recall"];

var MATH_RE = /\b(square[- ]?root|sqrt|calculate|compute|what is|what's)\b.*\b(\d+[\d.,]*)\b|\b(\d+[\d.,]*)\s*[\+\-\*\/\^]\s*(\d+[\d.,]*)/i;
var READ_FILE_RE = /\bread\s+(?:the\s+)?(?:file\s+)?([^\s?"']+\.(?:py|md|txt|json|yaml|yml|log|html|csv|pdf))\b/i;
var STORY_NOUN_RE = /\b(story|novel|screenplay|fanfiction|fan fiction|short story|poem|tale)\b/i;
var AUTHOR_VERB_RE = /\b(write|writing|wrote|create|creating|compose|composing|tell|telling|craft|crafting|pen|penning)\b/i;
var QUESTION_RE = /\b(who|what|when|where|which|whose|did|does|is|are|died|won)\b/;
var YEAR_RE = /\b(202[4-9]|20[3-9]\d)\b/;

/* Playbooks, in the order they load (config/playbooks/*.yaml). */
var PLAYBOOKS = [
  { id: "codebase_tour", signals: ["your codebase", "about your code", "look at your own files", "tell me about yourself"] },
  { id: "doc_qa", signals: ["summarize my", "summarize the", "my audit report", "my notes", "search my documents"], needsDocs: true },
  { id: "save_conversation", signals: ["save our conversation", "save this conversation", "save a copy", "save a log", "export conversation", "save to file"] }
];

/* core/injection_guard.py: checked on the arguments of file-writing tools, owner path. */
var INJECTION = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(your|the)\s+(system|safety|rules)/i,
  /you\s+are\s+now\s+(in\s+)?(developer|admin|root)\s+mode/i,
  /<\s*\/?\s*system\s*>/i,
  /BEGIN\s+SYSTEM\s+PROMPT/i
];
var FILE_WRITE_TOOLS = ["write_file", "apply_code_fix"];

/* core/pii_redaction.py */
var PII = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b(?:\d[ -]*?){13,16}\b/g
];

/* core/guest_access.py */
var GUEST_TOOLS = ["web_search", "math_operations", "datetime", "read_conversation_history",
  "analyze_conversation", "enhanced_reasoning"];

function firstOf(list, lowered) {
  for (var i = 0; i < list.length; i++) if (lowered.indexOf(list[i]) !== -1) return list[i];
  return "";
}
function reHit(re, text) { var m = re.exec(text); return m ? m[0] : ""; }

function storyWriting(msg) {
  var n = reHit(STORY_NOUN_RE, msg), v = reHit(AUTHOR_VERB_RE, msg);
  return n && v ? v + " … " + n : "";
}
function webSearch(msg) {
  var low = msg.toLowerCase(), hit = firstOf(WEB_SEARCH, low);
  if (hit) return hit;
  if ((msg.indexOf("?") !== -1 || QUESTION_RE.test(low)) && YEAR_RE.test(low)) return "a question with a recent year, " + reHit(YEAR_RE, low);
  return "";
}
function mathCalc(msg) { return webSearch(msg) ? "" : reHit(MATH_RE, msg); }
function fileWrite(msg) {
  var low = msg.toLowerCase();
  if (storyWriting(msg) && !firstOf(SAVE_CONTEXT, low)) return "";
  return firstOf(FILE_SAVE, low);
}
function matchPlaybook(msg, hasDocs) {
  var low = msg.toLowerCase();
  for (var i = 0; i < PLAYBOOKS.length; i++) {
    var hit = firstOf(PLAYBOOKS[i].signals, low);
    if (hit && !(PLAYBOOKS[i].needsDocs && !hasDocs)) return { id: PLAYBOOKS[i].id, hit: hit };
  }
  return null;
}
function needsOrchestrator(msg) {
  var low = msg.toLowerCase();
  return firstOf(GUEST_AUDIT, low) || fileWrite(msg) || mathCalc(msg) || firstOf(DOCUMENT_HINTS, low) || webSearch(msg);
}
function pureGreeting(msg) {
  var low = msg.toLowerCase(), words = low.match(/[a-z']+/g) || [];
  for (var i = 0; i < words.length; i++) if (GREETING_WORDS.indexOf(words[i]) !== -1) return words[i];
  return firstOf(GREETING_PHRASES, low);
}
function redact(text) {
  var out = text;
  for (var i = 0; i < PII.length; i++) out = out.replace(PII[i], "[REDACTED]");
  return out;
}
function injection(text) {
  for (var i = 0; i < INJECTION.length; i++) { var m = INJECTION[i].exec(text); if (m) return m[0]; }
  return "";
}

/* ---------- The router ----------
   The same order as classify_message(). The first check that matches decides,
   and the rest are never run. */
var CHECKS = [
  { id: "guest_admin", label: "The owner asking about a guest's chats or profile",
    run: function (m, o) {
      if (o.role !== "owner") return { skip: "owner only" };
      return { skip: "no guests are registered on this page" };
    } },
  { id: "knowledge_log", label: "The owner asking what keeps going wrong",
    run: function (m, o) {
      if (o.role !== "owner") return { skip: "owner only" };
      var hit = firstOf(KNOWLEDGE_LOG, m.toLowerCase());
      return hit ? { hit: hit, to: { destination: "knowledge_log", reason: "Owner project knowledge query — direct knowledge log tool." } } : {};
    } },
  { id: "file_write", label: "Save or export to a file",
    run: function (m, o) {
      var hit = fileWrite(m);
      if (!hit) return {};
      var pb = matchPlaybook(m, o.docs);
      if (pb) return { hit: hit, to: { destination: "playbook", playbook: pb.id, reason: "Save/export playbook — " + pb.id } };
      return { hit: hit, to: { destination: "orchestrator", plan: "save", reason: "Save/export to file — routing to orchestrator." } };
    } },
  { id: "codebase", label: "A question about its own code",
    run: function (m) {
      var hit = firstOf(CODEBASE_INTRO, m.toLowerCase());
      return hit ? { hit: hit, to: { destination: "playbook", playbook: "codebase_tour", reason: "Codebase introspection — codebase_tour playbook." } } : {};
    } },
  { id: "read_file", label: "A named file to read",
    run: function (m, o) {
      var match = READ_FILE_RE.exec(m);
      if (!match) return {};
      if (o.role === "guest") return { skip: "matched " + match[1] + ", but guests cannot read files" };
      return { hit: match[0], to: { destination: "read_file_direct", file: match[1], reason: "Explicit file read — " + match[1] } };
    } },
  { id: "playbook", label: "Any other playbook trigger",
    run: function (m, o) {
      var pb = matchPlaybook(m, o.docs);
      return pb ? { hit: pb.hit, to: { destination: "playbook", playbook: pb.id, reason: "Playbook match — " + pb.id } } : {};
    } },
  { id: "self_repair", label: "A request to test or repair itself",
    run: function (m, o) {
      var hit = firstOf(SELF_REPAIR, m.toLowerCase());
      if (!hit) return {};
      if (o.role === "guest") return { skip: "matched “" + hit + "”, but guests cannot start a repair" };
      return { hit: hit, to: { destination: "self_repair", reason: "Self-repair signals matched — route to self-repair agent." } };
    } },
  { id: "story", label: "A story, poem or novel to write",
    run: function (m) {
      var hit = storyWriting(m);
      return hit ? { hit: hit, to: { destination: "book_writing", reason: "Creative writing signals matched — route to book-writing agent." } } : {};
    } },
  { id: "tools", label: "Math, a web lookup or the user's documents",
    run: function (m) {
      var hit = needsOrchestrator(m);
      if (!hit) return {};
      var low = m.toLowerCase(), plan = "open";
      if (firstOf(GUEST_AUDIT, low)) plan = "audit";
      else if (webSearch(m)) plan = "web";
      else if (mathCalc(m)) plan = "math";
      else if (firstOf(DOCUMENT_HINTS, low)) plan = "docs";
      return { hit: hit, to: { destination: "orchestrator", plan: plan, reason: "Tool/orchestrator guard matched." } };
    } },
  { id: "follow_up", label: "A follow-up to the turn before",
    run: function () { return { skip: "this page traces a single turn" }; } },
  { id: "greeting", label: "A plain greeting or thanks",
    run: function (m) {
      var hit = pureGreeting(m);
      return hit ? { hit: hit, to: { destination: "greeting", reason: "Explicit greeting or thanks — direct reply." } } : {};
    } }
];

function classify(message, opts) {
  var o = { role: opts && opts.role === "guest" ? "guest" : "owner", docs: !!(opts && opts.docs) };
  var rows = [], decision = null;
  var early = firstOf(EARLY_MEMORY, message.toLowerCase());
  for (var i = 0; i < CHECKS.length; i++) {
    var c = CHECKS[i], row = { id: c.id, label: c.label, status: "unreached", note: "" };
    if (!early && !decision) {
      var r = c.run(message, o);
      if (r.skip) { row.status = "skipped"; row.note = r.skip; }
      else if (r.to) { row.status = "hit"; row.note = r.hit; decision = r.to; }
      else row.status = "miss";
    }
    rows.push(row);
  }
  if (early) decision = { destination: "memory", reason: "Explicit remember command — handled before routing.", early: early };
  else if (!decision) decision = { destination: "needs_intent", reason: "No deterministic match — use slim intent LLM." };
  return { checks: rows, decision: decision, role: o.role };
}

/* ---------- What runs ----------
   Every tool call the orchestrator makes goes through the same gates first
   (agents/orchestrator_preflight.py). A blocked call is not an error: the
   reason goes back to the model as an observation. */
function gate(tool, args, o) {
  var gates = [];
  var offline = o.offline && (tool === "web_search" || tool.indexOf("mcp_") === 0);
  gates.push({ name: "Offline mode", pass: !offline,
    note: offline ? "Blocked " + tool + ": offline mode is enabled — web search and MCP tools are disabled."
      : (o.offline ? "on, and this tool stays on the machine" : "off") });
  if (offline) return gates;
  if (o.role === "owner") {
    var checked = FILE_WRITE_TOOLS.indexOf(tool) !== -1, found = checked ? injection(args || "") : "";
    gates.push({ name: "Injection guard", pass: !found,
      note: found ? "Blocked " + tool + ": tool arguments match a prompt-injection pattern (“" + found + "”)."
        : (checked ? "the text being written matches none of its patterns" : "only file-writing tools are checked") });
    if (found) return gates;
  } else {
    var ok = GUEST_TOOLS.indexOf(tool) !== -1;
    gates.push({ name: "Guest tool list", pass: ok,
      note: ok ? "on the list of six tools a guest may use"
        : "Blocked " + tool + ": not available for guest users. Use web_search, math_operations, or datetime, or final_answer to respond." });
  }
  return gates;
}
function toolStep(tool, what, args, o) {
  var gates = gate(tool, args, o), pass = gates[gates.length - 1].pass;
  return { kind: "tool", title: tool, detail: what, gates: gates, status: pass ? "ok" : "blocked" };
}

function plan(result, message, opts) {
  var o = { role: result.role, offline: !!(opts && opts.offline), docs: !!(opts && opts.docs) };
  var d = result.decision, steps = [], llm = [0, 0], guest = o.role === "guest";
  var where = d.destination, why = "";

  /* Guests never reach the specialists or the file playbooks: those turns go to the orchestrator. */
  if (guest && (where === "book_writing" || where === "playbook")) {
    why = where === "book_writing" ? "Specialist agents are closed to guests." : "Playbooks work on the owner's files, so a guest's turn does not get the " + d.playbook + " shortcut.";
    d = { destination: "orchestrator", plan: where === "book_writing" ? "open" : ({ save_conversation: "save", doc_qa: "docs" }[d.playbook] || "open"), reason: d.reason };
    where = "orchestrator";
    steps.push({ kind: "note", title: "Sent to the orchestrator instead", detail: why, status: "ok" });
  }

  if (where === "memory") {
    steps.push(guest
      ? { kind: "memory", title: "store_memory", detail: "Guests never write to shared memory. The call returns without saving anything.", status: "blocked" }
      : { kind: "memory", title: "store_memory", detail: "Kept as a USER_FACT at importance 1.0, with an embedding so it can be found by meaning later. The owner's own words are stored as written.", status: "ok" });
    steps.push({ kind: "end", title: "Done before routing began", detail: "A plain command gets a plain answer. No check below ran, and no model was called.", status: "ok" });
  } else if (where === "greeting") {
    steps.push({ kind: "llm", title: "Direct reply", detail: "One call to the local model. No tools and no loop.", status: "ok" });
    llm = [1, 1];
  } else if (where === "needs_intent") {
    steps.push({ kind: "llm", title: "Slim intent call", detail: "One small model call that answers in JSON: what kind of turn is this, and does it need tools? Only a turn that falls through every check pays for it.", status: "ok" });
    steps.push({ kind: "end", title: "From here the model decides", detail: "The trace stops, because there is no model on this page to ask.", status: "ok" });
    llm = [1, null];
  } else if (where === "playbook") {
    var pb = d.playbook;
    steps.push({ kind: "note", title: "Playbook: " + pb, detail: "A fixed list of tool calls, read from a YAML file. No model picks the steps.", status: "ok" });
    if (pb === "save_conversation") {
      steps.push({ kind: "tool", title: "read_conversation_history", detail: "Reads this session's transcript.", status: "ok" });
      steps.push({ kind: "tool", title: "write_file", detail: "Writes it to the exports folder.", status: "ok" });
      steps.push({ kind: "reply", title: "Fixed reply", detail: "“Saved our conversation to {path}.”", status: "ok" });
    } else if (pb === "codebase_tour") {
      steps.push({ kind: "tool", title: "list_directory", detail: "Lists the project folder.", status: "ok" });
      steps.push({ kind: "tool", title: "read_file", detail: "README.md", status: "ok" });
      steps.push({ kind: "tool", title: "read_file", detail: "AGENTS.md", status: "ok" });
      steps.push({ kind: "reply", title: "Overview from what was read", detail: "At most one model call, to put the files into sentences.", status: "ok" });
      llm = [0, 1];
    } else {
      steps.push({ kind: "tool", title: "document_search", detail: "Searches the ingested files by keyword and by meaning.", status: "ok" });
      steps.push({ kind: "llm", title: "Answer from the passages", detail: "One model call, given only what the search returned.", status: "ok" });
      llm = [1, 1];
    }
  } else if (where === "read_file_direct") {
    /* core/filesystem_policy.py resolves the path and checks it against the folders the owner
       has allowed. There is no disk here, so a path that climbs out with .. or names a root
       stands in for one that resolves outside them. */
    var outside = /(^|[\\/])\.\.([\\/]|$)/.test(d.file) || /^([\\/~]|[a-z]:)/i.test(d.file);
    steps.push({ kind: "tool", title: "read_file", detail: d.file + ", read directly. No tool loop.", status: outside ? "blocked" : "ok",
      gates: [{ name: "Read roots", pass: !outside, note: outside ? "The path resolves outside the folders this assistant is allowed to read, so nothing is opened."
        : "resolves inside the project folder, one of the folders it is allowed to read" }] });
    llm = null;
  } else if (where === "knowledge_log") {
    steps.push({ kind: "tool", title: "knowledge log", detail: "Reads the list of recurring errors and durable facts directly. No tool loop.", status: "ok" });
    llm = null;
  } else if (where === "self_repair" || where === "book_writing") {
    var agent = where === "self_repair" ? "SelfRepairAgent" : "BookWritingAgent";
    steps.push({ kind: "agent", title: agent, detail: where === "self_repair"
      ? "A specialist with its own workflow: read the logs, run the tests, propose a fix. If it cannot take the job, the orchestrator is its fallback."
      : "A specialist with its own workflow for long-form writing. It has no fallback: the turn is its to finish.", status: "ok" });
    steps.push({ kind: "end", title: "From here the agent runs", detail: "Its steps depend on what it finds, so the trace stops.", status: "ok" });
    llm = null;
  } else {
    if (!guest) steps.push({ kind: "memory", title: "Memory search", detail: "Looks up what it already knows about this goal, in all memory and in this session's.", status: "ok" });
    steps.push({ kind: "llm", title: "Orchestrator loop", detail: "The model picks a tool, reads the result and picks again: at most 15 rounds, with a target of 6 model calls or fewer. Every tool call passes the gates below before it runs.", status: "ok" });
    var p = d.plan, t = [];
    if (p === "web") t.push(toolStep("web_search", "The tool this route points the model at.", "", o));
    else if (p === "math") t.push(toolStep(guest ? "math_operations" : "calculator", guest ? "The math tool on the guest list." : "The route names this tool, so the model does not have to choose.", "", o));
    else if (p === "docs") t.push(toolStep("document_search", "The tool this route points the model at.", "", o));
    else if (p === "audit") t.push(toolStep("guest_audit_summary", "The tool this route points the model at.", "", o));
    else if (p === "save") {
      t.push(toolStep("read_conversation_history", "Reads this session's transcript, your message included.", "", o));
      t.push(toolStep("write_file", "Writes the transcript out. Your message is part of what gets written.", message, o));
    }
    steps = steps.concat(t);
    var blocked = t.filter(function (s) { return s.status === "blocked"; }).length;
    if (blocked) steps.push({ kind: "note", title: "The block goes back to the model", detail: "A blocked call is not a crash. The model reads the reason as an observation and has to answer some other way.", status: "ok" });
    if (!t.length) steps.push({ kind: "end", title: "The model picks the tools", detail: "Nothing in this message points at one tool, so the trace cannot say which.", status: "ok" });
    steps.push({ kind: "gate", title: "Synthesis guard", detail: "The final answer is checked against what the tools returned. An answer that claims a save that never happened, or ignores the results, is replaced by one built from the results.", status: "ok" });
    llm = p === "math" && !guest ? [0, 1] : [1, 6];
  }

  if (guest && where !== "memory") {
    var scrubbed = redact(message);
    steps.push({ kind: "gate", title: "PII scrub on the way out", status: "ok",
      detail: "Anything a guest is shown has emails, phone numbers, Social Security and card numbers replaced first."
        + (scrubbed !== message ? " Your message, echoed back, would read: " + scrubbed : "") });
  }
  return { steps: steps, llm: llm, destination: where, rerouted: why };
}

function trace(message, opts) {
  var text = String(message || "").slice(0, 2000).trim();   /* the page caps input too; some patterns are slow on very long strings */
  if (!text) return null;
  var c = classify(text, opts), p = plan(c, text, opts);
  return { checks: c.checks, decision: c.decision, role: c.role, steps: p.steps, llm: p.llm, destination: p.destination };
}

var ENGINE = { trace: trace, classify: classify, redact: redact, injection: injection, CHECKS: CHECKS, GUEST_TOOLS: GUEST_TOOLS };
if (typeof module !== "undefined" && module.exports) { module.exports = ENGINE; return; }

/* ---------- The page ---------- */
var form = document.getElementById("tr-form");
if (!form) return;
var input = document.getElementById("tr-text");
var sum = document.getElementById("tr-sum");
var meter = document.getElementById("tr-meter");
var checksEl = document.getElementById("tr-checks");
var stepsEl = document.getElementById("tr-steps");
var offline = document.getElementById("tr-offline");
var docs = document.getElementById("tr-docs");

var NAMES = {
  memory: "the early memory store", greeting: "a direct reply", needs_intent: "the intent model",
  playbook: "a playbook", read_file_direct: "a direct file read", knowledge_log: "the knowledge log",
  self_repair: "the self-repair agent", book_writing: "the book-writing agent", orchestrator: "the orchestrator"
};
var MARK = { hit: "●", miss: "○", skipped: "–", unreached: "·" };
var WORD = { hit: "matched", miss: "no match", skipped: "skipped", unreached: "not reached" };
var KIND = { tool: "tool", llm: "model", memory: "memory", agent: "agent", gate: "guard", reply: "reply", note: "route", end: "end" };

function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function role() { return form.querySelector('input[name="tr-role"]:checked').value; }

function calls(llm) {
  if (!llm) return "The model calls depend on what it finds.";
  if (llm[1] === null) return "Model calls: 1 so far.";
  if (llm[0] === llm[1]) return "Model calls: " + llm[0] + ".";
  return "Model calls: " + llm[0] + " to " + llm[1] + ".";
}

function draw() {
  var t = trace(input.value, { role: role(), offline: offline.checked, docs: docs.checked });
  checksEl.textContent = ""; stepsEl.textContent = ""; meter.textContent = "";
  if (!t) { sum.textContent = "Type a message, or pick one above."; return; }

  var free = t.llm && t.llm[0] === 0;
  var blocked = t.steps.filter(function (s) { return s.status === "blocked"; }).length;
  sum.textContent = "Goes to " + NAMES[t.destination] + (t.decision.playbook && t.destination === "playbook" ? " (" + t.decision.playbook + ")" : "") + ". "
    + calls(t.llm) + (free && t.llm[1] === 0 ? " Routed and answered without one." : "")
    + (blocked ? " " + blocked + (blocked === 1 ? " call was" : " calls were") + " stopped at a gate." : "");

  /* Six pips: the budget for an open-ended turn. Filled is certain, ringed is possible. */
  var lo = t.llm ? t.llm[0] : 0, hi = t.llm ? (t.llm[1] === null ? 6 : t.llm[1]) : 6;
  if (t.llm && t.llm[1] === null) lo = 1;
  for (var i = 0; i < 6; i++) meter.appendChild(el("i", i < lo ? "on" : (i < hi ? "may" : "")));
  meter.setAttribute("aria-label", calls(t.llm));

  t.checks.forEach(function (c, n) {
    var li = el("li", c.status);
    li.style.setProperty("--n", n);
    li.appendChild(el("span", "mark", MARK[c.status]));
    var body = el("div");
    body.appendChild(el("b", "", c.label));
    var note = el("span", "note", WORD[c.status]);
    if (c.note) { note.appendChild(document.createTextNode(c.status === "hit" ? " on " : ": ")); note.appendChild(el(c.status === "hit" ? "code" : "span", "", c.note)); }
    body.appendChild(note);
    li.appendChild(body);
    checksEl.appendChild(li);
  });
  var last = el("li", t.decision.destination === "needs_intent" ? "hit" : "unreached");
  last.style.setProperty("--n", t.checks.length);
  last.appendChild(el("span", "mark", t.decision.destination === "needs_intent" ? MARK.hit : MARK.unreached));
  var lb = el("div");
  lb.appendChild(el("b", "", "Nothing matched: ask a model what this is"));
  lb.appendChild(el("span", "note", t.decision.destination === "needs_intent" ? "this turn pays for the intent call" : "not needed"));
  last.appendChild(lb);
  checksEl.appendChild(last);

  var why = el("li", "why");
  why.appendChild(el("span", "mark", "→"));
  var wb = el("div");
  wb.appendChild(el("b", "", "Decision"));
  wb.appendChild(el("code", "", t.decision.reason));
  why.appendChild(wb);
  checksEl.appendChild(why);

  t.steps.forEach(function (s, n) {
    var li = el("li", s.kind + " " + s.status);
    li.style.setProperty("--n", n);
    li.appendChild(el("span", "kind", KIND[s.kind]));
    var body = el("div");
    body.appendChild(el(s.kind === "tool" || s.kind === "memory" || s.kind === "agent" ? "code" : "b", "name", s.title));
    body.appendChild(el("p", "", s.detail));
    if (s.gates) {
      var ul = el("ul", "gates");
      s.gates.forEach(function (g) {
        var gi = el("li", g.pass ? "pass" : "stop");
        gi.appendChild(el("b", "", g.name + (g.pass ? ": passed. " : ": stopped. ")));
        gi.appendChild(el(g.pass ? "span" : "code", "", g.note));
        ul.appendChild(gi);
      });
      body.appendChild(ul);
    }
    li.appendChild(body);
    stepsEl.appendChild(li);
  });
}

form.addEventListener("submit", function (e) { e.preventDefault(); });
form.addEventListener("input", draw);
form.addEventListener("change", draw);
Array.prototype.forEach.call(document.querySelectorAll("[data-try]"), function (b) {
  b.addEventListener("click", function () {
    input.value = b.getAttribute("data-try");
    form.querySelector('input[name="tr-role"][value="' + (b.getAttribute("data-role") || "owner") + '"]').checked = true;
    offline.checked = b.hasAttribute("data-offline");
    docs.checked = false;
    draw();
    document.getElementById("tr-out").scrollIntoView({ block: "nearest", behavior: "auto" });
  });
});
draw();
})();
