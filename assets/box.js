/* The box.
   The front page starts in superposition: until the visitor does something,
   the headline is several headlines at once. The first touch, key, scroll or
   a few seconds collapses it into one world, with a number. "Open the box
   again" forks a new world; "Return to origin" goes back to world 0000.

   Each world has its own constants (light, gravity, fine structure), worked
   out from its number. They change the corridor, the weight and spacing of
   the headings, and a faint overlay across the page. Navigation and content
   never change between worlds.

   This file also keeps the branch map (every fork and return this session)
   and the Plain view switch, which turns all of the above off. */
(function () {
  "use strict";

  var root = document.documentElement;
  var TINTS = ["#f4efe4", "#dfeaf7", "#e9def7", "#dcf3e6", "#f7dede", "#f7ecd0"];
  var MAX_NODES = 24;

  function store(kind) {
    try { return window[kind]; } catch (e) { return null; }
  }
  function get(kind, key) {
    try { var s = store(kind); return s ? s.getItem(key) : null; } catch (e) { return null; }
  }
  function set(kind, key, value) {
    try { var s = store(kind); if (s) s.setItem(key, value); } catch (e) { /* storage is optional */ }
  }

  /* ---------- Plain view ---------- */
  var plainButton = document.querySelector("[data-plain]");
  function setPlain(on, save) {
    root.classList.toggle("plain", on);
    if (plainButton) {
      plainButton.textContent = on ? "Full view" : "Plain view";
      plainButton.setAttribute("aria-pressed", on ? "true" : "false");
    }
    if (save) set("localStorage", "re-plain", on ? "1" : "0");
    window.dispatchEvent(new CustomEvent("plainchange", { detail: { plain: on } }));
  }
  setPlain(get("localStorage", "re-plain") === "1", false);
  if (plainButton) {
    plainButton.hidden = false;
    plainButton.addEventListener("click", function () {
      setPlain(!root.classList.contains("plain"), true);
      if (root.classList.contains("plain")) collapse();
    });
  }

  /* ---------- Branch map ---------- */
  var nodes = [{ label: "Origin", parent: -1, kind: "origin" }];
  var current = 0;
  try {
    var saved = JSON.parse(get("sessionStorage", "re-branches") || "null");
    if (saved && saved.nodes && saved.nodes.length) {
      nodes = saved.nodes;
      current = Math.min(saved.current || 0, nodes.length - 1);
    }
  } catch (e) { /* start fresh */ }

  var map = document.querySelector("[data-branches]");
  var NS = "http://www.w3.org/2000/svg";

  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  function draw() {
    set("sessionStorage", "re-branches", JSON.stringify({ nodes: nodes, current: current }));
    if (!map) return;
    var depth = [], row = [], next = 0, maxDepth = 0;
    function place(i, d) {
      depth[i] = d;
      row[i] = next++;
      if (d > maxDepth) maxDepth = d;
      for (var j = i + 1; j < nodes.length; j++) if (nodes[j].parent === i) place(j, d + 1);
    }
    place(0, 0);
    var DX = 46, DY = 30, PAD = 12;
    var width = PAD * 2 + maxDepth * DX + 150;
    var height = PAD * 2 + (next - 1) * DY + 4;
    map.setAttribute("viewBox", "0 0 " + width + " " + height);
    map.style.width = width + "px";
    while (map.firstChild) map.removeChild(map.firstChild);
    var i, x, y;
    for (i = 1; i < nodes.length; i++) {
      var p = nodes[i].parent;
      x = PAD + depth[i] * DX; y = PAD + row[i] * DY;
      var px = PAD + depth[p] * DX, py = PAD + row[p] * DY;
      map.appendChild(el("path", {
        d: "M" + px + " " + py + "V" + y + "H" + x,
        "class": "branch-line" + (nodes[i].kind === "near" ? " near" : "")
      }));
    }
    for (i = 0; i < nodes.length; i++) {
      x = PAD + depth[i] * DX; y = PAD + row[i] * DY;
      map.appendChild(el("circle", {
        cx: x, cy: y, r: i === current ? 7 : 4.5,
        "class": "branch-node" + (i === current ? " here" : "")
      }));
      var t = el("text", { x: x + 12, y: y + 4, "class": "branch-label" + (i === current ? " here" : "") });
      t.textContent = nodes[i].label + (i === current ? "  (you)" : "");
      map.appendChild(t);
    }
    map.setAttribute("aria-label", "Branch map. " + nodes.length + " worlds so far. You are in: " + nodes[current].label + ".");
  }

  function fork(label, kind) {
    if (nodes.length >= MAX_NODES) return false;
    nodes.push({ label: label, parent: current, kind: kind || "world" });
    current = nodes.length - 1;
    draw();
    return true;
  }

  window.RE = {
    fork: fork,
    /* An exact undo: step back to the world you forked from. */
    back: function () {
      if (nodes[current].parent >= 0) current = nodes[current].parent;
      draw();
    },
    /* An inexact undo: you land beside the world you wanted, not in it. */
    near: function () {
      var target = nodes[current].parent >= 0 ? nodes[current].parent : current;
      if (nodes.length >= MAX_NODES) return;
      nodes.push({ label: "almost " + nodes[target].label, parent: target, kind: "near" });
      current = nodes.length - 1;
      draw();
    },
    origin: function () {
      current = 0;
      draw();
    },
    where: function () {
      return current;
    },
    goto: function (i) {
      if (i >= 0 && i < nodes.length) current = i;
      draw();
    }
  };

  /* ---------- Worlds ---------- */
  var chip = document.querySelector("[data-world-label]");

  function pad(n) {
    return ("000" + n).slice(-4);
  }

  var OVERLAYS = [
    "none",
    "repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 4px)",
    "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px) 0 0 / 100% 56px, linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px) 0 0 / 56px 100%",
    "radial-gradient(120% 60% at 10% 0%, rgba(120,160,255,0.16), transparent 60%), radial-gradient(90% 50% at 100% 30%, rgba(120,255,190,0.10), transparent 60%)",
    "radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.5), transparent 60%) 0 0 / 90px 90px, radial-gradient(1px 1px at 70% 80%, rgba(255,255,255,0.35), transparent 60%) 0 0 / 130px 130px"
  ];

  /* Each world's constants, worked out from its number. They are not
     decoration: light sets the corridor's pace, gravity the weight of the
     headings, fine structure the spacing of their letters. */
  function constants(n) {
    if (n === 0) return { c: 1, g: 1, a: 137 };
    return {
      c: 0.6 + ((n * 37) % 100) / 100 * 1.0,         /* 0.60 to 1.59 */
      g: 0.62 + ((n * 53) % 100) / 100 * 0.6,        /* 0.62 to 1.21 */
      a: 97 + ((n * 71) % 80)                        /* 1/97 to 1/176 */
    };
  }

  var VOICES = [
    "You are inside the box. Every door opens on a world I built.",
    "You are inside the box. The doors were somewhere else a moment ago.",
    "You are inside the box. It is bigger than it looked from outside.",
    "You are inside the box again. Nothing is quite where you left it.",
    "You are inside the box. Somebody has moved the doors."
  ];
  var VOICES2 = [
    "Each one a working project, with its own laws and its own weather.",
    "The same four projects, whichever world you are standing in.",
    "Whatever else changes out here, these four are real.",
    "The doors move. What is behind them does not."
  ];
  var FLAVOR = [
    "The corridor hums a little flat in this one.",
    "Somewhere down the hall, a door has just closed.",
    "The stars are in the wrong places, but only slightly.",
    "It smells faintly of rain.",
    "The floor is warm, as if someone just left.",
    "A version of you has already been through here.",
    "Every clock in this world is four minutes fast.",
    "The echo arrives before the sound.",
    "The doors are numbered here. The numbers keep changing.",
    "Someone has left a light on at the far end.",
    "Your footsteps land a half-beat late.",
    "The walls are closer than they were, or you are larger."
  ];

  function hasExtraDoor(n) {
    return n !== 0 && n % 9 === 0;           /* must match the rule in backdrop.js */
  }

  function fieldNote(n, k) {
    if (n === 0) return "Field note, world 0000. This is the world as built. Everything else is a variation.";
    var law = k.g < 0.8 ? "Gravity is weak here, and the headings have thinned out."
      : k.g > 1.08 ? "Gravity is strong here, and the headings have put on weight."
      : k.c > 1.3 ? "Light is quick here, so the corridor will not hold still."
      : k.c < 0.8 ? "Light is slow here, and the corridor is in no hurry."
      : k.a < 115 ? "Letters keep their distance in this world."
      : k.a > 160 ? "Letters crowd together in this world."
      : "The constants here are close to home.";
    return "Field note, world " + pad(n) + ". " + law + " " + FLAVOR[(n * 7) % FLAVOR.length] +
      (hasExtraDoor(n) ? " And there is a door here that is not on the plan." : "");
  }

  var seen = {};
  var lastWorld = 0;
  var jumpTimer = 0;
  function apply(n, jump) {
    var tint = n === 0 ? TINTS[0] : TINTS[1 + (n % (TINTS.length - 1))];
    var k = constants(n);
    root.style.setProperty("--light", tint);
    root.style.setProperty("--world-w", Math.round(Math.max(480, Math.min(900, 760 * k.g))));
    root.style.setProperty("--world-track", ((137 - k.a) / 137 * 0.09).toFixed(4) + "em");
    root.style.setProperty("--sky-overlay", n === 0 ? "none" : OVERLAYS[n % OVERLAYS.length]);
    root.setAttribute("data-world", pad(n));
    if (chip) chip.textContent = n === 0 ? "World 0000, the origin" : "World " + pad(n);
    var out = {
      c: document.querySelector("[data-const='c']"),
      g: document.querySelector("[data-const='g']"),
      a: document.querySelector("[data-const='a']")
    };
    if (out.c) out.c.textContent = "\u00d7" + k.c.toFixed(2);
    if (out.g) out.g.textContent = "\u00d7" + k.g.toFixed(2);
    if (out.a) out.a.textContent = "1/" + k.a;
    var v1 = document.querySelector("[data-world-voice]");
    var v2 = document.querySelector("[data-world-voice2]");
    var note = document.querySelector("[data-world-note]");
    if (v1) v1.textContent = n === 0 ? VOICES[0] : VOICES[n % VOICES.length];
    if (v2) v2.textContent = n === 0 ? VOICES2[0] : VOICES2[n % VOICES2.length];
    if (note) note.textContent = fieldNote(n, k);
    seen[n] = true;
    lastWorld = n;
    set("sessionStorage", "re-world", String(n));
    var moving = !!jump && !root.classList.contains("plain") &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (moving) {
      root.classList.remove("jumping");
      void root.offsetWidth;                          /* restart the animation */
      root.classList.add("jumping");
      window.clearTimeout(jumpTimer);
      jumpTimer = window.setTimeout(function () { root.classList.remove("jumping"); }, 1200);
    }
    window.dispatchEvent(new CustomEvent("worldchange", { detail: { seed: n, tint: tint, speed: k.c, jump: moving } }));
  }

  function roll() {
    return 1 + Math.floor(Math.random() * 9998);
  }

  var collapsed = false;
  function collapse() {
    if (collapsed) return;
    collapsed = true;
    root.classList.remove("superposed");
    var n = roll();
    apply(n);
    if (nodes.length === 1) fork("World " + pad(n));
    else draw();
  }

  var again = document.querySelector("[data-world='again']");
  var home = document.querySelector("[data-world='origin']");
  if (again) {
    again.addEventListener("click", function () {
      collapsed = true;
      root.classList.remove("superposed");
      var n = roll();
      apply(n, true);
      if (!fork("World " + pad(n))) window.RE.origin();
    });
  }
  if (home) {
    home.addEventListener("click", function () {
      collapsed = true;
      root.classList.remove("superposed");
      apply(0, true);
      window.RE.origin();
    });
  }

  if (!chip) return;          /* project pages: plain view only, no worlds */

  /* For the command bar. */
  window.RE.jump = function () { if (again) again.click(); };
  window.RE.toOrigin = function () { if (home) home.click(); };
  window.RE.info = function () {
    var k = constants(lastWorld);
    return "World " + pad(lastWorld) + (lastWorld === 0 ? ", the origin" : "") + ". Light \u00d7" + k.c.toFixed(2) +
      ", gravity \u00d7" + k.g.toFixed(2) + ", fine structure 1/" + k.a + "." +
      (hasExtraDoor(lastWorld) ? " There is one door too many here." : "");
  };
  window.RE.visited = function () { return Object.keys(seen).length; };

  var known = get("sessionStorage", "re-world");
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (known !== null && !isNaN(parseInt(known, 10))) {
    collapsed = true;
    apply(parseInt(known, 10));
    draw();
  } else if (still || root.classList.contains("plain")) {
    collapse();
  } else {
    root.classList.add("superposed");
    chip.textContent = "Unobserved";
    draw();
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (type) {
      window.addEventListener(type, collapse, { once: true, passive: true });
    });
    window.setTimeout(collapse, 4000);
  }
})();
