/* The cellar: the tally of commands, and the wall people can sign.

   The tally reads what the command bar has recorded for this visit (window.REPrompt,
   kept in sessionStorage, so it is gone when the tab closes).

   The wall talks to the small server in worker/wall.js. Its address is the content of
   <meta name="wall-endpoint">. While that is empty, or the server cannot be reached,
   the wall stays hidden and the rest of the page is unchanged. Every name and note is
   put on the page as text, never as markup. Before a note is sent, the browser solves the
   small puzzle the wall hands out (the way it keeps bots off without knowing who anyone is).

   The keeper (the site's owner) opens cellar.html#keeper, types the key, and gets a
   "wipe" button beside each note. The key is held in this page's memory only. */
(function () {
  "use strict";

  /* ---------- the tally ---------- */
  var tally = document.querySelector("[data-tally]");
  var P = window.REPrompt;
  if (tally && P) {
    var list = tally.querySelector("[data-tally-list]");
    var count = tally.querySelector("[data-tally-count]");
    var draw = function (fresh) {
      var have = P.found();
      var hits = 0;
      list.textContent = "";
      P.listed.forEach(function (name) {
        var li = document.createElement("li");
        li.textContent = name;
        list.appendChild(li);
      });
      P.hidden.forEach(function (name) {
        var li = document.createElement("li");
        var got = have.indexOf(name) !== -1;
        if (got) hits++;
        li.textContent = got ? name : "···";
        if (!got) { li.className = "blank"; li.setAttribute("aria-label", "not found yet"); }
        else if (name === fresh) li.className = "new";
        list.appendChild(li);
      });
      count.textContent = hits + " of " + P.hidden.length + " hidden ones found this visit.";
    };
    draw();
    tally.hidden = false;
    window.addEventListener("commandfound", function (e) { draw(e.detail); });
  }

  /* ---------- the wall ---------- */
  var wall = document.querySelector("[data-wall]");
  var meta = document.querySelector('meta[name="wall-endpoint"]');
  var base = meta ? meta.content.replace(/\/+$/, "") : "";
  if (!wall || !base || !window.fetch || !(window.crypto && crypto.subtle)) return;

  var form = wall.querySelector("[data-wall-form]");
  var say = wall.querySelector("[data-wall-say]");
  var notes = wall.querySelector("[data-wall-list]");
  var button = form.querySelector("button");
  var key = "";

  function line(n, fresh) {
    var li = document.createElement("li");
    if (fresh) li.className = "fresh";
    li.appendChild(document.createTextNode(n.note ? n.name + " " + n.note : n.name + " was here"));
    var day = document.createElement("small");
    day.textContent = n.day;
    li.appendChild(day);
    if (key) {
      var wipe = document.createElement("button");
      wipe.type = "button";
      wipe.textContent = "wipe";
      wipe.addEventListener("click", function () {
        wipe.disabled = true;
        fetch(base + "/notes/" + n.id, { method: "DELETE", headers: { authorization: "Bearer " + key } })
          .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
          .then(function (r) {
            if (r.ok) li.remove(); else { wipe.disabled = false; say.textContent = r.body.error || "That did not work."; }
          })
          .catch(function () { wipe.disabled = false; say.textContent = "The wall could not be reached."; });
      });
      li.appendChild(wipe);
    }
    return li;
  }

  function load() {
    return fetch(base + "/notes").then(function (r) {
      if (!r.ok) throw new Error("wall");
      return r.json();
    }).then(function (data) {
      notes.textContent = "";
      (data.notes || []).forEach(function (n) { notes.appendChild(line(n, false)); });
      wall.hidden = false;
    });
  }

  load().catch(function () { /* no wall today: the section stays hidden */ });

  /* The wall asks for a moment of work before each note (see worker/wall.js): find a number
     that makes SHA-256(seed + ":" + number) start with `bits` zero bits. Nothing about the
     visitor is sent; the browser just does some arithmetic. Hashes run in batches so the
     page stays responsive. */
  var enc = new TextEncoder();
  function zeros(buf) {
    var bytes = new Uint8Array(buf), n = 0;
    for (var i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) { n += 8; continue; }
      return n + Math.clz32(bytes[i]) - 24;
    }
    return n;
  }
  function solve(seed, bits) {
    var start = 0, BATCH = 512;
    function round() {
      var tries = [];
      for (var i = 0; i < BATCH; i++) tries.push(crypto.subtle.digest("SHA-256", enc.encode(seed + ":" + (start + i))));
      return Promise.all(tries).then(function (out) {
        for (var i = 0; i < out.length; i++) if (zeros(out[i]) >= bits) return String(start + i);
        start += BATCH;
        return round();
      });
    }
    return round();
  }
  var post = function (body, left) {
    return fetch(base + "/challenge")
      .then(function (r) { return r.json(); })
      .then(function (c) {
        if (!c.seed) throw new Error(c.error || "wall");
        if (c.bits > 18) say.textContent = "The wall is busy, so the chalk takes longer. Hold on.";
        return solve(c.seed, c.bits).then(function (nonce) {
          body.seed = c.seed;
          body.nonce = nonce;
          return fetch(base + "/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        });
      })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (r) { return !r.ok && r.body.retry && left > 0 ? post(body, left - 1) : r; });
  };

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var body = { name: form.elements.name.value, note: form.elements.note.value, website: form.elements.website.value };
    button.disabled = true;
    say.textContent = "Chalking it up…";
    post(body, 2)
      .then(function (r) {
        button.disabled = false;
        if (!r.ok) { say.textContent = r.body.error || "The chalk broke. Try again."; return; }
        if (r.body.note) notes.insertBefore(line(r.body.note, true), notes.firstChild);
        form.reset();
        say.textContent = "It is on the wall.";
      })
      .catch(function () {
        button.disabled = false;
        say.textContent = "The wall could not be reached. Try again in a moment.";
      });
  });

  window.addEventListener("signwall", function () {
    if (wall.hidden) return;
    wall.scrollIntoView({ block: "start" });
    form.elements.name.focus({ preventScroll: true });
  });

  if (window.location.hash === "#keeper") {
    var box = document.createElement("form");
    box.className = "keeper";
    var field = document.createElement("input");
    field.type = "password";
    field.setAttribute("aria-label", "Keeper's key");
    field.placeholder = "Keeper's key";
    field.autocomplete = "off";
    var go = document.createElement("button");
    go.type = "submit";
    go.textContent = "Unlock";
    box.appendChild(field);
    box.appendChild(go);
    wall.insertBefore(box, notes);
    box.addEventListener("submit", function (e) {
      e.preventDefault();
      key = field.value.trim();
      field.value = "";
      load().then(function () { say.textContent = key ? "Wipe buttons are showing. A wrong key will be refused when you use one." : ""; }).catch(function () {});
    });
  }
})();
