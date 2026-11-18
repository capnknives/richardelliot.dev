/* Pool water balance (tools/pool-balance.html).
   Part one is the chemistry: pure functions, no page. Part two reads the form,
   writes the plan and draws the pool wall. Nothing leaves the browser. */
(function () {
"use strict";

/* ---------- Chemistry ---------- */
var K1 = Math.pow(10, -6.35), K2 = Math.pow(10, -10.33), KW = 1e-14, KC = Math.pow(10, -6.88);
var GAL = 3.785411784;

function carbCoef(pH) {            // equivalents of alkalinity per mole of dissolved carbonate
  var h = Math.pow(10, -pH), d = h * h + K1 * h + K1 * K2;
  return (K1 * h + 2 * K1 * K2) / d;
}
function cyaMeq(cyaPpm, pH) {      // alkalinity carried by cyanurate, meq/L
  var h = Math.pow(10, -pH);
  return (cyaPpm / 129.07) * (KC / (KC + h));
}
function waterMeq(pH) { var h = Math.pow(10, -pH); return (KW / h - h) * 1000; }
function taFrom(pH, dic, cya) { return dic * carbCoef(pH) + cyaMeq(cya, pH) + waterMeq(pH); }
function dicFrom(pH, taMeq, cya) { return Math.max(0, (taMeq - cyaMeq(cya, pH) - waterMeq(pH)) / carbCoef(pH)); }
function solvePH(taMeq, dic, cya) {
  var lo = 3, hi = 12;
  for (var i = 0; i < 60; i++) { var m = (lo + hi) / 2; if (taFrom(m, dic, cya) < taMeq) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
function carbAlkPpm(taPpm, cya, pH) { return Math.max(1, taPpm - cyaMeq(cya, pH) * 50); }
/* The saturation index in the form the pool trade uses: pH plus factors for temperature,
   calcium hardness and carbonate alkalinity, minus a constant that rises with dissolved
   solids. The factors are worked out, not read from rounded rows of the chart.
   Temperature is Wojtowicz's fit to the chart's own factors. The constant runs through the
   ANSI/APSP steps (12.1 under 800 ppm, then 12.2, 12.3, 12.4, 12.5), each placed at the
   middle of its range and joined in a straight line on a log scale. */
var TDS_STEPS = [[400, 12.1], [1100, 12.2], [2100, 12.3], [4000, 12.4], [6500, 12.5]];
function tdsFactor(tds) {
  var x = Math.log10(Math.max(1, tds)), a, b;
  if (tds <= TDS_STEPS[0][0]) return TDS_STEPS[0][1];
  for (var i = 1; i < TDS_STEPS.length; i++) {
    a = TDS_STEPS[i - 1]; b = TDS_STEPS[i];
    if (tds <= b[0]) return a[1] + (b[1] - a[1]) * (x - Math.log10(a[0])) / (Math.log10(b[0]) - Math.log10(a[0]));
  }
  return TDS_STEPS[TDS_STEPS.length - 1][1];
}
function lsi(w) {
  var TF = -0.56 + 0.01827 * w.temp - 0.000041 * w.temp * w.temp;
  var CF = Math.log10(Math.max(1, w.ch)) - 0.4;
  var AF = Math.log10(carbAlkPpm(w.ta, w.cya, w.ph));
  return w.ph + TF + CF + AF - tdsFactor(w.tds);
}

var RANGE = { ph: [7.2, 7.8], ta: [80, 120], ch: [200, 400], cya: [30, 80] };

function buildPlan(w, opt) {
  opt = opt || {};
  var phT = opt.phTarget || 7.5, chT = opt.chTarget || 250, taT = opt.taTarget || 100;
  var L = w.gal * GAL, steps = [];
  var s = { ph: w.ph, ta: w.ta / 50, cya: w.cya, ch: w.ch };
  s.dic = dicFrom(s.ph, s.ta, s.cya);

  // 0. Dilution is the only way down for calcium and stabilizer.
  var f = 0, why = [];
  /* Leave as much calcium as the plan will want, so it never drains calcium out and then adds it back. */
  var keep = Math.min(RANGE.ch[1], Math.max(350, opt.chTarget || 0));
  if (s.ch > RANGE.ch[1]) { f = Math.max(f, 1 - keep / s.ch); why.push("calcium hardness of " + Math.round(s.ch)); }
  if (s.cya > RANGE.cya[1]) { f = Math.max(f, 1 - 50 / s.cya); why.push("stabilizer of " + Math.round(s.cya)); }
  if (f > 0) {
    steps.push({ kind: "drain", pct: Math.round(f * 100), why: why });
    s.ch *= (1 - f); s.cya *= (1 - f);
    /* The fill water is unknown, so pH and alkalinity are taken to come back as they
       were. The carbonate has to be worked out again against the thinner stabilizer. */
    s.dic = dicFrom(s.ph, s.ta, s.cya);
  }

  // 1. Total alkalinity.
  var taPpm = s.ta * 50, aerated = false;
  if (taPpm < RANGE.ta[0] || (opt.taTarget && taPpm < taT - 5)) {
    var x = (taT - taPpm) / 50;
    s.ta += x; s.dic += x; s.ph = solvePH(s.ta, s.dic, s.cya);
    steps.push({ kind: "bicarb", grams: x * L * 84.01 / 1000, from: taPpm, to: taT, ph: s.ph });
  } else if (taPpm > RANGE.ta[1]) {
    var y = (taPpm - taT) / 50;
    s.ta -= y; s.ph = phT; s.dic = dicFrom(s.ph, s.ta, s.cya); aerated = true;
    steps.push({ kind: "acidTA", ml: y * L / 10.0, from: taPpm, to: taT });
  }

  // 2. pH.
  var needPH = !aerated && (s.ph < RANGE.ph[0] - 1e-6 || s.ph > (opt.phHigh || RANGE.ph[1]) + 1e-6 || (opt.forcePH && Math.abs(s.ph - phT) > 0.05));
  if (needPH && s.ph > phT) {
    var a = s.ta - taFrom(phT, s.dic, s.cya), from = s.ph;
    s.ta -= a; s.ph = phT;
    steps.push({ kind: "acidPH", ml: a * L / 10.0, from: from, to: phT, ta: s.ta * 50 });
  } else if (needPH && s.ph < phT) {
    var lo = 0, hi = 10, from2 = s.ph;
    for (var i = 0; i < 60; i++) { var m = (lo + hi) / 2; if (solvePH(s.ta + 2 * m, s.dic + m, s.cya) < phT) lo = m; else hi = m; }
    /* Soda ash is always the dose. It also adds alkalinity, so when the full dose would carry
       alkalinity past its range the dose stops there, as long as that still brings pH up to
       7.2. Aeration is offered as extra help for the rest, never as the only step. */
    var ash = lo, short = false;
    if ((s.ta + 2 * lo) * 50 > RANGE.ta[1] + 0.5 && !opt.fullAsh) {
      var room = Math.max(0, (RANGE.ta[1] / 50 - s.ta) / 2), floor = 0;
      if (s.ph < RANGE.ph[0]) {
        var a2 = 0, b2 = lo;
        for (i = 0; i < 60; i++) { m = (a2 + b2) / 2; if (solvePH(s.ta + 2 * m, s.dic + m, s.cya) < RANGE.ph[0]) a2 = m; else b2 = m; }
        floor = b2;
      }
      ash = Math.min(lo, Math.max(room, floor));
      short = true;
    }
    if (ash > 1e-6) {
      s.ta += 2 * ash; s.dic += ash; s.ph = short ? solvePH(s.ta, s.dic, s.cya) : phT;
      var over = s.ta * 50 > RANGE.ta[1] + 0.5;
      steps.push({ kind: "sodaAsh", grams: ash * L * 105.99 / 1000, from: from2, to: s.ph, ta: s.ta * 50, want: short ? phT : 0, over: over });
      if (over) {
        /* The way a tech does it: let the soda ash carry alkalinity high, give it time, then
           bring alkalinity back down with acid in rounds. pH is taken to recover between
           rounds, as it does in the alkalinity step above, and gets tuned on the return visit. */
        var land = Math.max(110, taT), down = (s.ta * 50 - land) / 50, high = s.ta * 50;
        s.ta -= down; s.ph = phT; s.dic = dicFrom(s.ph, s.ta, s.cya);
        steps.push({ kind: "acidAfter", ml: down * L / 10.0, from: high, to: land });
      }
    }
  }
  /* Acid for pH spends alkalinity. If that leaves it short, put some back. */
  if (s.ta * 50 < RANGE.ta[0] - 0.5) {
    var back = (90 - s.ta * 50) / 50, was = s.ta * 50;
    s.ta += back; s.dic += back; s.ph = solvePH(s.ta, s.dic, s.cya);
    steps.push({ kind: "bicarb", grams: back * L * 84.01 / 1000, from: was, to: 90, ph: s.ph });
  }

  // 3. Calcium hardness.
  if (s.ch < Math.max(RANGE.ch[0], opt.chTarget || 0) - 0.5) {
    steps.push({ kind: "calcium", grams: (chT - s.ch) / 100.09 * 147.01 * L / 1000, from: s.ch, to: chT });
    s.ch = chT;
  }
  // 4. Stabilizer.
  if (s.cya < RANGE.cya[0]) {
    steps.push({ kind: "cya", grams: (40 - s.cya) * L / 1000, from: s.cya, to: 40 });
    s.cya = 40;
  }
  var end = { ph: s.ph, ta: s.ta * 50, ch: s.ch, cya: s.cya, temp: w.temp, tds: w.tds };
  return { steps: steps, end: end, lsi: lsi(end) };
}

/* Try the plain plan first. If the readings land in range but the index does not,
   lean on calcium, then pH, which are the two levers that stay inside their ranges.
   pH moves a tenth at a time and stops at the first target that balances, so the
   plan never swings from hungry water to scaling water or back. */
function leanOnPH(w, chTarget, p, dir, taTarget, fullAsh) {
  var best = p, start = Math.round(Math.min(7.8, Math.max(7.2, p.end.ph)) * 10);
  for (var t = start + dir; t >= 72 && t <= 78; t += dir) {
    var q = buildPlan(w, { chTarget: chTarget, phTarget: t / 10, forcePH: true, taTarget: taTarget, fullAsh: fullAsh });
    if (q.end.ph < RANGE.ph[0] - 0.005 || q.end.ph > RANGE.ph[1] + 0.005) continue;
    if (Math.abs(q.lsi) < Math.abs(best.lsi)) best = q;
    if (q.lsi >= -0.3 && q.lsi <= 0.3) return q;
  }
  return best;
}
/* A pH up to 8.0 is over the textbook range, but a tech leaves it alone when everything else
   is good. So acid for pH is only called for above 7.8 if the water would not balance without it. */
var PH_LEAVE = 8.0;
function plan(w) {
  var easy = buildPlan(w, { phHigh: PH_LEAVE });
  if (easy.end.ph > RANGE.ph[1] + 0.005 && easy.lsi >= -0.3 && easy.lsi <= 0.3) {
    easy.balanced = true; easy.phLeft = easy.end.ph;
    return easy;
  }
  var p = buildPlan(w);
  if (p.lsi < -0.3) {
    var need = Math.ceil(p.end.ch * Math.pow(10, -0.15 - p.lsi) / 10) * 10;
    var ch = Math.min(400, Math.max(250, need));
    p = buildPlan(w, { chTarget: ch });
    if (p.lsi < -0.3) p = leanOnPH(w, ch, p, 1);
    if (p.lsi < -0.3) {
      /* Still hungry with pH and calcium at the top: aim alkalinity at the top of its range too. */
      var r = leanOnPH(w, ch, buildPlan(w, { chTarget: ch, taTarget: RANGE.ta[1] }), 1, RANGE.ta[1]);
      if (r.lsi > p.lsi) p = r;
    }
    if (p.lsi < -0.3) {
      /* Last lever: stop holding soda ash back. Alkalinity overshoots and acid brings it down later. */
      var top = RANGE.ta[1], u = leanOnPH(w, ch, buildPlan(w, { chTarget: ch, taTarget: top, fullAsh: true }), 1, top, true);
      if (u.lsi > p.lsi + 0.02) p = u;
    }
  } else if (p.lsi > 0.3) {
    p = leanOnPH(w, 0, p, -1);
  }
  p.balanced = p.lsi >= -0.3 && p.lsi <= 0.3;
  return p;
}

/* ---------- Page ---------- */
var FIELDS = [
  { id: "ph",   label: "pH", min: 6.8, max: 8.4, step: 0.1, def: 7.2, ideal: "7.2 to 7.8", r: RANGE.ph },
  { id: "ta",   label: "Total alkalinity", unit: "ppm", min: 0, max: 300, step: 5, def: 60, ideal: "80 to 120 ppm", r: RANGE.ta },
  { id: "ch",   label: "Calcium hardness", unit: "ppm", min: 0, max: 1000, step: 10, def: 150, ideal: "200 to 400 ppm", r: RANGE.ch },
  { id: "cya",  label: "Stabilizer (cyanuric acid)", unit: "ppm", min: 0, max: 200, step: 5, def: 40, ideal: "30 to 80 ppm", r: RANGE.cya },
  { id: "temp", label: "Water temperature", unit: "°F", min: 32, max: 104, step: 1, def: 78, ideal: "Warm water scales sooner" },
  { id: "gal",  label: "Pool volume", unit: "gallons", min: 1000, max: 60000, step: 500, def: 15000, ideal: "Sets the size of each dose, not the balance" }
];
var $ = function (id) { return document.getElementById(id); };
var rows = $("rows");
FIELDS.forEach(function (f) {
  var pct = function (v) { return ((v - f.min) / (f.max - f.min) * 100).toFixed(1) + "%"; };
  var band = f.r ? "--lo:" + pct(f.r[0]) + ";--hi:" + pct(f.r[1]) : "--lo:0%;--hi:0%";
  var d = document.createElement("div");
  d.className = "row";
  d.innerHTML =
    '<div class="row-head"><label for="' + f.id + '">' + f.label + (f.unit ? " <small>" + f.unit + "</small>" : "") + '</label>' +
    '<span class="chip" id="' + f.id + '-chip" data-s="none"></span>' +
    '<input class="num" id="' + f.id + '" type="number" inputmode="decimal" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + f.def + '"></div>' +
    '<input type="range" id="' + f.id + '-slide" aria-label="' + f.label + ' slider" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + f.def + '" style="' + band + '">' +
    '<p class="ideal">' + f.ideal + '</p>';
  rows.appendChild(d);
  var num = d.querySelector(".num"), slide = d.querySelector('input[type="range"]');
  slide.addEventListener("input", function () { num.value = slide.value; update(); });
  num.addEventListener("input", function () { if (num.value !== "") { slide.value = num.value; update(); } });
  /* On leaving the box, show the value the plan is using: in range, and never blank. */
  num.addEventListener("change", function () {
    var v = parseFloat(num.value);
    if (!isFinite(v)) v = parseFloat(slide.value);
    v = Math.min(f.max, Math.max(f.min, v));
    num.value = v; slide.value = v; update();
  });
});
/* Dissolved solids: hardly anyone has a meter, so the pool type stands in for a reading. */
var SOLIDS = { chlorine: 1000, salt: 3200 }, TDS_MIN = 200, TDS_MAX = 8000;
(function () {
  var d = document.createElement("fieldset");
  d.className = "row kind";
  d.innerHTML =
    '<legend>Pool type</legend>' +
    '<div class="kinds">' +
    '<label><input type="radio" name="kind" value="chlorine" checked> Chlorine <small>about 1,000 ppm dissolved solids</small></label>' +
    '<label><input type="radio" name="kind" value="salt"> Salt <small>about 3,200 ppm</small></label>' +
    '</div>' +
    '<details><summary>I have a dissolved solids reading</summary>' +
    '<div class="row-head"><label for="tds">Dissolved solids <small>ppm</small></label>' +
    '<input class="num" id="tds" type="number" inputmode="numeric" min="' + TDS_MIN + '" max="' + TDS_MAX + '" step="50" placeholder="none"></div>' +
    '<p class="ideal">Used in place of the pool type while it is filled in. Clear it to go back.</p></details>';
  rows.insertBefore(d, $("gal").closest(".row"));
  d.addEventListener("input", update);
  $("tds").addEventListener("change", function () {
    var v = parseFloat($("tds").value);
    $("tds").value = isFinite(v) ? Math.min(TDS_MAX, Math.max(TDS_MIN, v)) : "";
    update();
  });
})();
function solids() {
  var v = parseFloat($("tds").value);
  if (isFinite(v)) return Math.min(TDS_MAX, Math.max(TDS_MIN, v));
  return SOLIDS[document.querySelector('input[name="kind"]:checked').value];
}
$("readings").addEventListener("submit", function (e) { e.preventDefault(); });
$("reset").addEventListener("click", function () {
  FIELDS.forEach(function (f) { $(f.id).value = f.def; $(f.id + "-slide").value = f.def; });
  document.querySelector('input[name="kind"][value="chlorine"]').checked = true;
  $("tds").value = "";
  update();
});

function read() {
  var w = {};
  FIELDS.forEach(function (f) {
    var v = parseFloat($(f.id).value);
    if (!isFinite(v)) v = parseFloat($(f.id + "-slide").value);
    w[f.id] = Math.min(f.max, Math.max(f.min, v));
  });
  w.tds = solids();
  return w;
}
function signed(v) { var t = Math.abs(v).toFixed(2); return (v < -0.004 ? "−" : v > 0.004 ? "+" : "") + t; }
function weight(g) {
  var oz = g / 28.3495;
  if (oz < 16) return (oz < 10 ? oz.toFixed(1) : Math.round(oz)) + " oz";
  var lb = Math.floor(oz / 16), rest = Math.round(oz - lb * 16);
  if (rest === 16) { lb++; rest = 0; }
  if (lb >= 20) return Math.round(oz / 16) + " lb";
  return lb + " lb" + (rest ? " " + rest + " oz" : "");
}
function liquid(ml) {
  var fl = ml / 29.5735;
  if (fl < 32) return (fl < 10 ? fl.toFixed(1) : Math.round(fl)) + " fl oz";
  if (fl < 128) return (fl / 32).toFixed(1) + " quarts";
  return (fl / 128).toFixed(1) + " gallons";
}
function n0(v) { return Math.round(v); }
function n1(v) { return v.toFixed(1); }
function describe(s) {
  switch (s.kind) {
    case "drain": return ["Drain and refill about " + s.pct + "% of the water",
      "A " + s.why.join(" and a ") + " ppm only come" + (s.why.length > 1 ? "" : "s") + " down by dilution. Test your fill water first, because tap water in much of Texas is hard. Retest everything after refilling and run this again with the new readings. Treat the steps below as a rough guide until then."];
    case "bicarb": return ["Add " + weight(s.grams) + " of baking soda (sodium bicarbonate)",
      "Raises total alkalinity from " + n0(s.from) + " to " + s.to + " ppm. pH should settle near " + n1(s.ph) + "."];
    case "acidTA": return ["Add " + liquid(s.ml) + " of muriatic acid (31.45%), a quarter at a time",
      "Lowers total alkalinity from " + n0(s.from) + " to " + s.to + " ppm. Each round drops pH too, so point the returns up or run a fountain until pH climbs back above 7.4 before the next round."];
    case "acidPH": return ["Add " + liquid(s.ml) + " of muriatic acid (31.45%)",
      "Lowers pH from " + n1(s.from) + " to " + n1(s.to) + ". Total alkalinity ends near " + n0(s.ta) + " ppm."];
    case "sodaAsh": return ["Add up to " + weight(s.grams) + " of soda ash (sodium carbonate), half first",
      "Raises pH from " + n1(s.from) + " to " + n1(s.to) + ", and total alkalinity to about " + n0(s.ta) + " ppm. Add half, circulate for an hour and retest. " +
      (s.over ? "That alkalinity is over range on purpose: soda ash is what moves pH, and the next step brings alkalinity back down."
        : s.want && s.want - s.to > 0.04
        ? "The dose stops here because more soda ash would push alkalinity over range. Pointing the returns up between tests helps pH on toward " + n1(s.want) + " without adding any."
        : "Low-pH water also sheds carbon dioxide on its own, which lifts pH without any help, so you may not need the rest.")];
    case "acidAfter": return ["Later, add " + liquid(s.ml) + " of muriatic acid (31.45%), a quarter at a time",
      "Not the same hour as the soda ash: let it circulate and retest first. This brings total alkalinity back down from " + n0(s.from) + " to about " + s.to + " ppm. Each round of acid also pulls pH down, at first to below where you started. It climbs back as the water gives off carbon dioxide, which takes circulation and time, so retest and wait for pH to recover before the next round. Plan on a return visit to finish the tuning."];
    case "calcium": return ["Add " + weight(s.grams) + " of calcium chloride (77% flake)",
      "Raises calcium hardness from " + n0(s.from) + " to " + n0(s.to) + " ppm. Dissolve it in a bucket of pool water and add it in batches."];
    case "cya": return ["Add " + weight(s.grams) + " of stabilizer (cyanuric acid)",
      "Raises stabilizer from " + n0(s.from) + " to " + s.to + " ppm. It dissolves slowly, so wait a few days before retesting it."];
  }
}
var STATES = {
  low:  ["Eating plaster", "var(--hungry)", "This water is hungry. It will pull calcium out of plaster and grout, and metal out of heater cores, until it has had enough."],
  ok:   ["Balanced", "var(--room)", "This water is at rest. It takes nothing from the walls and leaves nothing on them."],
  high: ["Growing scale", "var(--crust)", "This water is overfull. It will leave calcium on the tile line, inside the pipes and on a salt cell's plates."]
};
var target = 0;
function update() {
  var w = read(), v = lsi(w), key = v < -0.3 ? "low" : v > 0.3 ? "high" : "ok", st = STATES[key];
  $("lsi").textContent = signed(v);
  $("state").textContent = st[0];
  $("verdict").textContent = st[2];
  document.querySelector(".pool").style.setProperty("--state", st[1]);
  $("pin").style.left = (Math.min(1.5, Math.max(-1.5, v)) + 1.5) / 3 * 100 + "%";
  FIELDS.forEach(function (f) {
    if (!f.r) return;
    var c = $(f.id + "-chip"), s = w[f.id] < f.r[0] - 1e-9 ? "low" : w[f.id] > f.r[1] + 1e-9 ? "high" : "ok";
    c.dataset.s = s; c.textContent = s === "ok" ? "in range" : s;
  });
  var p = plan(w), ol = $("steps");
  ol.innerHTML = "";
  p.steps.forEach(function (s) {
    var t = describe(s), li = document.createElement("li"), box = document.createElement("div");
    var b = document.createElement("b"), sp = document.createElement("span");
    b.textContent = t[0]; sp.textContent = t[1]; box.appendChild(b); box.appendChild(sp); li.appendChild(box); ol.appendChild(li);
  });
  if (!p.steps.length) {
    ol.innerHTML = '<p class="none">' + (p.phLeft ? "Nothing to add. The water is balanced." : key === "ok" ? "Nothing. Every reading is in range and the water is balanced." : "Every reading is in range, so there is no dose to give.") + "</p>";
  }
  /* Acid in rounds only ends where the plan says once pH has had time to climb back. */
  var slow = p.steps.some(function (s) { return s.kind === "acidAfter" || s.kind === "acidTA"; });
  $("after").textContent = p.steps.length
    ? (slow ? "This is not a one-visit fix. Right after each round of acid the pH, and the index with it, will read lower than this. Once the rounds are done and pH has come back up, the index should settle near "
            : "After this, the index should read ") + signed(p.lsi) + (p.balanced ? ", balanced." : p.lsi < 0 ? ". Still hungry: this water is cold or soft enough that the ranges alone will not settle it. Keep pH and calcium at the top of their ranges." : ". Still scale-forming: keep pH near 7.2 and let alkalinity drift toward 80.")
    : (p.phLeft ? "" : key === "ok" ? "" : key === "low" ? "The index is low because of temperature. Keep pH and calcium at the top of their ranges." : "The index is high because of temperature or dissolved solids. Keep pH near 7.2.");
  if (p.phLeft) $("after").textContent += (p.steps.length ? " " : "") + "pH " + n1(p.phLeft) + " is over the textbook 7.8, but with the rest in line this water is balanced, so it can sit there. Above " + n1(PH_LEAVE) + " it gets brought down.";
  target = Math.min(1.5, Math.max(-1.5, v));
  if (still) draw(0);
}

/* ---- The pool wall. Pits when the water is hungry, crusts when it is overfull. ---- */
var cv = $("tank"), cx = cv.getContext("2d");
var root = document.documentElement;
var AIR = getComputedStyle(document.body).getPropertyValue("--wash").trim() || "#dceef2";
var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.classList.contains("plain");
var shown = 0, W = 0, H = 0, bits = [];
function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
for (var i = 0; i < 46; i++) bits.push({ x: rnd(i), y: rnd(i + 99), v: 0.4 + rnd(i + 7) * 0.8, r: 0.8 + rnd(i + 31) * 1.6 });
function size() {
  var dpr = Math.min(2, window.devicePixelRatio || 1), b = cv.getBoundingClientRect();
  W = b.width; H = b.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function edge(y, wall, hungry, crust) {          // x of the wall face at height y
  var pit = 0, grow = 0;
  for (var k = 0; k < 9; k++) {
    var c = rnd(k + 400) * H, wd = 6 + rnd(k + 500) * 12, d = (y - c) / wd;
    pit += Math.exp(-d * d) * (0.5 + rnd(k + 600));
  }
  grow = (0.55 + 0.45 * Math.sin(y * 0.33 + 2) * Math.sin(y * 0.11)) + rnd(Math.floor(y / 3) + 900) * 0.5;
  return wall - pit * hungry * wall * 0.34 + grow * crust * wall * 0.42;
}
function draw(t) {
  if (still) shown = target; else shown += (target - shown) * 0.06;
  var hungry = Math.min(1, Math.max(0, (-shown - 0.3) / 1.0)), crust = Math.min(1, Math.max(0, (shown - 0.3) / 1.0));
  var wall = Math.max(54, W * 0.17), top = H * 0.2, y, i;
  cx.clearRect(0, 0, W, H);
  // air and water
  cx.fillStyle = AIR; cx.fillRect(0, 0, W, top);
  var g = cx.createLinearGradient(0, top, 0, H);
  g.addColorStop(0, "#63b9bd"); g.addColorStop(1, "#0a606a");
  cx.fillStyle = g; cx.fillRect(0, top, W, H - top);
  // light moving through the water
  cx.lineCap = "round";
  for (i = 0; i < 5; i++) {
    cx.beginPath();
    for (var x = wall; x <= W; x += 8) {
      y = top + (H - top) * (0.16 + i * 0.19) + Math.sin(x * 0.018 + t * 0.0006 * (1 + i * 0.3) + i * 2.1) * (5 + hungry * 5) + Math.sin(x * 0.007 - t * 0.0004 + i) * 6;
      if (x === wall) cx.moveTo(x, y); else cx.lineTo(x, y);
    }
    cx.strokeStyle = "rgba(255,255,255," + (0.13 - i * 0.015) + ")"; cx.lineWidth = 5 - i * 0.6; cx.stroke();
  }
  if (crust > 0) { cx.fillStyle = "rgba(236,240,244," + crust * 0.34 + ")"; cx.fillRect(wall, top, W - wall, H - top); }
  // drifting calcium: leaving the wall when hungry, heading for it when overfull
  var amt = Math.max(hungry, crust), dir = hungry > 0 ? 1 : -1, span = W - wall;
  for (i = 0; i < bits.length * amt; i++) {
    var b = bits[i], life = ((b.x + t * 0.00006 * b.v) % 1 + 1) % 1, px = dir > 0 ? wall + life * span * 0.8 : W - life * span;
    var py = top + 6 + ((b.y * (H - top - 12)) + Math.sin(t * 0.001 * b.v + i) * 4 - dir * life * 14 + (H - top)) % (H - top - 8);
    cx.beginPath(); cx.arc(px, py, b.r * (dir > 0 ? 1 - life * 0.7 : 0.5 + life * 0.6), 0, 6.283);
    cx.fillStyle = dir > 0 ? "rgba(240,232,214," + (1 - life) * 0.8 + ")" : "rgba(255,255,255," + (0.25 + life * 0.6) + ")"; cx.fill();
  }
  // plaster wall with its eaten or crusted face
  cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(wall, 0); cx.lineTo(wall, top);
  for (y = top; y <= H; y += 2) cx.lineTo(Math.min(wall, edge(y, wall, hungry, 0)), y);
  cx.lineTo(0, H); cx.closePath(); cx.fillStyle = "#ebe5d6"; cx.fill();
  cx.fillStyle = "rgba(120,104,80,0.16)";
  for (i = 0; i < 70; i++) cx.fillRect(rnd(i + 50) * wall * 0.6, rnd(i + 150) * H, 1.4, 1.4);
  if (hungry > 0) {                                  // raw aggregate showing in the pits
    cx.strokeStyle = "rgba(138,58,18," + hungry * 0.55 + ")"; cx.lineWidth = 1.5; cx.beginPath();
    for (y = top; y <= H; y += 2) { var ex = edge(y, wall, hungry, 0); if (y === top) cx.moveTo(ex, y); else cx.lineTo(ex, y); }
    cx.stroke();
  }
  // waterline tile
  var th = Math.max(16, H * 0.17), tw = th * 0.62;
  for (i = 0; i * tw < wall; i++) {
    cx.fillStyle = i % 2 ? "#17506e" : "#1f6a8c";
    cx.fillRect(i * tw, top - th * 0.45, Math.min(tw - 1.5, wall - i * tw), th);
  }
  if (crust > 0) {                                   // scale: first at the waterline, then down the wall
    cx.beginPath(); cx.moveTo(wall, top - th * 0.2 * crust);
    for (y = top - th * 0.2 * crust; y <= H; y += 2) {
      var fall = y < top + th ? 1.5 : 1 - (y - top) / (H - top) * 0.55;
      cx.lineTo(wall + (edge(y, wall, 0, crust) - wall) * fall, y);
    }
    cx.lineTo(wall, H); cx.closePath(); cx.fillStyle = "rgba(250,250,247," + (0.55 + crust * 0.4) + ")"; cx.fill();
    cx.fillStyle = "rgba(250,250,247," + crust * 0.75 + ")";
    cx.fillRect(0, top - 1.5, wall, 3 + crust * 4);
  }
  // surface
  cx.strokeStyle = "rgba(255,255,255,0.7)"; cx.lineWidth = 1.5; cx.beginPath();
  for (x = wall; x <= W; x += 6) { y = top + Math.sin(x * 0.03 + t * 0.0012) * 1.4; if (x === wall) cx.moveTo(x, y); else cx.lineTo(x, y); }
  cx.stroke();
  if (!still) requestAnimationFrame(draw);
}
window.addEventListener("resize", function () { size(); if (still) draw(0); });
/* Plain view (the site-wide switch) hides the wall and stops the animation. */
window.addEventListener("plainchange", function () {
  var was = still;
  still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.classList.contains("plain");
  if (was && !still) { size(); requestAnimationFrame(draw); }
});
size();
update();
shown = target;
if (still) draw(0); else requestAnimationFrame(draw);
})();
