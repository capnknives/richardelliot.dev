/* Feeder match (tools/feeder-match.html).
   A snake's species and weight in, a feeder size and a schedule out.

   The top half is the table of sizes, the species rules and the matching.
   It has no DOM in it and also runs in Node (require it) for checking.
   The bottom half draws the page.

   FEEDERS is a placeholder: the names and gram ranges of one large US
   supplier's chart. A breeder's own chart goes here in its place. */

var FEEDERS = {
  mice: {
    label: "Mice",
    sizes: [
      { name: "Extra-small pinky", say: "extra-small pinky mouse", min: 1.5, max: 2,   typ: 1.75 },
      { name: "Small pinky",       say: "small pinky mouse",       min: 2,   max: 2.5, typ: 2.25 },
      { name: "Large pinky",       say: "large pinky mouse",       min: 2.5, max: 3,   typ: 2.75 },
      { name: "Peach fuzzy",       say: "peach fuzzy mouse",       min: 3,   max: 4.5, typ: 3.75 },
      { name: "Fuzzy",             say: "fuzzy mouse",             min: 4.5, max: 7,   typ: 5.75 },
      { name: "Hopper",            say: "hopper mouse",            min: 7,   max: 13,  typ: 10 },
      { name: "Weanling",          say: "weanling mouse",          min: 13,  max: 18,  typ: 15.5 },
      { name: "Adult",             say: "adult mouse",             min: 18,  max: 30,  typ: 24 },
      { name: "Jumbo",             say: "jumbo mouse",             min: 30,  max: 45,  typ: 37 }
    ]
  },
  rats: {
    label: "Rats",
    sizes: [
      { name: "Pinky",  say: "rat pinky",  min: 9,  max: 14,  typ: 11 },
      { name: "Fuzzy",  say: "rat fuzzy",  min: 14, max: 20,  typ: 16 },
      { name: "Pup",    say: "rat pup",    min: 20, max: 30,  typ: 25 },
      { name: "Weaned", say: "weaned rat", min: 30, max: 45,  typ: 38 },
      { name: "Small",  say: "small rat",  min: 45, max: 85,  typ: 65 },
      { name: "Medium", say: "medium rat", min: 85, max: 150, typ: 115 }
    ]
  }
};

/* curve: [snake weight in grams, meal as a share of body weight]. Between two
     points the share is blended, so there is no cliff at a stage boundary.
   stages: [weight under, stage name, days low, days high].
   mouseCeiling / ratCeiling: the largest size offered, as an index into sizes.
   ladder (hognose): [weight under, index into mice sizes]; -1 is pieces of a pinky.
     The hognose ladder is the chart two breeders publish, not a percentage. */
var SPECIES = {
  corn: {
    label: "Corn snake",
    inText: "corn snake",
    curve: [[8, 0.15], [24, 0.13], [150, 0.10], [350, 0.08], [500, 0.06]],
    stages: [[24, "Hatchling", 5, 7], [150, "Juvenile", 7, 10], [350, "Subadult", 10, 12], [Infinity, "Adult", 14, 21]],
    mouseCeiling: function (w) { return w > 450 ? 8 : 7; },
    ratCeiling: 4,
    presets: [["Hatchling", 8], ["Juvenile", 80], ["Adult", 450]],
    notes: ["Most corn snakes do well on adult mice for life."]
  },
  king: {
    label: "Florida kingsnake",
    inText: "Florida kingsnake",
    curve: [[10, 0.15], [35, 0.13], [200, 0.10], [450, 0.08], [700, 0.06]],
    stages: [[35, "Hatchling", 5, 7], [200, "Juvenile", 7, 10], [450, "Subadult", 7, 12], [Infinity, "Adult", 10, 14]],
    mouseCeiling: function (w) { return w > 450 ? 8 : 7; },
    ratCeiling: 5,
    presets: [["Hatchling", 12], ["Juvenile", 120], ["Adult", 700]],
    notes: ["Kingsnakes act hungry all the time and will overeat. Keep to the schedule.",
            "House kingsnakes alone. They eat other snakes.",
            "No veterinary chart exists for Florida kingsnakes. These numbers come from general kingsnake care and keeper practice."]
  },
  milk: {
    label: "Pueblan milk snake",
    inText: "Pueblan milk snake",
    curve: [[8, 0.13], [25, 0.11], [120, 0.09], [250, 0.07], [400, 0.06]],   // slimmer than a kingsnake, so a lower share
    stages: [[25, "Hatchling", 5, 7], [120, "Juvenile", 5, 7], [250, "Subadult", 7, 10], [Infinity, "Adult", 10, 14]],
    mouseCeiling: function () { return 7; },
    ratCeiling: 2,
    miceOnly: true,
    presets: [["Hatchling", 8], ["Juvenile", 60], ["Adult", 300]],
    notes: ["Pueblan milk snakes are slim and stay on mice for life.",
            "House milk snakes alone. They eat other snakes.",
            "No veterinary chart exists for Pueblan milk snakes. These numbers come from general milk snake care and keeper practice."]
  },
  ratsnake: {
    label: "Texas rat snake",
    inText: "Texas rat snake",
    curve: [[10, 0.15], [30, 0.13], [200, 0.10], [500, 0.08], [800, 0.06]],
    stages: [[30, "Hatchling", 5, 7], [200, "Juvenile", 5, 7], [500, "Subadult", 7, 10], [Infinity, "Adult", 10, 14]],
    mouseCeiling: function (w) { return w > 450 ? 8 : 7; },
    ratCeiling: 4,
    presets: [["Hatchling", 12], ["Juvenile", 120], ["Adult", 800]],
    notes: ["Adults can stay on mice or move to rats. One rat is easier than two mice for a big snake.",
            "No veterinary chart exists for Texas rat snakes. These numbers come from general rat snake care and keeper practice."]
  },
  hognose: {
    label: "Western hognose",
    inText: "western hognose",
    ladder: [[8, -1], [15, 0], [26, 1], [40, 3], [75, 4], [250, 5], [Infinity, 6]],
    stagesBySex: {
      male:   [[15, "Hatchling", 4, 5], [40, "Juvenile", 5, 7], [70, "Subadult male", 6, 7], [Infinity, "Adult male", 7, 10]],
      female: [[15, "Hatchling", 4, 5], [40, "Juvenile", 5, 7], [150, "Growing female", 6, 7], [Infinity, "Adult female", 7, 10]],
      unsure: [[15, "Hatchling", 4, 5], [40, "Juvenile", 5, 7], [70, "Subadult", 6, 7], [Infinity, "Adult", 7, 10]]
    },
    miceOnly: true,
    presets: [["Hatchling", 9], ["Juvenile", 30], ["Adult male", 80, "male"], ["Adult female", 250, "female"]],
    notes: ["Hognoses stay on mice for life and put on fat easily. When in doubt, go smaller.",
            "Skipping meals in fall and winter is normal if the weight holds steady."]
  }
};

var SHAPES = {
  thin:  { label: "Thin",  hint: "Thin: the spine stands up as a ridge and the sides look sunken." },
  ideal: { label: "Ideal", hint: "Ideal: a rounded body. You can feel the spine but not see it." },
  heavy: { label: "Heavy", hint: "Heavy: skin shows between the scales, fat pads near the tail, no clear neck." }
};

var MAX_WEIGHT = 3000;

/* The request form under the ticket. For now it only writes a message the
   buyer copies and sends themselves; nothing leaves the page. Fill these in
   when the breeder is ready and the form does more without other changes:
   contactName: greeting ("Hi Levi,").
   sms: a phone number. Adds a "Text this request" link.
   prices: dollars each, one per size in the same order as FEEDERS,
     e.g. { mice: [1, 1, 1.25, ...], rats: [...] }. Adds an estimated total. */
var ORDER = { contactName: "", sms: "", prices: null };
var FORMS = { frozen: "frozen", live: "live", either: "frozen or live" };
var MAX_QTY = 200;

function pluralOf(s) {
  if (/mouse$/.test(s)) return s.replace(/mouse$/, "mice");
  if (/y$/.test(s)) return s.replace(/y$/, "ies");
  return s + "s";
}
/* q: { qty, say, form, speciesName, weight, daysLow, daysHigh, name } */
function requestText(q) {
  var every = q.daysLow === q.daysHigh ? q.daysLow : q.daysLow + " to " + q.daysHigh;
  var lines = [
    (ORDER.contactName ? "Hi " + ORDER.contactName + "," : "Hi,") + " I would like " + q.qty + " " +
      (q.qty === 1 ? q.say : pluralOf(q.say)) + " (" + FORMS[q.form] + ").",
    "This is for my " + q.speciesName + ", which weighs " + q.weight + " g and eats one meal every " + every + " days."
  ];
  var name = (q.name || "").replace(/\s+/g, " ").trim().slice(0, 40);
  lines.push(name ? "Thanks, " + name : "Thanks!");
  return lines.join("\n");
}
function orderTotal(type, idx, qty) {
  var p = ORDER.prices && ORDER.prices[type] && ORDER.prices[type][idx];
  return typeof p === "number" ? p * qty : null;
}

function blend(curve, w) {
  if (w <= curve[0][0]) return curve[0][1];
  for (var i = 1; i < curve.length; i++) {
    if (w <= curve[i][0]) {
      var a = curve[i - 1], b = curve[i];
      return a[1] + (b[1] - a[1]) * (w - a[0]) / (b[0] - a[0]);
    }
  }
  return curve[curve.length - 1][1];
}
function sizeFor(sizes, target, ceiling) {
  var idx = 0;
  for (var i = 0; i < sizes.length; i++) { if (target >= sizes[i].min) idx = i; }
  return Math.min(idx, ceiling);
}
function stageFor(stages, w) {
  for (var i = 0; i < stages.length; i++) { if (w < stages[i][0]) return stages[i]; }
  return stages[stages.length - 1];
}

/* o: { species, weight, type: "mice" | "rats", sex: "male" | "female" | "unsure", shape } */
function match(o) {
  var sp = SPECIES[o.species];
  var type = sp.miceOnly ? "mice" : o.type;
  var sizes = FEEDERS[type].sizes;
  var w = o.weight;
  var r = { type: type, count: 1, tooSmall: false, parts: false, atCeiling: false, target: null };
  var st;
  if (sp.ladder) {
    st = stageFor(sp.stagesBySex[o.sex || "unsure"], w);
    r.idx = stageFor(sp.ladder, w)[1];
    r.parts = r.idx === -1;
  } else {
    st = stageFor(sp.stages, w);
    r.target = w * blend(sp.curve, w);
    var ceiling = type === "mice" ? sp.mouseCeiling(w) : sp.ratCeiling;
    if (type === "rats" && r.target * 1.25 < sizes[0].min) r.tooSmall = true;
    r.idx = sizeFor(sizes, r.target, ceiling);
    r.atCeiling = r.idx === ceiling && r.target >= sizes[r.idx].max;
    if (r.idx === sizes.length - 1 && r.target >= sizes[r.idx].typ * 1.6) r.count = 2;
  }
  r.stage = st[1];
  var lo = st[2], hi = st[3];
  if (o.shape === "heavy") { lo = hi; hi = Math.ceil(hi * 1.4); }
  if (o.shape === "thin") { hi = lo; }
  r.daysLow = lo;
  r.daysHigh = hi;
  r.size = r.parts ? null : sizes[r.idx];
  r.mealWeight = r.parts ? null : r.size.typ * r.count;
  r.pct = r.parts ? null : r.mealWeight / w * 100;
  r.buyLow = Math.ceil(30 / hi) * r.count;
  r.buyHigh = Math.ceil(30 / lo) * r.count;
  return r;
}

/* The snake weight at which the answer moves up a size, or null at the top. */
function nextStep(o) {
  var now = match(o);
  for (var w = Math.floor(o.weight) + 1; w <= MAX_WEIGHT; w++) {
    var m = match({ species: o.species, weight: w, type: o.type, sex: o.sex, shape: o.shape });
    if (!m.tooSmall && !m.parts && m.idx > now.idx) return { weight: w, size: m.size };
  }
  return null;
}

if (typeof module !== "undefined") {
  module.exports = { FEEDERS: FEEDERS, SPECIES: SPECIES, ORDER: ORDER, match: match, nextStep: nextStep, requestText: requestText, orderTotal: orderTotal, MAX_WEIGHT: MAX_WEIGHT };
}

/* ---------- the page ---------- */

if (typeof document !== "undefined" && document.getElementById("fm-ticket")) (function () {
  "use strict";

  var state = { species: "corn", type: "mice", weight: 80, sex: "unsure", shape: "ideal", qty: null, form: "frozen", name: "" };
  var $ = function (id) { return document.getElementById(id); };
  var weightInput = $("fm-weight");

  function buttons(host, items, current, small, onPick) {
    host.textContent = "";
    items.forEach(function (it) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "pick" + (small ? " small" : "");
      b.textContent = it.label;
      b.setAttribute("aria-pressed", String(it.value === current));
      b.addEventListener("click", function () { onPick(it.value, it); });
      host.appendChild(b);
    });
  }
  function fmt(n) { return (Math.round(n * 10) / 10).toString(); }
  function range(a, b, unit) { return (a === b ? a : a + "–" + b) + (unit ? " " + unit : ""); }
  var plural = pluralOf;

  /* The request form. qty is null until the buyer changes it, so it follows the ticket. */
  function drawOrder(sp, w, m) {
    var ok = !!m && !m.parts && !m.tooSmall;
    $("fm-order").hidden = !ok;
    $("fm-order-none").hidden = ok;
    if (!ok) return;
    var qty = state.qty === null ? m.buyHigh : state.qty;
    $("fm-qty").value = qty;
    buttons($("fm-form"), Object.keys(FORMS).map(function (k) { return { value: k, label: k.charAt(0).toUpperCase() + k.slice(1) }; }),
      state.form, true, function (v) { state.form = v; render(); });
    var total = orderTotal(m.type, m.idx, qty);
    $("fm-total").hidden = total === null;
    if (total !== null) $("fm-total").textContent = "About $" + total.toFixed(2) + " before tax.";
    var text = requestText({ qty: qty, say: m.size.say, form: state.form, speciesName: sp.inText, weight: fmt(w),
      daysLow: m.daysLow, daysHigh: m.daysHigh, name: state.name });
    $("fm-msg").textContent = text;
    var link = $("fm-text");
    link.hidden = !ORDER.sms;
    if (ORDER.sms) link.href = "sms:" + ORDER.sms + "?&body=" + encodeURIComponent(text);
    $("fm-copied").textContent = "";
  }
  function setQty(n) {
    if (!isFinite(n)) return;
    state.qty = Math.max(1, Math.min(MAX_QTY, Math.round(n)));
    render();
  }
  $("fm-less").addEventListener("click", function () { setQty(parseInt($("fm-qty").value, 10) - 1); });
  $("fm-more").addEventListener("click", function () { setQty(parseInt($("fm-qty").value, 10) + 1); });
  $("fm-qty").addEventListener("change", function () { setQty(parseInt($("fm-qty").value, 10)); });
  $("fm-name").addEventListener("input", function () {
    state.name = $("fm-name").value;
    var sel = [$("fm-name").selectionStart, $("fm-name").selectionEnd];
    render();
    $("fm-name").setSelectionRange(sel[0], sel[1]);
  });
  $("fm-copy").addEventListener("click", function () {
    var text = $("fm-msg").textContent, done = $("fm-copied");
    function fallback() {
      var r = document.createRange();
      r.selectNodeContents($("fm-msg"));
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      done.textContent = "Copying is blocked here. The request is selected, so copy it by hand.";
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done.textContent = "Copied. Paste it into a text or message."; }, fallback);
    } else { fallback(); }
  });

  function render() {
    var sp = SPECIES[state.species];
    var type = sp.miceOnly ? "mice" : state.type;
    var f = FEEDERS[type];

    buttons($("fm-species"), Object.keys(SPECIES).map(function (k) { return { value: k, label: SPECIES[k].label }; }),
      state.species, false, function (v) { state.species = v; state.qty = null; render(); });

    $("fm-sex-step").hidden = !sp.ladder;
    if (sp.ladder) {
      buttons($("fm-sex"), [{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "unsure", label: "Not sure" }],
        state.sex, false, function (v) { state.sex = v; state.qty = null; render(); });
    }

    buttons($("fm-presets"), sp.presets.map(function (p) { return { value: p[1], label: p[0] + " · " + p[1] + " g", sex: p[2] }; }),
      state.weight, true, function (v, it) {
        state.weight = v;
        weightInput.value = v;
        if (it.sex) state.sex = it.sex;
        state.qty = null;
        render();
      });

    $("fm-type-step").hidden = !!sp.miceOnly;
    buttons($("fm-type"), Object.keys(FEEDERS).map(function (k) { return { value: k, label: FEEDERS[k].label }; }),
      state.type, false, function (v) { state.type = v; state.qty = null; render(); });

    buttons($("fm-shape"), Object.keys(SHAPES).map(function (k) { return { value: k, label: SHAPES[k].label }; }),
      state.shape, false, function (v) { state.shape = v; state.qty = null; render(); });
    $("fm-shape-hint").textContent = SHAPES[state.shape].hint;

    var w = state.weight;
    var valid = isFinite(w) && w >= 1 && w <= MAX_WEIGHT;
    var notes = $("fm-notes");
    notes.textContent = "";
    function note(text, warn) {
      var li = document.createElement("li");
      li.textContent = text;
      if (warn) li.className = "warn";
      notes.appendChild(li);
    }
    if (!valid) {
      $("fm-who").textContent = sp.label;
      $("fm-stage").textContent = "";
      $("fm-meal").textContent = "Enter a weight";
      $("fm-sub").textContent = "Type the snake's weight in grams, between 1 and " + MAX_WEIGHT + ".";
      $("fm-often").textContent = "–";
      $("fm-month").textContent = "–";
      drawLadder(f, -2);
      drawOrder(sp, w, null);
      return;
    }
    var o = { species: state.species, weight: w, type: state.type, sex: state.sex, shape: state.shape };
    var m = match(o);
    $("fm-who").textContent = sp.label + " · " + fmt(w) + " g";
    $("fm-stage").textContent = m.stage;

    if (m.parts) {
      $("fm-meal").textContent = "Pinky pieces";
      $("fm-sub").textContent = "Too small for a whole pinky yet. Hatchlings this size eat pieces of one.";
      $("fm-month").textContent = "Ask your breeder";
      note("Ask your breeder to show you how to portion a pinky for a hatchling this small.", true);
    } else {
      $("fm-meal").textContent = m.count + " " + (m.count === 1 ? m.size.say : plural(m.size.say));
      $("fm-sub").textContent = "About " + fmt(m.mealWeight) + " g of food, " + fmt(m.pct) + "% of the snake's weight.";
      $("fm-month").textContent = range(m.buyLow, m.buyHigh) + " feeders";
    }
    $("fm-often").textContent = "Every " + range(m.daysLow, m.daysHigh, "days");

    if (m.tooSmall) note("This snake is too small for rats. Even a rat pinky is over the safe size, so switch to mice.", true);
    if (state.shape === "heavy") note("Heavy snake: feeding is stretched to the slow end. If the weight does not come down, see a reptile vet before cutting further.", true);
    if (state.shape === "thin") note("Thin snake: feeding is set to the fast end. If it is not gaining after a few meals, see a reptile vet.", true);
    if (m.atCeiling && m.type === "mice" && m.count === 1) note("This is the biggest mouse this tool gives a snake this size. Bigger meals at this stage mostly add fat.");
    if (m.count === 2) note("At this weight one small rat can replace two jumbo mice. Tap Rats to compare.");
    if (!m.parts && !m.tooSmall) {
      var up = nextStep(o);
      if (up) note("Next size up: " + up.size.say + " at around " + up.weight + " g.");
    }
    sp.notes.forEach(function (n) { note(n); });
    drawLadder(f, m.parts || m.tooSmall ? -2 : m.idx);
    drawOrder(sp, w, m);
  }

  function drawLadder(f, picked) {
    $("fm-ladder-title").textContent = f.label + ", smallest to largest";
    var host = $("fm-rungs");
    host.textContent = "";
    var top = Math.sqrt(f.sizes[f.sizes.length - 1].typ);
    f.sizes.forEach(function (s, i) {
      var li = document.createElement("li");
      if (i === picked) li.className = "picked";
      var name = document.createElement("span");
      name.className = "n";
      name.textContent = s.name;
      var bar = document.createElement("span");
      bar.className = "bar";
      bar.style.width = Math.max(4, Math.sqrt(s.typ) / top * 100) + "%";
      var g = document.createElement("span");
      g.className = "g";
      g.textContent = s.min + "–" + s.max + " g";
      li.appendChild(name);
      li.appendChild(bar);
      li.appendChild(g);
      host.appendChild(li);
    });
  }

  weightInput.addEventListener("input", function () {
    state.weight = parseFloat(weightInput.value);
    state.qty = null;
    render();
  });
  render();
})();
