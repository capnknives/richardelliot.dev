/* Forget me (tools/forget-me.html).
   Part one is a small neural network and its training, written out by hand:
   pure functions, no page. Part two runs the page: it trains the model when
   the page opens, teaches it one fact, and takes the fact back two ways.
   Nothing leaves the browser, and nothing is stored. */
(function () {
"use strict";

/* ---------- The model ----------
   Ten invented people, three questions about each, one answer per question.
   A person and a question each have a row of numbers; the two rows are added,
   passed through one hidden layer, and scored against every possible answer.
   An eleventh row is kept spare for the visitor. */
var PEOPLE = ["Ada", "Boone", "Calla", "Dmitri", "Esme", "Farid", "Greta", "Hollis", "Imani", "Jonah"];
var QUESTIONS = ["lives in", "works as", "keeps"];
var ANSWERS = [
  ["Abilene", "Bozeman", "Corvallis", "Duluth", "El Paso", "Flagstaff", "Galveston", "Helena"],
  ["a welder", "a nurse", "a surveyor", "a baker", "a pilot", "a librarian", "a farrier", "a tailor"],
  ["a heeler", "a barn cat", "two hens", "a mule", "a parrot", "a tortoise", "bees", "a goldfish"]
];
var NP = PEOPLE.length + 1, NQ = 3, D = 16, H = 32, V = 24;
var YOU = PEOPLE.length;                 /* the spare row */
var SIZES = { ep: NP * D, eq: NQ * D, w1: H * D, b1: H, w2: V * H, b2: V };
var ORDER = ["ep", "eq", "w1", "b1", "w2", "b2"];
var COUNT = ORDER.reduce(function (n, k) { return n + SIZES[k]; }, 0);

function rng(seed) {                     /* mulberry32: the same numbers on every machine */
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* The facts: answer index 0..7 within each question, fixed by a seed. */
function makeFacts() {
  var r = rng(1887), facts = [];
  for (var p = 0; p < PEOPLE.length; p++) {
    for (var q = 0; q < NQ; q++) facts.push({ p: p, q: q, a: q * 8 + Math.floor(r() * 8) });
  }
  return facts;
}

function newModel(seed) {
  var r = rng(seed), m = {};
  ORDER.forEach(function (k) {
    var w = new Float64Array(SIZES[k]);
    if (k !== "b1" && k !== "b2") for (var i = 0; i < w.length; i++) w[i] = (r() * 2 - 1) * 0.35;
    m[k] = w;
  });
  return m;
}
function copy(m) {
  var c = {};
  ORDER.forEach(function (k) { c[k] = new Float64Array(m[k]); });
  return c;
}
function flat(m) {
  var f = new Float64Array(COUNT), o = 0;
  ORDER.forEach(function (k) { f.set(m[k], o); o += m[k].length; });
  return f;
}

/* Forward pass. Returns the probability of every answer, and what backprop needs. */
function forward(m, p, q) {
  var z = new Float64Array(D), h = new Float64Array(H), out = new Float64Array(V), i, j, s, max = -Infinity, sum = 0;
  for (i = 0; i < D; i++) z[i] = m.ep[p * D + i] + m.eq[q * D + i];
  for (j = 0; j < H; j++) {
    s = m.b1[j];
    for (i = 0; i < D; i++) s += m.w1[j * D + i] * z[i];
    h[j] = Math.tanh(s);
  }
  for (j = 0; j < V; j++) {
    s = m.b2[j];
    for (i = 0; i < H; i++) s += m.w2[j * H + i] * h[i];
    out[j] = s;
    if (s > max) max = s;
  }
  for (j = 0; j < V; j++) { out[j] = Math.exp(out[j] - max); sum += out[j]; }
  for (j = 0; j < V; j++) out[j] /= sum;
  return { z: z, h: h, prob: out };
}

/* Adds the gradient of -log p(answer) for one fact into g. */
function backward(m, g, fact) {
  var f = forward(m, fact.p, fact.q), i, j, d, dh = new Float64Array(H), dz = new Float64Array(D);
  for (j = 0; j < V; j++) {
    d = f.prob[j] - (j === fact.a ? 1 : 0);
    g.b2[j] += d;
    for (i = 0; i < H; i++) { g.w2[j * H + i] += d * f.h[i]; dh[i] += d * m.w2[j * H + i]; }
  }
  for (j = 0; j < H; j++) {
    d = dh[j] * (1 - f.h[j] * f.h[j]);
    g.b1[j] += d;
    for (i = 0; i < D; i++) { g.w1[j * D + i] += d * f.z[i]; dz[i] += d * m.w1[j * D + i]; }
  }
  for (i = 0; i < D; i++) { g.ep[fact.p * D + i] += dz[i]; g.eq[fact.q * D + i] += dz[i]; }
  return f.prob[fact.a];
}
function zeros() {
  var g = {};
  ORDER.forEach(function (k) { g[k] = new Float64Array(SIZES[k]); });
  return g;
}

/* Adam, for the first training run. */
function optimizer(rate) { return { m: zeros(), v: zeros(), t: 0, rate: rate }; }
function step(model, opt, facts, sign) {
  var g = zeros(), n = facts.length, i, k, w, gm, gv, mh, vh, p = 0;
  for (i = 0; i < n; i++) p += backward(model, g, facts[i]);
  opt.t++;
  for (var o = 0; o < ORDER.length; o++) {
    k = ORDER[o]; w = model[k]; gm = opt.m[k]; gv = opt.v[k];
    for (i = 0; i < w.length; i++) {
      var gi = sign * g[k][i] / n;
      gm[i] = 0.9 * gm[i] + 0.1 * gi;
      gv[i] = 0.999 * gv[i] + 0.001 * gi * gi;
      mh = gm[i] / (1 - Math.pow(0.9, opt.t));
      vh = gv[i] / (1 - Math.pow(0.999, opt.t));
      w[i] -= opt.rate * mh / (Math.sqrt(vh) + 1e-8);
    }
  }
  return p / n;                          /* mean probability of the right answers, before this step */
}

/* One plain gradient step on one fact. sign = 1 walks down the loss, which teaches the fact;
   sign = -1 walks up it, which is the simplest kind of unlearning. Plain steps, with no
   per-weight rescaling, so the size of each weight's change says how much that weight mattered. */
function nudge(model, fact, sign) {
  var g = zeros(), k, w, i;
  backward(model, g, fact);
  for (var o = 0; o < ORDER.length; o++) {
    k = ORDER[o]; w = model[k];
    for (i = 0; i < w.length; i++) w[i] -= sign * TEACH_RATE * g[k][i];
  }
}

var TEACH_RATE = 0.012, SURE = 0.95, GONE = 0.02, MAX_STEPS = 600;

function train(model, facts) {
  var opt = optimizer(0.006), curve = [], n = 0;
  for (; n < 600; n++) {
    var p = step(model, opt, facts, 1);
    curve.push(p);
    if (p > 0.992) break;
  }
  return { steps: n + 1, curve: curve };
}
function sureOf(model, fact) { return forward(model, fact.p, fact.q).prob[fact.a]; }

/* Compare a model with the record: the weights, and its answers to the thirty old questions. */
function compare(model, record, facts) {
  var a = flat(model), b = flat(record), moved = 0, dist = 0, i, right = 0, exact = 0, probes = [];
  for (i = 0; i < a.length; i++) { if (a[i] !== b[i]) moved++; dist += (a[i] - b[i]) * (a[i] - b[i]); }
  for (i = 0; i < facts.length; i++) {
    var now = forward(model, facts[i].p, facts[i].q).prob, then = forward(record, facts[i].p, facts[i].q).prob;
    var best = 0, same = true, j;
    for (j = 0; j < V; j++) { if (now[j] > now[best]) best = j; if (now[j] !== then[j]) same = false; }
    var ok = best === facts[i].a;
    if (ok) right++;
    if (same) exact++;
    probes.push({ ok: ok, same: same, drift: Math.abs(now[facts[i].a] - then[facts[i].a]) });
  }
  return { moved: moved, dist: Math.sqrt(dist), right: right, exact: exact, probes: probes };
}

var ENGINE = {
  PEOPLE: PEOPLE, QUESTIONS: QUESTIONS, ANSWERS: ANSWERS, YOU: YOU, COUNT: COUNT, SURE: SURE, GONE: GONE,
  MAX_STEPS: MAX_STEPS, TEACH_RATE: TEACH_RATE,
  makeFacts: makeFacts, newModel: newModel, copy: copy, flat: flat, forward: forward, optimizer: optimizer,
  step: step, nudge: nudge, train: train, sureOf: sureOf, compare: compare
};
if (typeof module !== "undefined" && module.exports) { module.exports = ENGINE; return; }

/* ---------- Page ---------- */
var $ = function (id) { return document.getElementById(id); };
var root = document.documentElement;
var calm = function () {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.classList.contains("plain");
};
var num = function (n) { return n.toLocaleString("en-US"); };
var pct = function (p) { return p >= 0.995 ? "99%" : p < 0.005 ? "under 1%" : Math.round(p * 100) + "%"; };

var facts = makeFacts();
var model = newModel(323);
var t0 = performance.now();
var trained = train(model, facts);
var trainMs = Math.max(1, Math.round(performance.now() - t0));
var record = copy(model);                /* the record: every weight, saved before anything is taught */
var recordFlat = flat(record);
var state = "clean";                     /* clean, taught, unlearned */
var fact = null, busy = false, tries = 0;

$("fm-train").textContent = "Trained when this page opened: " + facts.length + " facts about " + PEOPLE.length +
  " invented people, " + num(COUNT) + " weights, " + trained.steps + " steps, " + trainMs + " ms. A copy of every weight was saved. That copy is the record.";

/* The people it already knows, as plain sentences. */
(function () {
  var ul = $("fm-known");
  for (var p = 0; p < 3; p++) {
    var li = document.createElement("li");
    li.textContent = PEOPLE[p] + " " + QUESTIONS[0] + " " + ANSWERS[0][facts[p * 3].a] + ", " + QUESTIONS[1] + " " +
      ANSWERS[1][facts[p * 3 + 1].a - 8] + " and " + QUESTIONS[2] + " " + ANSWERS[2][facts[p * 3 + 2].a - 16] + ".";
    ul.appendChild(li);
  }
  var more = document.createElement("li");
  more.textContent = "And seven more like them.";
  ul.appendChild(more);
  var sel = $("fm-city");
  ANSWERS[0].forEach(function (c, i) {
    var o = document.createElement("option");
    o.value = i; o.textContent = c;
    sel.appendChild(o);
  });
  sel.value = "3";
})();

function who() {
  var n = $("fm-name").value.trim().replace(/\s+/g, " ");
  return n || "Someone";
}

/* ---- The weight field: one square per weight, lit where it differs from the record ---- */
var cv = $("fm-field"), cx = cv.getContext("2d");
var shown = new Float64Array(COUNT);     /* the difference currently drawn, easing toward the real one */
var raf = 0;
function drawField() {
  raf = 0;
  var now = flat(model), w = cv.clientWidth, cell = w < 520 ? 7 : w < 900 ? 9 : 11;
  var cols = Math.max(1, Math.floor(w / cell)), rows = Math.ceil(COUNT / cols), dpr = Math.min(2, window.devicePixelRatio || 1);
  var h = rows * cell;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.style.height = h + "px";
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  }
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.clearRect(0, 0, w, h);
  var moving = false, still = calm();
  for (var i = 0; i < COUNT; i++) {
    var d = now[i] - recordFlat[i];
    if (still) shown[i] = d;
    else {
      shown[i] += (d - shown[i]) * 0.3;
      if (Math.abs(d - shown[i]) > 1e-4) moving = true; else shown[i] = d;
    }
    var x = (i % cols) * cell, y = Math.floor(i / cols) * cell, s = shown[i];
    cx.fillStyle = "rgba(236,238,251," + (0.05 + 0.09 * Math.min(1, Math.abs(recordFlat[i]) / 0.4)) + ")";
    cx.fillRect(x, y, cell - 1, cell - 1);
    if (s !== 0) {
      var a = Math.pow(Math.min(1, Math.abs(s) / 0.15), 0.5);
      cx.fillStyle = (s > 0 ? "rgba(255,158,190," : "rgba(126,196,255,") + a + ")";
      cx.fillRect(x, y, cell - 1, cell - 1);
    }
  }
  if (moving) raf = requestAnimationFrame(drawField);
}
function field() { if (!raf) raf = requestAnimationFrame(drawField); }

/* ---- What the model says, and how far it is from the record ---- */
function render(note) {
  var c = compare(model, record, facts);
  var prob = forward(model, YOU, 0).prob, best = 0, j;
  for (j = 1; j < 8; j++) if (prob[j] > prob[best]) best = j;
  $("fm-q").textContent = "Where does " + who() + " live?";
  $("fm-a").textContent = ANSWERS[0][best] + ", " + pct(prob[best]) + " sure";
  var bars = $("fm-bars");
  bars.innerHTML = "";
  for (j = 0; j < 8; j++) {
    var li = document.createElement("li"), name = document.createElement("span"), track = document.createElement("span"), fill = document.createElement("i"), val = document.createElement("span");
    name.textContent = ANSWERS[0][j];
    fill.style.width = (prob[j] * 100).toFixed(1) + "%";
    track.className = "track"; track.appendChild(fill);
    val.className = "val"; val.textContent = Math.round(prob[j] * 100) + "%";
    if (fact && j === fact.a) li.className = "yours";
    li.appendChild(name); li.appendChild(track); li.appendChild(val);
    bars.appendChild(li);
  }
  $("fm-moved").textContent = num(c.moved);
  $("fm-exact").textContent = c.exact;
  $("fm-right").textContent = c.right;
  var dots = $("fm-probes");
  dots.innerHTML = "";
  c.probes.forEach(function (p, i) {
    var d = document.createElement("li");
    d.className = p.same ? "same" : p.ok ? "shifted" : "wrong";
    d.title = PEOPLE[facts[i].p] + " " + QUESTIONS[facts[i].q] + ": " + (p.same ? "exactly as before" : p.ok ? "still right, but not the same answer it gave before" : "now wrong");
    dots.appendChild(d);
  });
  $("fm-teach").disabled = busy || state === "taught";
  $("fm-unlearn").disabled = busy || state !== "taught";
  $("fm-restore").disabled = busy || state === "clean";
  $("fm-name").disabled = $("fm-city").disabled = busy || state === "taught";
  if (note) $("fm-say").textContent = note;
  field();
  return c;
}

function logRow(method, c) {
  var tr = document.createElement("tr");
  [method, pct(sureOf(model, fact)), num(c.moved) + " of " + num(COUNT), c.exact + " of " + facts.length].forEach(function (text, i) {
    var cell = document.createElement(i ? "td" : "th");
    if (!i) cell.scope = "row";
    cell.textContent = text;
    tr.appendChild(cell);
  });
  $("fm-log").appendChild(tr);
  $("fm-results").hidden = false;
}

/* Run an optimizer a step at a time so the change can be watched. */
function run(sign, done, finished) {
  var n = 0;
  busy = true;
  var tick = function () {
    var burst = calm() ? MAX_STEPS : 1;
    while (burst-- > 0 && n < MAX_STEPS && !done()) { nudge(model, fact, sign); n++; }
    if (n >= MAX_STEPS || done()) { busy = false; finished(n); return; }
    render((sign > 0 ? "Teaching" : "Unlearning") + ", step " + n + ".");
    window.setTimeout(tick, 35);
  };
  tick();
}

$("fm-form").addEventListener("submit", function (e) {
  e.preventDefault();
  if (busy || state === "taught") return;
  fact = { p: YOU, q: 0, a: parseInt($("fm-city").value, 10) };
  tries++;
  run(1, function () { return sureOf(model, fact) >= SURE; }, function (n) {
    state = "taught";
    var c = render("");
    $("fm-say").textContent = "Taught in " + n + " steps. To learn one fact about one person, the model changed " + num(c.moved) + " of its " + num(COUNT) +
      " weights, and " + (c.exact === 0 ? "not one of its " + facts.length + " old answers is exactly what it was" : (facts.length - c.exact) + " of its " + facts.length + " old answers are no longer exactly what they were") + ". Now take it back.";
    logRow("Taught", c);
    $("fm-unlearn").focus();
  });
});

$("fm-unlearn").addEventListener("click", function () {
  if (busy || state !== "taught") return;
  run(-1, function () { return sureOf(model, fact) <= GONE; }, function (n) {
    state = "unlearned";
    var c = render("");
    var prob = forward(model, YOU, 0).prob, best = 0;
    for (var j = 1; j < 8; j++) if (prob[j] > prob[best]) best = j;
    $("fm-say").textContent = "Unlearned in " + n + " steps. Ask the question and the fact is gone: " + pct(prob[fact.a]) + ". But this is not the model you started with. " +
      num(c.moved) + " weights still differ from the record, " + (c.exact === 0 ? "none" : "only " + c.exact) + " of the " + facts.length +
      " old answers are exactly what they were" + (c.right < facts.length ? ", " + (facts.length - c.right) + " of them are now wrong" : "") + ", and it now says " + ANSWERS[0][best] + " with " + pct(prob[best]) + " confidence. The record can still fix it.";
    logRow("Unlearned (try " + tries + ")", c);
    $("fm-restore").focus();
  });
});

$("fm-restore").addEventListener("click", function () {
  if (busy || state === "clean") return;
  model = copy(record);
  state = "clean";
  var c = render("");
  $("fm-say").textContent = "Restored. Every weight is back, to the last bit: " + c.moved + " differ, and all " + c.exact + " old answers are exactly what they were. " +
    "That is only possible because the record was kept. Teach it something else, or try unlearning this time.";
  logRow("Restored from the record (try " + tries + ")", c);
  $("fm-teach").focus();
});

$("fm-name").addEventListener("input", function () { $("fm-q").textContent = "Where does " + who() + " live?"; });
window.addEventListener("resize", field);
window.addEventListener("plainchange", field);
render("The model has never heard of you. Its answer above is a guess from a row of random numbers.");

})();
