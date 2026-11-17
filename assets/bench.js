/* The workbench: edit this page, then try to take the edit back.
   A toy version of the question retractbench asks of language models.

   Eleven probes record what the page looked like before any edit. Two undos:
   - "from the record" puts back the saved originals. It is exact.
   - "without the record" has nothing saved to go on, so it gets close and
     stops: colours come back a hair off, the headline weight lands on the
     nearest hundred, and the
     visitor's line is left behind in the browser tab's title.
   The second one is a simulation, written to behave the way approximate undo
   methods do in the real measurements: near, and not the same. */
(function () {
  "use strict";

  var bench = document.querySelector("[data-bench]");
  if (!bench) return;

  var root = document.documentElement;
  var h1 = bench.querySelector("[data-bench-line]");
  var lede = document.querySelector(".hall .lede");
  var firstTitle = document.querySelector(".band-title");

  var text = bench.querySelector("[data-edit='headline']");
  var hue = bench.querySelector("[data-edit='hue']");
  var weight = bench.querySelector("[data-edit='weight']");
  var chips = bench.querySelector("[data-probes]");
  var count = bench.querySelector("[data-count]");
  var say = bench.querySelector("[data-say]");

  var PROBED = ["--paper", "--ink", "--retract", "--gecko", "--aqua", "--rift"];
  var WASHES = ["--retract-wash", "--gecko-wash", "--aqua-wash", "--rift-wash"];

  function cssVar(name) {
    return getComputedStyle(root).getPropertyValue(name).trim().toLowerCase();
  }

  /* ---- colour helpers ---- */
  function toRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function toHex(c) {
    return "#" + c.map(function (v) {
      return ("0" + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    }).join("");
  }
  function rotate(hex, deg) {
    var c = toRgb(hex).map(function (v) { return v / 255; });
    var max = Math.max(c[0], c[1], c[2]), min = Math.min(c[0], c[1], c[2]);
    var l = (max + min) / 2, d = max - min, h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === c[0]) h = ((c[1] - c[2]) / d) % 6;
      else if (max === c[1]) h = (c[2] - c[0]) / d + 2;
      else h = (c[0] - c[1]) / d + 4;
      h *= 60;
    }
    h = (h + deg + 360) % 360;
    var k = (1 - Math.abs(2 * l - 1)) * s;
    var x = k * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - k / 2;
    var r = h < 60 ? [k, x, 0] : h < 120 ? [x, k, 0] : h < 180 ? [0, k, x]
      : h < 240 ? [0, x, k] : h < 300 ? [x, 0, k] : [k, 0, x];
    return toHex(r.map(function (v) { return (v + m) * 255; }));
  }
  function coarse(hex) {
    /* Two steps out of 255 on each channel: too small to see, enough to measure. */
    return toHex(toRgb(hex).map(function (v) { return v < 128 ? v + 2 : v - 2; }));
  }

  /* ---- the record: what the page was before anyone touched it ---- */
  var base = {
    headline: h1.textContent,
    title: document.title,
    weight: parseInt(getComputedStyle(h1).fontWeight, 10),
    titleWeight: parseInt(getComputedStyle(firstTitle).fontWeight, 10),
    colours: {}
  };
  PROBED.concat(WASHES).forEach(function (name) { base.colours[name] = cssVar(name); });

  var PROBES = [
    { name: "the line", read: function () { return h1.textContent; } },
    { name: "tab title", read: function () { return document.title; } },
    { name: "line weight", read: function () { return getComputedStyle(h1).fontWeight; } },
    { name: "room-name weight", read: function () { return getComputedStyle(firstTitle).fontWeight; } },
    { name: "paper", read: function () { return cssVar("--paper"); } },
    { name: "ink", read: function () { return cssVar("--ink"); } },
    { name: "blue", read: function () { return cssVar("--retract"); } },
    { name: "green", read: function () { return cssVar("--gecko"); } },
    { name: "teal", read: function () { return cssVar("--aqua"); } },
    { name: "plum", read: function () { return cssVar("--rift"); } },
    { name: "introduction", read: function () { return lede.textContent; } }
  ];
  var original = PROBES.map(function (p) { return p.read(); });

  var touched = { headline: false, hue: false, weight: false };

  function measure() {
    var same = 0;
    chips.textContent = "";
    PROBES.forEach(function (p, i) {
      var ok = p.read() === original[i];
      if (ok) same++;
      var li = document.createElement("li");
      li.className = ok ? "ok" : "off";
      var mark = document.createElement("span");
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = ok ? "✓" : "×";
      li.appendChild(mark);
      li.appendChild(document.createTextNode(" " + p.name));
      var sr = document.createElement("span");
      sr.className = "sr";
      sr.textContent = ok ? " matches" : " differs";
      li.appendChild(sr);
      chips.appendChild(li);
    });
    count.textContent = same + " of " + PROBES.length;
    return same;
  }

  /* ---- edits ---- */
  function setColours(fn) {
    PROBED.concat(WASHES).forEach(function (name) {
      root.style.setProperty(name, fn(base.colours[name], name));
    });
  }

  text.addEventListener("input", function () {
    var v = text.value.trim();
    touched.headline = true;
    h1.textContent = v || base.headline;
    document.title = v ? v + " — Richard Elliot" : base.title;
    say.textContent = "";
    measure();
  });

  hue.addEventListener("input", function () {
    var deg = parseInt(hue.value, 10);
    touched.hue = true;
    setColours(function (hex) { return rotate(hex, deg); });
    say.textContent = "";
    measure();
  });

  weight.addEventListener("input", function () {
    var w = parseInt(weight.value, 10);
    touched.weight = true;
    root.style.setProperty("--w-head", w);
    root.style.setProperty("--w-title", Math.min(900, w + 50));
    say.textContent = "";
    measure();
  });

  /* ---- undo, two ways ---- */
  function fromRecord() {
    h1.textContent = base.headline;
    document.title = base.title;
    PROBED.concat(WASHES).forEach(function (name) { root.style.removeProperty(name); });
    root.style.removeProperty("--w-head");
    root.style.removeProperty("--w-title");
    text.value = "";
    hue.value = 0;
    weight.value = base.weight;
    touched = { headline: false, hue: false, weight: false };
    measure();
    say.textContent = "Revoked from the record. Every probe matches: an undo that kept the original is exact.";
  }

  function withoutRecord() {
    if (!touched.headline && !touched.hue && !touched.weight) {
      say.textContent = "Nothing to undo yet. Change the line, the colour or the weight first.";
      return;
    }
    if (touched.headline) {
      h1.textContent = base.headline;       /* the visible text comes back... */
      text.value = "";                      /* ...the tab title is left as it was */
    }
    if (touched.hue) {
      setColours(function (hex) { return coarse(hex); });
      hue.value = 0;
    }
    if (touched.weight) {
      var w = Math.round(base.weight / 100) * 100;
      var t = Math.round(base.titleWeight / 100) * 100;
      root.style.setProperty("--w-head", w);
      root.style.setProperty("--w-title", t);
      weight.value = w;
    }
    var same = measure();
    var missed = PROBES.length - same;
    say.textContent = missed
      ? "Undone without the record. It looks right, and " + missed + " of " + PROBES.length +
        " probes say it is not. That gap is what retractbench measures in language models."
      : "Undone without the record, and this time every probe matches. That can happen. It is not something you can count on.";
  }

  bench.querySelector("[data-undo='record']").addEventListener("click", fromRecord);
  bench.querySelector("[data-undo='blind']").addEventListener("click", withoutRecord);

  weight.value = base.weight;
  measure();
})();
