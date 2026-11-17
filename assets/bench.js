/* The workshop: change the laws of this page, then try to get home.
   A toy version of the question retractbench asks of language models.

   Eleven probes record what the page looked like before any edit. Two undos:
   - "from the record" puts back the saved originals. It is exact, and on the
     branch map you step back into the world you left.
   - "without the record" has nothing saved to go on, so it gets close and
     stops: colours come back a hair off, weight lands on the nearest hundred,
     spacing is nearly closed, and the visitor's line is left behind in the
     browser tab's title. On the branch map you land beside your world.
   The second one is a simulation, written to behave the way approximate undo
   methods do in the real measurements: near, and not the same. */
(function () {
  "use strict";

  var bench = document.querySelector("[data-bench]");
  if (!bench) return;

  var root = document.documentElement;
  var line = bench.querySelector("[data-bench-line]");
  var lede = document.querySelector(".box-hero .lede");

  var text = bench.querySelector("[data-edit='headline']");
  var hue = bench.querySelector("[data-edit='hue']");
  var weight = bench.querySelector("[data-edit='weight']");
  var space = bench.querySelector("[data-edit='space']");
  var chips = bench.querySelector("[data-probes]");
  var count = bench.querySelector("[data-count]");
  var say = bench.querySelector("[data-say]");
  var verdict = bench.querySelector("[data-verdict]");

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
  function nudge(hex) {
    /* Two steps out of 255 on each channel: too small to see, enough to measure. */
    return toHex(toRgb(hex).map(function (v) { return v < 128 ? v + 2 : v - 2; }));
  }

  /* ---- the record: what the page was before anyone touched it ---- */
  var base = {
    line: line.textContent,
    title: document.title,
    weight: parseInt(getComputedStyle(line).fontWeight, 10),
    colours: {}
  };
  PROBED.concat(WASHES).forEach(function (name) { base.colours[name] = cssVar(name); });

  var PROBES = [
    { name: "the line", read: function () { return line.textContent; } },
    { name: "tab title", read: function () { return document.title; } },
    { name: "gravity", read: function () { return getComputedStyle(line).fontWeight; } },
    { name: "space", read: function () { return getComputedStyle(line).letterSpacing; } },
    { name: "dark", read: function () { return cssVar("--paper"); } },
    { name: "light", read: function () { return cssVar("--ink"); } },
    { name: "blue", read: function () { return cssVar("--retract"); } },
    { name: "green", read: function () { return cssVar("--gecko"); } },
    { name: "teal", read: function () { return cssVar("--aqua"); } },
    { name: "plum", read: function () { return cssVar("--rift"); } },
    { name: "introduction", read: function () { return lede ? lede.textContent : ""; } }
  ];
  var original = PROBES.map(function (p) { return p.read(); });

  var touched = { line: false, hue: false, weight: false, space: false };
  var forked = false;
  var homeNode = -1;       /* where on the branch map the unedited page lives */

  function anyTouched() {
    return touched.line || touched.hue || touched.weight || touched.space;
  }

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

  /* How far have the constants drifted from the ones this world was built on? */
  function judge() {
    var h = parseInt(hue.value, 10);
    var drift = Math.min(h, 360 - h) / 180
      + Math.abs(parseInt(weight.value, 10) - base.weight) / 450
      + Math.abs(parseInt(space.value, 10)) / 45;
    verdict.textContent = drift < 0.03 ? "Habitable. These are the constants this world was built on."
      : drift < 0.55 ? "Barely habitable. Life here would be different."
      : "Uninhabitable. Nobody could read in this universe.";
  }

  function edited(which) {
    touched[which] = true;
    if (!forked && window.RE) {
      forked = true;
      if (homeNode < 0) homeNode = window.RE.where();
      window.RE.fork("edited", "edit");
    }
    say.textContent = "";
    judge();
    measure();
  }

  function setColours(fn) {
    PROBED.concat(WASHES).forEach(function (name) {
      root.style.setProperty(name, fn(base.colours[name], name));
    });
  }

  text.addEventListener("input", function () {
    var v = text.value.trim();
    line.textContent = v || base.line;
    document.title = v ? v + " — Richard Elliot" : base.title;
    edited("line");
  });
  hue.addEventListener("input", function () {
    var deg = parseInt(hue.value, 10);
    setColours(function (hex) { return rotate(hex, deg); });
    edited("hue");
  });
  weight.addEventListener("input", function () {
    root.style.setProperty("--w-head", parseInt(weight.value, 10));
    edited("weight");
  });
  space.addEventListener("input", function () {
    root.style.setProperty("--ls", parseInt(space.value, 10));
    edited("space");
  });

  /* ---- two ways home ---- */
  function fromRecord() {
    line.textContent = base.line;
    document.title = base.title;
    PROBED.concat(WASHES).forEach(function (name) { root.style.removeProperty(name); });
    root.style.removeProperty("--w-head");
    root.style.removeProperty("--ls");
    text.value = "";
    hue.value = 0;
    weight.value = base.weight;
    space.value = 0;
    if (homeNode >= 0 && window.RE) window.RE.goto(homeNode);
    homeNode = -1;
    touched = { line: false, hue: false, weight: false, space: false };
    forked = false;
    judge();
    measure();
    say.textContent = "Home. Every probe matches, and the map shows you back in the world you left. An undo that kept the original is exact.";
  }

  function withoutRecord() {
    if (!anyTouched()) {
      say.textContent = "Nothing to undo yet. Change the line or one of the constants first.";
      return;
    }
    if (touched.line) {
      line.textContent = base.line;         /* the visible text comes back... */
      text.value = "";                      /* ...the tab title is left as it was */
    }
    if (touched.hue) {
      setColours(function (hex) { return nudge(hex); });
      hue.value = 0;
    }
    if (touched.weight) {
      var w = Math.round(base.weight / 100) * 100;
      root.style.setProperty("--w-head", w);
      weight.value = w;
    }
    if (touched.space) {
      root.style.setProperty("--ls", 1);
      space.value = 0;
    }
    if (window.RE) window.RE.near();
    /* Still not home, and the next edit starts a fresh branch from here. */
    touched = { line: false, hue: false, weight: false, space: false };
    forked = false;
    judge();
    var same = measure();
    var missed = PROBES.length - same;
    say.textContent = missed
      ? "It looks like home. " + missed + " of " + PROBES.length + " probes say it is the world next door. That gap is what retractbench measures in language models."
      : "This time every probe matches. That can happen. It is not something you can count on.";
  }

  bench.querySelector("[data-undo='record']").addEventListener("click", fromRecord);
  bench.querySelector("[data-undo='blind']").addEventListener("click", withoutRecord);

  weight.value = base.weight;
  judge();
  measure();
})();
