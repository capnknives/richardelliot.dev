/* Knobs (tools/knobs.html).
   Part one is a very small language model and its training, written out by
   hand: pure functions, no page. This half also runs in Node (`require` it)
   for checking the numbers. Part two runs the page: it walks one model from
   dice rolls to sentences, a stop at a time.
   Nothing leaves the browser, and nothing is stored. */
(function () {
"use strict";

/* ---------- The reading ----------
   Short sentences about looking after a pool, written for this page. It is
   everything the model will ever be shown. */
var READING = [
  "the water is clear and the pump is running",
  "the water is cloudy because the filter is dirty",
  "the water is green because the chlorine is low",
  "the water is cloudy because the chlorine is low",
  "the water is clear when the chlorine is right",
  "the pump is running but the filter is dirty",
  "the pump is loud because the basket is full",
  "the pump is running and the water is moving",
  "the filter is dirty so the pressure is high",
  "the filter is clean so the pressure is low",
  "the filter is clean and the water is clear",
  "the pressure is high because the filter is dirty",
  "the pressure is low because the basket is full",
  "the basket is full of leaves after the storm",
  "the pool is full of leaves after the storm",
  "the pool is green because the pump is off",
  "the pool is cloudy after the storm",
  "the pool is clear and the water is moving",
  "the chlorine is low after the storm",
  "the chlorine is low because the sun is hot",
  "the chlorine is right and the water is clear",
  "the chlorine is high so wait before you swim",
  "check the chlorine before you swim",
  "check the basket after the storm",
  "check the pressure when the pump is running",
  "check the filter when the pressure is high",
  "clean the filter when the pressure is high",
  "clean the basket when the pump is loud",
  "empty the basket when the pump is loud",
  "empty the basket before you clean the filter",
  "brush the walls before you clean the filter",
  "brush the walls when the water is green",
  "test the water before you add the chlorine",
  "test the water after the storm",
  "test the water when the sun is hot",
  "add the chlorine when the sun is low",
  "add the chlorine after you brush the walls",
  "wait before you swim when the water is cloudy",
  "you can swim when the water is clear",
  "you can swim when the chlorine is right",
  "the sun is hot so the chlorine is low",
  "the sun is low and the pool is clear",
  "the walls are green because the chlorine is low",
  "the walls are clean and the water is clear",
  "the leaves are in the basket after the storm",
  "the leaves are in the pool so empty the basket"
];
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

/* ---------- Words to numbers ----------
   Every different word in the reading gets a number. Two extras: "^" stands
   for "nothing yet" and "." for "stop here". */
var START = "^", END = ".";
var VOCAB = (function () {
  var seen = {}, list = [START, END];
  READING.forEach(function (line) {
    line.split(" ").forEach(function (w) { if (!seen[w]) { seen[w] = 1; list.push(w); } });
  });
  return list;
})();
var V = VOCAB.length, ID = {};
VOCAB.forEach(function (w, i) { ID[w] = i; });
function tokens(text) {                  /* [{ word, id }], id -1 for a word it has never seen */
  return (text.toLowerCase().match(/[a-z']+/g) || []).map(function (w) {
    return { word: w, id: ID.hasOwnProperty(w) ? ID[w] : -1 };
  });
}

/* The drill: for every position in every sentence, the two words before it
   and the word that really came next. */
var DRILL = (function () {
  var out = [];
  READING.forEach(function (line) {
    var w = [START, START].concat(line.split(" "), [END]);
    for (var i = 2; i < w.length; i++) out.push({ a: ID[w[i - 2]], b: ID[w[i - 1]], t: ID[w[i]] });
  });
  return out;
})();
/* The reading itself goes several ways after some pairs of words, so no model
   can get every drill right. BEST is how many a perfect count would get. */
var BEST = (function () {
  var rows = {}, n = 0;
  DRILL.forEach(function (e) { var k = e.a + " " + e.b, r = rows[k] || (rows[k] = {}); r[e.t] = (r[e.t] || 0) + 1; });
  Object.keys(rows).forEach(function (k) { var m = 0; Object.keys(rows[k]).forEach(function (t) { if (rows[k][t] > m) m = rows[k][t]; }); n += m; });
  return n;
})();

/* ---------- The model ----------
   Each word has a row of D numbers. The rows for the last two words are laid
   end to end, passed through one layer of HID units, and turned into a score
   for every word as the next one. */
var D = 8, HID = 24;
var O = { e: 0, w1: V * D, b1: V * D + HID * 2 * D, w2: V * D + HID * 2 * D + HID };
O.b2 = O.w2 + V * HID;
var COUNT = O.b2 + V;

function newModel(seed) {
  var r = rng(seed), m = new Float64Array(COUNT);
  for (var i = 0; i < COUNT; i++) m[i] = (r() * 2 - 1) * 0.5;
  return m;
}
/* The odds the model gives each word after words a, b. Fills h (the layer in
   the middle) and p (the odds), which the caller owns. */
function odds(m, a, b, h, p) {
  var i, j, z, max = -Infinity, sum = 0;
  for (j = 0; j < HID; j++) {
    z = m[O.b1 + j];
    var row = O.w1 + j * 2 * D;
    for (i = 0; i < D; i++) z += m[row + i] * m[O.e + a * D + i] + m[row + D + i] * m[O.e + b * D + i];
    h[j] = Math.tanh(z);
  }
  for (i = 0; i < V; i++) {
    z = m[O.b2 + i];
    for (j = 0; j < HID; j++) z += m[O.w2 + i * HID + j] * h[j];
    p[i] = z; if (z > max) max = z;
  }
  for (i = 0; i < V; i++) { p[i] = Math.exp(p[i] - max); sum += p[i]; }
  for (i = 0; i < V; i++) p[i] /= sum;
  return p;
}
function top(p) { var b = 0; for (var i = 1; i < V; i++) if (p[i] > p[b]) b = i; return b; }

/* One pass. For every drill: how far were the odds from the word that was
   really there? Then, for every weight: which way would have made that miss
   smaller? Average over the drills, and move each weight a little that way.
   (The step sizes are Adam's.) Returns the average miss. */
function newTrainer() { return { m: new Float64Array(COUNT), v: new Float64Array(COUNT), t: 0 }; }
function pass(m, tr, rate) {
  var g = new Float64Array(COUNT), h = new Float64Array(HID), p = new Float64Array(V), dh = new Float64Array(HID);
  var miss = 0, n = DRILL.length, i, j, k;
  for (k = 0; k < n; k++) {
    var e = DRILL[k];
    odds(m, e.a, e.b, h, p);
    miss -= Math.log(Math.max(1e-12, p[e.t]));
    for (j = 0; j < HID; j++) dh[j] = 0;
    for (i = 0; i < V; i++) {
      var off = p[i] - (i === e.t ? 1 : 0);
      g[O.b2 + i] += off;
      for (j = 0; j < HID; j++) { g[O.w2 + i * HID + j] += off * h[j]; dh[j] += off * m[O.w2 + i * HID + j]; }
    }
    for (j = 0; j < HID; j++) {
      var back = dh[j] * (1 - h[j] * h[j]), row = O.w1 + j * 2 * D;
      g[O.b1 + j] += back;
      for (i = 0; i < D; i++) {
        g[row + i] += back * m[O.e + e.a * D + i];
        g[row + D + i] += back * m[O.e + e.b * D + i];
        g[O.e + e.a * D + i] += back * m[row + i];
        g[O.e + e.b * D + i] += back * m[row + D + i];
      }
    }
  }
  tr.t++;
  var lr = rate || 0.02, b1 = 0.9, b2 = 0.999;
  for (i = 0; i < COUNT; i++) {
    var gi = g[i] / n;
    tr.m[i] = b1 * tr.m[i] + (1 - b1) * gi;
    tr.v[i] = b2 * tr.v[i] + (1 - b2) * gi * gi;
    m[i] -= lr * (tr.m[i] / (1 - Math.pow(b1, tr.t))) / (Math.sqrt(tr.v[i] / (1 - Math.pow(b2, tr.t))) + 1e-8);
  }
  return miss / n;
}
/* The model's first guess for every drill. */
function guesses(m) {
  var h = new Float64Array(HID), p = new Float64Array(V), out = new Int16Array(DRILL.length);
  for (var k = 0; k < DRILL.length; k++) out[k] = top(odds(m, DRILL[k].a, DRILL[k].b, h, p));
  return out;
}
function right(m) {
  var g = guesses(m), c = 0;
  for (var k = 0; k < DRILL.length; k++) if (g[k] === DRILL[k].t) c++;
  return c;
}

/* ---------- Writing ----------
   What could come next after these word numbers, most likely first. `bold`
   reshapes the odds: below 1 the favorite gets more of them, above 1 the long
   shots do. */
function options(m, ids, bold) {
  var a = ids.length > 1 ? ids[ids.length - 2] : 0, b = ids.length ? ids[ids.length - 1] : 0;
  var p = odds(m, a, b, new Float64Array(HID), new Float64Array(V)), list = [], sum = 0, i;
  for (i = 1; i < V; i++) { var q = Math.pow(p[i], 1 / (bold || 1)); list.push({ id: i, w: VOCAB[i], p: q }); sum += q; }
  list.forEach(function (o) { o.p /= sum; });
  list.sort(function (x, y) { return y.p - x.p; });
  return list;
}
function pick(list, roll) {
  var acc = 0;
  for (var i = 0; i < list.length; i++) { acc += list[i].p; if (roll < acc) return list[i].id; }
  return list[list.length - 1].id;
}
var CAP = 16;                            /* a sentence that never stops is cut off here */
function write(m, roll, bold) {
  var ids = [];
  while (ids.length < CAP) { var id = pick(options(m, ids, bold), roll()); if (id === 1) break; ids.push(id); }
  return ids;
}
function say(ids) { return ids.map(function (i) { return VOCAB[i]; }).join(" "); }
function wasRead(ids) { return READING.indexOf(say(ids)) !== -1; }

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    READING: READING, VOCAB: VOCAB, DRILL: DRILL, BEST: BEST, COUNT: COUNT, CAP: CAP, tokens: tokens, rng: rng,
    newModel: newModel, newTrainer: newTrainer, pass: pass, right: right, guesses: guesses,
    options: options, pick: pick, write: write, say: say, wasRead: wasRead
  };
}
if (typeof document === "undefined") return;

/* ---------- The page ---------- */
var $ = function (id) { return document.getElementById("kn-" + id); };
var main = document.querySelector("main.knobs");
if (!main || !$("field")) return;

var MAX_PASSES = 300;
var model = newModel(41), trainer = newTrainer(), passes = 0, running = false;
var trained = null, base = null, wiped = 0;

function num(n) { return n.toLocaleString("en-US"); }
function sentence(ids, cut) {
  if (!ids.length) return "…";
  var s = say(ids);
  return s.charAt(0).toUpperCase() + s.slice(1) + (cut ? " …" : ".");
}

/* How it is explained: plain, curious or technical. The choice is kept in the
   address (#plain, #curious, #technical) so a link can carry it. */
var LEVELS = ["plain", "curious", "technical"];
function setLevel(lv, quiet) {
  if (LEVELS.indexOf(lv) === -1) lv = "plain";
  main.setAttribute("data-level", lv);
  LEVELS.forEach(function (l) { $("lv-" + l).setAttribute("aria-pressed", l === lv ? "true" : "false"); });
  if (!quiet) { try { history.replaceState(null, "", "#" + lv); } catch (e) { /* the page still works */ } }
}
LEVELS.forEach(function (l) { $("lv-" + l).addEventListener("click", function () { setLevel(l); }); });
window.addEventListener("hashchange", function () { setLevel(location.hash.slice(1), true); });
setLevel(location.hash.slice(1), true);

/* Stop 1: words to numbers */
function showTokens() {
  var list = tokens($("text").value), ul = $("tokens"), missing = 0;
  ul.textContent = "";
  list.slice(0, 40).forEach(function (t) {
    var li = document.createElement("li"), b = document.createElement("b");
    li.textContent = t.word;
    b.textContent = t.id < 0 ? "?" : t.id;
    if (t.id < 0) { li.className = "unknown"; missing++; }
    li.appendChild(b); ul.appendChild(li);
  });
  $("token-say").textContent = !list.length ? "Type a few words."
    : missing ? "A question mark is a word this model has never seen. It has no number for it, so it cannot use it. It knows " + (V - 2) + " words, all from its reading."
    : "Every word has a number. From here on the model only ever sees the numbers.";
}
$("text").addEventListener("input", showTokens);

/* The field: one square per weight. Drawn twice, at stops 2 and 5. */
var COLS = 0;
function drawField(canvas) {
  var w = canvas.clientWidth || 320, dpr = Math.min(window.devicePixelRatio || 1, 2);
  var cols = w < 420 ? 48 : w < 700 ? 64 : 83, cell = w / cols, rows = Math.ceil(COUNT / cols);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(rows * cell * dpr);
  canvas.style.height = rows * cell + "px";
  canvas._cols = cols; canvas._cell = cell;
  var c = canvas.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, rows * cell);
  for (var i = 0; i < COUNT; i++) {
    var v = model[i], lit = Math.min(1, Math.abs(v) / 1.6);
    c.fillStyle = v === 0 ? "#050b0a" : v > 0 ? "rgba(157, 240, 218, " + (0.12 + 0.88 * lit) + ")" : "rgba(255, 177, 153, " + (0.12 + 0.88 * lit) + ")";
    c.fillRect((i % cols) * cell + 0.5, Math.floor(i / cols) * cell + 0.5, cell - 1, cell - 1);
  }
}
function drawFields() { drawField($("field")); drawField($("field2")); }

/* Stop 2: a new model */
var rollSeed = 0;
function writeSample(seed) { var ids = write(model, rng(seed), 1); return sentence(ids, ids.length >= CAP); }
$("ask").addEventListener("click", function () {
  rollSeed++;
  $("first").textContent = writeSample(1000 + rollSeed);
  $("first-say").textContent = passes ? "This model has had " + num(passes) + " passes of training. Roll new dice to see an untrained one again."
    : "Word salad. It knows the words, because we gave it the list. It knows nothing about which word follows which.";
});
$("dice").addEventListener("click", function () {
  stop();
  model = newModel(Math.floor(Math.random() * 1e9));
  trainer = newTrainer(); passes = 0; trained = null; base = null; wiped = 0;
  $("first").textContent = writeSample(1000 + (++rollSeed));
  $("first-say").textContent = "New dice, new nonsense. Every model starts like this.";
  line = []; showAll();
});

/* Stop 3: training */
var drillAt = 6, hBuf = new Float64Array(HID), pBuf = new Float64Array(V);
function showDrill() {
  var e = DRILL[drillAt], p = odds(model, e.a, e.b, hBuf, pBuf), order = [], i;
  for (i = 1; i < V; i++) order.push(i);
  order.sort(function (x, y) { return p[y] - p[x]; });
  var shown = order.slice(0, 4);
  if (shown.indexOf(e.t) === -1) shown[3] = e.t;
  $("drill-q").textContent = (e.a ? VOCAB[e.a] + " " : "") + (e.b ? VOCAB[e.b] + " " : "") + "___";
  $("drill-a").textContent = e.t === 1 ? "(the sentence ends)" : VOCAB[e.t];
  var ul = $("drill-bars");
  ul.textContent = "";
  shown.forEach(function (id) {
    var li = document.createElement("li");
    li.innerHTML = '<span class="w"></span><span class="track"><i></i></span><span class="val"></span>';
    li.children[0].textContent = id === 1 ? "(stop)" : VOCAB[id];
    li.children[1].firstChild.style.width = Math.round(p[id] * 100) + "%";
    li.children[2].textContent = Math.round(p[id] * 100) + "%";
    if (id === e.t) li.className = "truth";
    ul.appendChild(li);
  });
}
$("drill-next").addEventListener("click", function () { drillAt = (drillAt + 37) % DRILL.length; showDrill(); });

function meters(miss) {
  $("passes").textContent = num(passes);
  $("right").textContent = right(model);
  if (miss !== undefined) $("miss").textContent = miss.toFixed(2);
}
function tell(t) { $("say").textContent = t; }
function stop() {
  running = false;
  $("train").textContent = "Train it";
  $("train").setAttribute("aria-pressed", "false");
}
function onePass() {
  var miss = pass(model, trainer);
  passes++; wiped = 0;
  return miss;
}
function finish() {
  stop();
  trained = new Float64Array(model);
  base = guesses(model);
  tell("Done: " + num(passes) + " passes. Its first guess now matches the reading as often as any guesser could, because the reading itself goes more than one way after some words. Nobody gave it a rule of grammar or a fact about pools. All that changed is the " + num(COUNT) + " numbers.");
  showAll();
}
function frame() {
  if (!running) return;
  var miss = onePass();
  meters(miss); showDrill();
  if (passes % 10 === 0 || passes < 10) $("now").textContent = writeSample(7);
  if (passes % 6 === 0) drawField($("field"));
  if (passes >= MAX_PASSES) { finish(); return; }
  tell("Training. Each pass runs all " + DRILL.length + " drills, measures how far off the guesses were, and moves every number a hair in the direction that shrinks the miss.");
  requestAnimationFrame(frame);
}
$("train").addEventListener("click", function () {
  if (running) { stop(); tell("Paused at " + num(passes) + " passes."); showAll(); return; }
  if (passes >= MAX_PASSES) { tell("It has had its " + MAX_PASSES + " passes. Go back to stop 2 and roll new dice to train another."); return; }
  running = true;
  this.textContent = "Pause";
  this.setAttribute("aria-pressed", "true");
  requestAnimationFrame(frame);
});
$("once").addEventListener("click", function () {
  stop();
  if (passes >= MAX_PASSES) return;
  var before = new Float64Array(model), miss = onePass(), far = 0;
  for (var i = 0; i < COUNT; i++) far = Math.max(far, Math.abs(model[i] - before[i]));
  showAll(miss);
  tell("One pass. All " + num(COUNT) + " numbers moved, none by more than " + far.toFixed(3) + ". That is how small each step is.");
  if (passes >= MAX_PASSES) finish();
});

/* Stop 4: writing */
var line = [], bold = 1;
function lineDone() { return line.length >= CAP || line[line.length - 1] === 1; }
function showLine() {
  var ended = line[line.length - 1] === 1, ids = ended ? line.slice(0, -1) : line, done = lineDone();
  $("line").textContent = ids.length ? sentence(ids, !ended) : "…";
  var ul = $("next");
  ul.textContent = "";
  (done ? [] : options(model, line, bold).slice(0, 5)).forEach(function (o) {
    var li = document.createElement("li"), b = document.createElement("button");
    b.type = "button";
    b.innerHTML = '<span class="w"></span><span class="track"><i></i></span><span class="val"></span>';
    b.children[0].textContent = o.id === 1 ? "(stop here)" : o.w;
    b.children[1].firstChild.style.width = Math.round(o.p * 100) + "%";
    b.children[2].textContent = Math.round(o.p * 100) + "%";
    b.addEventListener("click", function () { line.push(o.id); showLine(); });
    li.appendChild(b); ul.appendChild(li);
  });
  $("word").disabled = $("rest").disabled = done;
  $("word-say").textContent = !passes ? "This model is untrained, so every word is about as likely as any other. Train it at stop 3, then come back."
    : !done ? (line.length ? "The bars are its odds for the next word. Press one to choose it yourself, or let it roll." : "The bars are the words it thinks could start a sentence.")
    : !ended ? "It never chose to stop, so the page cut it off at " + CAP + " words. It only sees the last two words, so it cannot tell it is going in circles."
    : wasRead(ids) ? "That one is word for word from its reading. With this little to read, some sentences come back whole. Make another."
    : "That sentence is not in its reading. Nothing was copied: it was built one likely word at a time. Nothing checked whether it is true, either.";
}
$("word").addEventListener("click", function () { line.push(pick(options(model, line, bold), Math.random())); showLine(); });
$("rest").addEventListener("click", function () {
  while (!lineDone()) line.push(pick(options(model, line, bold), Math.random()));
  showLine();
});
$("fresh").addEventListener("click", function () { line = []; showLine(); });
$("bold").addEventListener("input", function () {
  bold = +this.value;
  $("bold-out").textContent = bold < 0.75 ? "careful" : bold > 1.35 ? "bold" : "as trained";
  showLine();
});

/* Stop 5: find where it put something */
function changed() {
  var g = guesses(model), c = 0;
  for (var k = 0; k < g.length; k++) if (g[k] !== base[k]) c++;
  return c;
}
function afterWipe(what) {
  drawField($("field2"));
  var c = changed();
  $("wiped").textContent = num(wiped);
  $("changed").textContent = c;
  $("green").textContent = sentence(greenLine(), false);
  $("find-say").textContent = what + (!wiped ? "" : c
    ? " With " + num(wiped) + " wiped in all, " + c + " of its " + DRILL.length + " answers have changed, across sentences that have nothing to do with each other."
    : " With " + num(wiped) + " wiped in all, none of its " + DRILL.length + " answers has changed. The other numbers covered for it.");
  meters(); showLine(); showDrill();
}
function greenLine() {                    /* its favorite way to finish "the water is green" */
  var ids = tokens("the water is green").map(function (t) { return t.id; });
  while (ids.length < CAP) { var o = options(model, ids, 1)[0]; if (o.id === 1) break; ids.push(o.id); }
  return ids;
}
function needTrained() {
  if (trained) return false;
  $("find-say").textContent = "There is nothing to find yet. Train the model at stop 3 first.";
  return true;
}
$("field2").addEventListener("click", function (ev) {
  if (needTrained()) return;
  var b = this.getBoundingClientRect();
  var i = Math.floor((ev.clientY - b.top) / this._cell) * this._cols + Math.floor((ev.clientX - b.left) / this._cell);
  if (i < 0 || i >= COUNT) return;
  if (model[i] !== 0) { model[i] = 0; wiped++; }
  afterWipe("You wiped number " + num(i + 1) + " of " + num(COUNT) + ".");
});
$("wipe").addEventListener("click", function () {
  if (needTrained()) return;
  for (var n = 0; n < 50; n++) { var i = Math.floor(Math.random() * COUNT); if (model[i] !== 0) { model[i] = 0; wiped++; } }
  afterWipe("Fifty numbers wiped at random.");
});
$("restore").addEventListener("click", function () {
  if (needTrained()) return;
  model = new Float64Array(trained); wiped = 0;
  afterWipe("Every number is back where training left it.");
});

function showAll(miss) {
  meters(miss); showDrill(); drawFields(); showLine();
  $("now").textContent = writeSample(7);
  $("wiped").textContent = num(wiped);
  $("changed").textContent = base ? changed() : 0;
  $("green").textContent = trained ? sentence(greenLine(), false) : "…";
  if (!trained) $("find-say").textContent = "Train the model at stop 3, then come back and take it apart.";
  else if (!wiped) $("find-say").textContent = "Tap any square to wipe that number, or wipe fifty at once.";
}

var resizeTimer = 0;
window.addEventListener("resize", function () {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawFields, 80);
});
(function listReading() {
  var ol = $("reading");
  READING.forEach(function (s) { var li = document.createElement("li"); li.textContent = s.charAt(0).toUpperCase() + s.slice(1) + "."; ol.appendChild(li); });
})();

showTokens();
$("first").textContent = writeSample(1000);
$("first-say").textContent = "That is what a brand-new model writes. Ask again for more of it.";
$("miss").textContent = "—";
showAll();
tell("Untrained, its first guess is right on " + right(model) + " of " + DRILL.length + " drills. The best any guesser could do with this reading is " + BEST + ".");
})();
