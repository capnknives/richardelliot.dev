/* Knobs (tools/knobs.html).
   Part one is the arithmetic, written out by hand: a rule a person wrote, a
   small network that learns the same job from examples, and a next-word
   guesser built from a short reading. Pure functions, no page; this half also
   runs in Node (`require` it) for checking the numbers.
   Part two runs the page. Nothing leaves the browser, and nothing is stored. */
(function () {
"use strict";

/* ---------- The written rule ----------
   Two readings in, yes or no out. The line numbers match the listing on the page. */
var PH = [6.6, 8.4], CL = [0, 6];
var CODE = [
  "function safeToSwim(pH, chlorine) {",
  "  if (pH < 7.2) return \"no, too acidic\";",
  "  if (pH > 7.8) return \"no, too basic\";",
  "  if (chlorine < 1) return \"no, not enough chlorine\";",
  "  if (chlorine > 4) return \"no, too much chlorine\";",
  "  return \"yes\";",
  "}"
];
function rule(ph, cl) {
  if (ph < 7.2) return { ok: false, line: 1, why: "no, too acidic" };
  if (ph > 7.8) return { ok: false, line: 2, why: "no, too basic" };
  if (cl < 1) return { ok: false, line: 3, why: "no, not enough chlorine" };
  if (cl > 4) return { ok: false, line: 4, why: "no, too much chlorine" };
  return { ok: true, line: 5, why: "yes" };
}

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

/* ---------- The examples ----------
   240 readings, each marked by the rule above: 100 that pass, 140 that do not.
   The network only ever sees these. It is never shown the rule. */
var N_YES = 100, N_NO = 140;
function nx(ph) { return (ph - 7.5) / 0.9; }      /* both readings scaled to -1..1 */
function ny(cl) { return (cl - 3) / 3; }
function makeExamples(seed) {
  var r = rng(seed), out = [], yes = 0, no = 0;
  while (yes < N_YES || no < N_NO) {
    var ph = Math.round((PH[0] + r() * (PH[1] - PH[0])) * 100) / 100;
    var cl = Math.round((CL[0] + r() * (CL[1] - CL[0])) * 100) / 100;
    if (yes < N_YES && r() < 0.7) {               /* most draws for "yes" are aimed at the box */
      ph = Math.round((7.2 + r() * 0.6) * 100) / 100;
      cl = Math.round((1 + r() * 3) * 100) / 100;
    }
    var ok = rule(ph, cl).ok;
    if (ok && yes < N_YES) { yes++; out.push({ ph: ph, cl: cl, x: nx(ph), y: ny(cl), t: 1 }); }
    else if (!ok && no < N_NO) { no++; out.push({ ph: ph, cl: cl, x: nx(ph), y: ny(cl), t: 0 }); }
  }
  return out;
}

/* ---------- The network ----------
   Eight wires. Each takes the two readings, multiplies each by a knob, adds an
   offset knob, and squashes the sum. A fourth knob says how hard that wire
   pushes the answer. One last knob offsets the total. 8 x 4 + 1 = 33 knobs. */
var H = 8, COUNT = H * 4 + 1;
var COLS = ["from pH", "from chlorine", "offset", "to the answer"];
function at(wire, col) { return col * H + wire; }  /* knob index; the last one is COUNT - 1 */

function newKnobs(seed) {
  var r = rng(seed), k = new Float64Array(COUNT);
  for (var i = 0; i < COUNT; i++) k[i] = (r() * 2 - 1) * (i < 2 * H ? 2 : 1);
  return k;
}
function answer(k, x, y) {                /* how sure it is of "yes", 0 to 1 */
  var z = k[COUNT - 1];
  for (var j = 0; j < H; j++) z += k[3 * H + j] * Math.tanh(k[j] * x + k[H + j] * y + k[2 * H + j]);
  return 1 / (1 + Math.exp(-z));
}

/* One nudge. For every example: how far off was the answer? Then, for every
   knob: which way would have made that a little smaller? Average those, and
   turn each knob a little that way. (The step sizes are Adam's.) */
function newTrainer() { return { m: new Float64Array(COUNT), v: new Float64Array(COUNT), t: 0 }; }
function nudge(k, ex, tr, rate) {
  var g = new Float64Array(COUNT), h = new Float64Array(H), loss = 0, n = ex.length, i, j;
  for (i = 0; i < n; i++) {
    var e = ex[i], z = k[COUNT - 1];
    for (j = 0; j < H; j++) {
      h[j] = Math.tanh(k[j] * e.x + k[H + j] * e.y + k[2 * H + j]);
      z += k[3 * H + j] * h[j];
    }
    var p = 1 / (1 + Math.exp(-z)), off = p - e.t;
    loss -= Math.log(Math.max(1e-12, e.t ? p : 1 - p));
    g[COUNT - 1] += off;
    for (j = 0; j < H; j++) {
      g[3 * H + j] += off * h[j];
      var back = off * k[3 * H + j] * (1 - h[j] * h[j]);
      g[j] += back * e.x;
      g[H + j] += back * e.y;
      g[2 * H + j] += back;
    }
  }
  tr.t++;
  var lr = rate || 0.05, b1 = 0.9, b2 = 0.999;
  for (i = 0; i < COUNT; i++) {
    var gi = g[i] / n;
    tr.m[i] = b1 * tr.m[i] + (1 - b1) * gi;
    tr.v[i] = b2 * tr.v[i] + (1 - b2) * gi * gi;
    k[i] -= lr * (tr.m[i] / (1 - Math.pow(b1, tr.t))) / (Math.sqrt(tr.v[i] / (1 - Math.pow(b2, tr.t))) + 1e-8);
  }
  return loss / n;
}
function right(k, ex) {
  var c = 0;
  for (var i = 0; i < ex.length; i++) if ((answer(k, ex[i].x, ex[i].y) >= 0.5) === (ex[i].t === 1)) c++;
  return c;
}
/* Every reading a test kit could show on these two scales, to the hundredth
   of a pH and the tenth of a ppm: how many does the network call the way the
   rule does? */
var GRID = (function () {
  var pts = [];
  for (var a = 0; a <= 180; a += 2) for (var b = 0; b <= 60; b++) {
    var ph = 6.6 + a / 100, cl = b / 10;
    pts.push({ x: nx(ph), y: ny(cl), t: rule(ph, cl).ok });
  }
  return pts;
})();
function agreement(k) {
  var c = 0;
  for (var i = 0; i < GRID.length; i++) if ((answer(k, GRID[i].x, GRID[i].y) >= 0.5) === GRID[i].t) c++;
  return c / GRID.length;
}

/* ---------- Next word ----------
   The reading: short sentences about looking after a pool, written for this
   page. The guesser counts which word followed each pair of words, and nothing
   else. It has no knobs: with this little reading, a count table is enough. */
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
var END = ".";
function buildCounts(lines) {
  var two = {}, one = {};
  function add(table, key, w) {
    var row = table[key] || (table[key] = {});
    row[w] = (row[w] || 0) + 1;
  }
  lines.forEach(function (line) {
    var w = ["^", "^"].concat(line.split(" "), [END]);
    for (var i = 2; i < w.length; i++) {
      add(two, w[i - 2] + " " + w[i - 1], w[i]);
      add(one, w[i - 1], w[i]);
    }
  });
  return { two: two, one: one };
}
var COUNTS = buildCounts(READING);
/* What could come next after these words, most likely first. `bold` reshapes
   the odds: below 1 the favorite gets more of them, above 1 the long shots do. */
function options(words, bold) {
  var a = words.length > 1 ? words[words.length - 2] : "^";
  var b = words.length ? words[words.length - 1] : "^";
  var row = COUNTS.two[a + " " + b] || COUNTS.one[b] || {};
  var list = Object.keys(row).map(function (w) { return { w: w, seen: row[w], p: Math.pow(row[w], 1 / (bold || 1)) }; });
  var sum = list.reduce(function (s, o) { return s + o.p; }, 0);
  list.forEach(function (o) { o.p /= sum; });
  list.sort(function (x, y) { return y.p - x.p || (x.w < y.w ? -1 : 1); });
  return list;
}
function pick(list, roll) {
  var acc = 0;
  for (var i = 0; i < list.length; i++) { acc += list[i].p; if (roll < acc) return list[i].w; }
  return list[list.length - 1].w;
}
function wasRead(words) { return READING.indexOf(words.join(" ")) !== -1; }

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    rule: rule, makeExamples: makeExamples, newKnobs: newKnobs, answer: answer, newTrainer: newTrainer,
    nudge: nudge, right: right, agreement: agreement, COUNT: COUNT, READING: READING,
    options: options, pick: pick, wasRead: wasRead, rng: rng, END: END
  };
}
if (typeof document === "undefined") return;

/* ---------- The page ---------- */
var $ = function (id) { return document.getElementById("kn-" + id); };
if (!$("map")) return;

var EX = makeExamples(2718);
var knobs = newKnobs(41), trainer = newTrainer(), trained = null;
var nudges = 0, running = false, chosen = 0, touchedByHand = false;
var reading = { ph: 7.5, cl: 5 };
var MAX_NUDGES = 2500;

/* The written rule */
var codeEl = $("code");
CODE.forEach(function (line) {
  var li = document.createElement("li");
  li.textContent = line;
  codeEl.appendChild(li);
});
function n1(v) { return v.toFixed(1); }
function n2(v) { return (v < 0 ? "−" : "") + Math.abs(v).toFixed(2); }

function showReading() {
  var r = rule(reading.ph, reading.cl);
  $("ph-out").textContent = n1(reading.ph);
  $("cl-out").textContent = n1(reading.cl) + " ppm";
  for (var i = 0; i < codeEl.children.length; i++) codeEl.children[i].classList.toggle("hit", i === r.line);
  $("rule-says").textContent = "The rule says " + r.why + ". Line " + (r.line + 1) + " decided it.";
  var p = answer(knobs, nx(reading.ph), ny(reading.cl));
  var sure = Math.round(Math.max(p, 1 - p) * 100);
  $("both-reading").textContent = "pH " + n1(reading.ph) + ", chlorine " + n1(reading.cl) + " ppm";
  $("both-rule").textContent = r.why + " (line " + (r.line + 1) + ")";
  $("both-net").textContent = (p >= 0.5 ? "yes" : "no") + ", " + sure + "% sure";
  $("both-note").textContent = (p >= 0.5) !== r.ok
    ? "They disagree here. The rule can show you its line. The network has only its 33 numbers."
    : "They agree here. Only one of them can tell you why.";
}
$("ph").addEventListener("input", function () { reading.ph = +this.value; showReading(); draw(); });
$("cl").addEventListener("input", function () { reading.cl = +this.value; showReading(); draw(); });

/* The map: the network's answer for every reading, with the examples on top. */
var map = $("map"), ctx = map.getContext("2d");
var SW = 54, SH = 40, shade = document.createElement("canvas");
shade.width = SW; shade.height = SH;
var sctx = shade.getContext("2d"), simg = sctx.createImageData(SW, SH);
var PAD = { l: 34, r: 8, t: 8, b: 26 }, W = 0, Hh = 0;

function size() {
  var w = map.clientWidth || 320, dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = w; Hh = Math.round(Math.min(w * 0.74, 460));
  map.width = Math.round(W * dpr); map.height = Math.round(Hh * dpr);
  map.style.height = Hh + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function px(ph) { return PAD.l + (ph - PH[0]) / (PH[1] - PH[0]) * (W - PAD.l - PAD.r); }
function py(cl) { return Hh - PAD.b - (cl - CL[0]) / (CL[1] - CL[0]) * (Hh - PAD.t - PAD.b); }

function draw() {
  if (!W) size();
  var i, d = simg.data;
  for (var r = 0; r < SH; r++) for (var c = 0; c < SW; c++) {
    var p = answer(knobs, -1 + 2 * (c + 0.5) / SW, 1 - 2 * (r + 0.5) / SH);
    var lit = 0.35 + 0.65 * Math.abs(2 * p - 1), o = (r * SW + c) * 4;
    d[o] = (p >= 0.5 ? 26 : 122) * lit; d[o + 1] = (p >= 0.5 ? 122 : 52) * lit; d[o + 2] = (p >= 0.5 ? 104 : 44) * lit; d[o + 3] = 255;
  }
  sctx.putImageData(simg, 0, 0);
  ctx.clearRect(0, 0, W, Hh);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(shade, PAD.l, PAD.t, W - PAD.l - PAD.r, Hh - PAD.t - PAD.b);

  /* the written rule, as a dashed box */
  ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(232, 243, 238, 0.85)";
  ctx.strokeRect(px(7.2), py(4), px(7.8) - px(7.2), py(1) - py(4));
  ctx.setLineDash([]);

  for (i = 0; i < EX.length; i++) {
    var e = EX[i], x = px(e.ph), y = py(e.cl), ok = (answer(knobs, e.x, e.y) >= 0.5) === (e.t === 1);
    ctx.beginPath();
    if (e.t) { ctx.arc(x, y, 3.2, 0, 6.2832); ctx.fillStyle = "#9df0da"; ctx.fill(); }
    else { ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3); ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3); ctx.strokeStyle = "#ffb199"; ctx.lineWidth = 1.6; ctx.stroke(); }
    if (!ok) { ctx.beginPath(); ctx.arc(x, y, 6.5, 0, 6.2832); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.stroke(); }
  }

  /* the reading being asked about */
  var mx = px(reading.ph), my = py(reading.cl);
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(mx - 9, my); ctx.lineTo(mx + 9, my); ctx.moveTo(mx, my - 9); ctx.lineTo(mx, my + 9); ctx.stroke();

  ctx.fillStyle = "#a9c4bb"; ctx.font = "600 12px " + getComputedStyle(map).fontFamily;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  [6.6, 7.2, 7.8, 8.4].forEach(function (v) { ctx.fillText(n1(v), px(v), Hh - PAD.b + 5); });
  ctx.fillText("pH", px(7.5), Hh - PAD.b + 5);
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  [0, 1, 4, 6].forEach(function (v) { ctx.fillText(String(v), PAD.l - 6, py(v)); });
  ctx.save(); ctx.translate(11, py(2.5)); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center";
  ctx.fillText("chlorine, ppm", 0, 0); ctx.restore();
}
map.addEventListener("click", function (ev) {
  var b = map.getBoundingClientRect();
  var ph = PH[0] + (ev.clientX - b.left - PAD.l) / (W - PAD.l - PAD.r) * (PH[1] - PH[0]);
  var cl = CL[0] + (Hh - PAD.b - (ev.clientY - b.top)) / (Hh - PAD.t - PAD.b) * (CL[1] - CL[0]);
  reading.ph = Math.round(Math.min(PH[1], Math.max(PH[0], ph)) * 10) / 10;
  reading.cl = Math.round(Math.min(CL[1], Math.max(CL[0], cl)) * 10) / 10;
  $("ph").value = reading.ph; $("cl").value = reading.cl;
  showReading(); draw();
});

/* The board: one button per knob, laid out the way the knobs are wired. */
var board = $("board"), buttons = [];
function place(i) {
  if (i === COUNT - 1) return "the last offset";
  return "wire " + (i % H + 1) + ", " + COLS[Math.floor(i / H)];
}
(function build() {
  var head = document.createElement("tr");
  head.innerHTML = "<td></td>" + COLS.map(function (c) { return '<th scope="col">' + c + "</th>"; }).join("");
  board.appendChild(head);
  function knob(i) {
    var b = document.createElement("button");
    b.type = "button";
    b.innerHTML = '<span class="dial"><i></i></span><span class="num"></span>';
    b.addEventListener("click", function () { choose(i); });
    buttons[i] = b;
    return b;
  }
  for (var j = 0; j < H; j++) {
    var tr = document.createElement("tr");
    tr.innerHTML = '<th scope="row">' + (j + 1) + "</th>";
    for (var c = 0; c < 4; c++) { var td = document.createElement("td"); td.appendChild(knob(at(j, c))); tr.appendChild(td); }
    board.appendChild(tr);
  }
  var last = document.createElement("tr");
  last.innerHTML = '<th scope="row" colspan="4" class="last">One last offset on the total</th>';
  var cell = document.createElement("td"); cell.appendChild(knob(COUNT - 1)); last.appendChild(cell);
  board.appendChild(last);
})();
function showKnobs() {
  for (var i = 0; i < COUNT; i++) {
    var b = buttons[i], v = knobs[i];
    b.firstChild.firstChild.style.transform = "rotate(" + (Math.tanh(v / 5) * 135).toFixed(1) + "deg)";
    b.lastChild.textContent = n2(v);
    b.setAttribute("aria-label", "Knob " + (i + 1) + ", " + place(i) + ", set to " + v.toFixed(2));
  }
  $("turn").value = Math.max(-12, Math.min(12, knobs[chosen]));
  $("turn-out").textContent = n2(knobs[chosen]);
}
function choose(i) {
  chosen = i;
  buttons.forEach(function (b, n) { b.setAttribute("aria-pressed", n === i ? "true" : "false"); });
  $("turn-name").textContent = "Knob " + (i + 1) + " (" + place(i) + ")";
  showKnobs();
}
$("turn").addEventListener("input", function () {
  stop();
  knobs[chosen] = +this.value;
  touchedByHand = true;
  render();
  var r = right(knobs, EX);
  say(trained
    ? "You moved one knob and " + (EX.length - r) + " of the 240 examples are now wrong. Watch the shape on the map: more than one edge of it moves. No single knob holds a single line of the rule."
    : "By hand: " + r + " of 240. Every knob bends the whole picture a little, so fixing one corner breaks another.");
});

function meters() {
  var r = right(knobs, EX);
  $("right").textContent = r;
  $("nudges").textContent = nudges.toLocaleString("en-US");
  $("agree").textContent = (agreement(knobs) * 100).toFixed(1) + "%";
  return r;
}
function render() { showKnobs(); draw(); showReading(); return meters(); }
function say(t) { $("say").textContent = t; }

function stop() {
  running = false;
  $("train").textContent = "Train it";
  $("train").setAttribute("aria-pressed", "false");
}
function finish(r) {
  stop();
  trained = new Float64Array(knobs);
  touchedByHand = false;
  $("restore").disabled = false;
  say((r === EX.length ? "All 240 right" : r + " of 240 right") + " after " + nudges.toLocaleString("en-US") +
    " nudges. Nobody typed 7.2 or 4 into it. Those numbers are in the 33 knobs somewhere. Pick a knob, move it, and try to find which one holds “chlorine no higher than 4”.");
}
function frame() {
  if (!running) return;
  var loss = 1, r;
  for (var s = 0; s < 3 && nudges < MAX_NUDGES; s++) { loss = nudge(knobs, EX, trainer); nudges++; }
  r = render();
  if (nudges >= MAX_NUDGES || (r === EX.length && loss < 0.06)) { finish(r); return; }
  say("Training. Each nudge checks all 240 examples, measures how far off the answers were, and turns every knob a hair in the direction that shrinks the miss.");
  requestAnimationFrame(frame);
}
$("train").addEventListener("click", function () {
  if (running) { stop(); say("Paused at " + nudges.toLocaleString("en-US") + " nudges."); return; }
  if (nudges >= MAX_NUDGES) { say("It has had its " + MAX_NUDGES.toLocaleString("en-US") + " nudges. Scramble the knobs to start a new one."); return; }
  if (touchedByHand) trainer = newTrainer();
  touchedByHand = false;
  running = true;
  this.textContent = "Pause";
  this.setAttribute("aria-pressed", "true");
  requestAnimationFrame(frame);
});
$("once").addEventListener("click", function () {
  stop();
  if (nudges >= MAX_NUDGES) return;
  var before = new Float64Array(knobs);
  nudge(knobs, EX, trainer); nudges++;
  var moved = 0, far = 0;
  for (var i = 0; i < COUNT; i++) { var dlt = Math.abs(knobs[i] - before[i]); if (dlt > 0) moved++; if (dlt > far) far = dlt; }
  var r = render();
  say("One nudge. " + moved + " of 33 knobs moved, none by more than " + far.toFixed(3) + ". It now gets " + r + " of 240.");
});
$("scramble").addEventListener("click", function () {
  stop();
  knobs = newKnobs(Math.floor(Math.random() * 1e9));
  trainer = newTrainer(); trained = null; nudges = 0; touchedByHand = false;
  $("restore").disabled = true;
  render();
  say("New knobs, set by dice. Train it again and compare the numbers: it will reach the same answers with a different set of 33.");
});
$("restore").addEventListener("click", function () {
  if (!trained) return;
  stop();
  knobs = new Float64Array(trained);
  touchedByHand = false;
  render();
  say("The trained knobs are back.");
});

/* Next word */
var line = [], bold = 1, cut = false, CAP = 28;
function sentence(words) {
  if (!words.length) return "";
  var s = words.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function ended() { return line.length > 0 && line[line.length - 1] === END; }
function done() { return ended() || cut; }
function showLine() {
  var words = ended() ? line.slice(0, -1) : line, opts = done() ? [] : options(line, bold);
  $("line").textContent = words.length ? sentence(words) + (ended() ? "." : " …") : "…";
  var ul = $("next");
  ul.textContent = "";
  opts.slice(0, 6).forEach(function (o) {
    var li = document.createElement("li"), b = document.createElement("button");
    b.type = "button";
    b.innerHTML = '<span class="w"></span><span class="track"><i></i></span><span class="val"></span>';
    b.children[0].textContent = o.w === END ? "(stop here)" : o.w;
    b.children[1].firstChild.style.width = Math.round(o.p * 100) + "%";
    b.children[2].textContent = Math.round(o.p * 100) + "%";
    b.addEventListener("click", function () { take(o.w); });
    li.appendChild(b); ul.appendChild(li);
  });
  $("word").disabled = $("rest").disabled = done();
  if (cut) {
    $("word-say").textContent = "It never chose to stop, so the page cut it off at " + CAP + " words. It only remembers the last two words, so it cannot tell it has been going in circles.";
  } else if (ended()) {
    $("word-say").textContent = wasRead(words)
      ? "That one is word for word from its reading. With this little to read, some sentences come back whole. Make another."
      : "That sentence is not in its reading. Nothing was copied: it was put together one likely word at a time. Nothing checked whether it is true, either.";
  } else if (!line.length) {
    $("word-say").textContent = "It has read 46 short sentences about looking after a pool. The bars are the words it saw start a sentence most often.";
  } else {
    $("word-say").textContent = opts.length === 1
      ? "Only one word ever followed these two in its reading, so there is nothing to choose."
      : "After “" + line.slice(-2).join(" ") + "” its reading went " + opts.length + " different ways. The bars are the odds it gives each.";
  }
}
function take(w, quiet) {
  if (done()) return;
  line.push(w);
  if (!ended() && line.length >= CAP) cut = true;
  if (!quiet) showLine();
}
$("word").addEventListener("click", function () { take(pick(options(line, bold), Math.random())); });
$("rest").addEventListener("click", function () {
  while (!done()) take(pick(options(line, bold), Math.random()), true);
  showLine();
});
$("fresh").addEventListener("click", function () { line = []; cut = false; showLine(); });
$("bold").addEventListener("input", function () {
  bold = +this.value;
  $("bold-out").textContent = bold < 0.75 ? "careful" : bold > 1.35 ? "bold" : "as read";
  showLine();
});
(function listReading() {
  var ol = $("reading");
  READING.forEach(function (s) { var li = document.createElement("li"); li.textContent = sentence(s.split(" ")) + "."; ol.appendChild(li); });
})();

var resizeTimer = 0;
window.addEventListener("resize", function () {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function () { size(); draw(); }, 80);
});

size();
choose(0);
var first = render();
say("These 33 knobs were set by dice, and the network gets " + first + " of 240 right. Try it by hand first: pick a knob below, move it, and see how far you get.");
showLine();
})();
