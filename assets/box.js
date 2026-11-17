/* The box.
   The front page starts in superposition: until the visitor does something,
   the headline is several headlines at once. The first touch, key, scroll or
   a few seconds collapses it into one world, with a number. "Open the box
   again" forks a new world; "Return to origin" goes back to world 0000.

   Worlds differ only in small things: the tint of the light and where the
   stars are. Navigation and content never change between them.

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

  function apply(n) {
    var tint = n === 0 ? TINTS[0] : TINTS[1 + (n % (TINTS.length - 1))];
    root.style.setProperty("--light", tint);
    root.setAttribute("data-world", pad(n));
    if (chip) chip.textContent = n === 0 ? "World 0000, the origin" : "World " + pad(n);
    set("sessionStorage", "re-world", String(n));
    window.dispatchEvent(new CustomEvent("worldchange", { detail: { seed: n, tint: tint } }));
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
      apply(n);
      if (!fork("World " + pad(n))) window.RE.origin();
    });
  }
  if (home) {
    home.addEventListener("click", function () {
      collapsed = true;
      root.classList.remove("superposed");
      apply(0);
      window.RE.origin();
    });
  }

  if (!chip) return;          /* project pages: plain view only, no worlds */

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
    ["pointerdown", "keydown", "wheel", "touchstart", "scroll"].forEach(function (type) {
      window.addEventListener(type, collapse, { once: true, passive: true });
    });
    window.setTimeout(collapse, 4000);
  }
})();
