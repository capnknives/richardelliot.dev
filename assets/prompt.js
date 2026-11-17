/* The command prompt.
   The site is laid out like a text game: every page is a room, every link
   marked data-exit is a way out. This script reads those links from the page,
   so adding a project to the HTML adds it to the prompt with no change here.
   Rooms also hold a few things to examine, and the front page has a way down
   that is not listed until you find it.
   The prompt is docked at the bottom of every page, like the input line of a
   game client. Without JavaScript it is hidden and the links work as usual. */
(function () {
  "use strict";

  var box = document.querySelector("[data-prompt]");
  if (!box) return;

  var log = box.querySelector("[data-prompt-log]");
  var form = box.querySelector("form");
  var input = box.querySelector("input");
  var roomText = box.getAttribute("data-room-text") || "";
  var here = document.body.getAttribute("data-room") || "home";
  var KEEP = 6;

  /* Things to examine, by room. Several names can point at one thing. */
  var THINGS = {
    home: {
      "doors,door,rooms": "Doors to a lab, a writing room, a workshop and a study. The plan on the wall shows where each one is.",
      "plan,map,floor plan": "A floor plan, drawn in ink. A red dot marks where you are standing. Someone has drawn a small crossed square in the hall.",
      "workshop,workbench,bench,controls,probes": "A workbench with three controls and eleven probes. Change the page, then try both ways of taking it back.",
      "yard,pool": "Through the back door: a pool, and an equipment pad humming in the sun.",
      "road,rift": "Out the front, a road. Something gold flickers at the far end of it.",
      "floor,draught,draft,boards,square": "One board is not quite flush. A trapdoor. You could go down.",
      "trapdoor,hatch": "It lifts easily. Stairs lead down."
    },
    retractbench: {
      "probes,probe,grid": "Rows of probes, all at rest. Now and then a ripple runs through them and is taken back. Count them afterwards.",
      "bench,table,results": "A table of results. The undo that kept a record scores 100 out of 100. The one that did not scores 0 and 1."
    },
    storygecko: {
      "manuscript,pages,novella": "A novella, much corrected. It was the first thing StoryGecko ever read.",
      "bible,index,story bible": "Every character, place and loose thread, each with the page it came from. Nothing in it changed without the writer saying yes.",
      "gecko,scales": "It was here a moment ago."
    },
    aquainspection: {
      "pump,filter,heater,pad,equipment": "The nameplate is sun-faded, but the serial number still gives away the year it was made.",
      "phone": "It is listening. Say what you see.",
      "water,pool,light": "Light moves across the bottom of the pool. It never repeats."
    },
    riftforge: {
      "rift,crack,light": "A seam of gold in the dusk. Things come through. Some of them stay.",
      "road,roads,crossroads": "Every road leads to a town that keeps living while you are away.",
      "town,towns": "Ordinary American towns. Mostly."
    },
    cellar: {
      "shelves,shelf,jars": "Fonts in jars, shaders in a crate, and one benchmark, carefully labelled.",
      "stairs,trapdoor": "Light comes down from the front page. You can go up."
    }
  };

  var CARRYING = "You are carrying nothing. Richard is carrying Python, PyTorch, FastAPI, asyncio and one benchmark.";

  function remember(key) {
    try { window.sessionStorage.setItem(key, "1"); } catch (e) { /* storage is optional */ }
  }
  function recalls(key) {
    try { return window.sessionStorage.getItem(key) === "1"; } catch (e) { return false; }
  }

  function exits() {
    var seen = {};
    var list = [];
    var nodes = document.querySelectorAll("a[data-exit]");
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute("data-exit").toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      list.push({ key: key, href: nodes[i].href });
    }
    if (here === "home" && recalls("trapdoor")) {
      list.push({ key: "down", href: new URL("cellar.html", document.baseURI).href });
    }
    return list;
  }

  function names() {
    return exits().map(function (e) { return e.key; }).join(", ");
  }

  function say(command, reply) {
    var entry = document.createElement("span");
    entry.className = "entry";
    var said = document.createElement("span");
    said.className = "said";
    said.textContent = "> " + command + "\n";
    entry.appendChild(said);
    entry.appendChild(document.createTextNode(reply + "\n"));
    log.appendChild(entry);
    while (log.children.length > KEEP) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }

  function find(word) {
    var list = exits();
    var n = parseInt(word, 10);
    if (!isNaN(n) && String(n) === word && list[n - 1]) return list[n - 1];
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === word) return list[i];
    }
    /* Forgive short forms: "go story", "go aqua". */
    var hits = list.filter(function (e) { return word.length > 1 && e.key.indexOf(word) === 0; });
    return hits.length === 1 ? hits[0] : null;
  }

  function thing(word) {
    var things = THINGS[here] || {};
    for (var keys in things) {
      if (keys.split(",").indexOf(word) !== -1) return { keys: keys, text: things[keys] };
    }
    return null;
  }

  function go(raw, target) {
    if (here === "home" && /^(down|d|cellar|trapdoor|stairs)$/.test(target)) {
      if (!recalls("trapdoor")) {
        say(raw, "You cannot see a way down. Yet.");
        return;
      }
      target = "down";
    }
    var exit = find(target);
    if (exit) {
      say(raw, "Going to " + exit.key + ".");
      window.location.href = exit.href;
      return;
    }
    say(raw, "No exit called “" + target + "”. Exits: " + names() + ".");
  }

  function run(raw) {
    var line = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!line) return;

    var parts = line.split(" ");
    var verb = parts[0];
    var rest = parts.slice(1).join(" ").replace(/^(at|the|to) /, "").replace(/^the /, "");

    if (verb === "help" || verb === "?") {
      say(raw, "look       this page\nexamine X  look closer\nexits      where you can go\ngo X       go there\ninventory  what you carry\nback       front page\n\n/ jumps here. Esc clears.");
      return;
    }
    if ((verb === "look" || verb === "l") && !rest) {
      say(raw, roomText + "\nExits: " + names() + ".");
      return;
    }
    if (verb === "examine" || verb === "x" || verb === "look" || verb === "l" || verb === "inspect") {
      if (!rest) {
        say(raw, "Examine what?");
        return;
      }
      var t = thing(rest);
      if (!t) {
        say(raw, "You see nothing special about “" + rest + "”.");
        return;
      }
      if (here === "home" && /floor|trapdoor/.test(t.keys)) remember("trapdoor");
      say(raw, t.text);
      return;
    }
    if (verb === "exits" || verb === "ls") {
      say(raw, "Exits: " + names() + ".");
      return;
    }
    if (verb === "inventory" || verb === "i" || verb === "inv") {
      say(raw, CARRYING);
      return;
    }
    if (line === "xyzzy" || line === "plugh") {
      say(raw, "Nothing happens.");
      return;
    }
    if (verb === "back" || verb === "up" || verb === "u") {
      go(raw, "home");
      return;
    }
    if (verb === "down" || verb === "d") {
      go(raw, "down");
      return;
    }

    var target = verb === "go" || verb === "cd" || verb === "open" || verb === "enter" ? rest : line;
    if (!target) {
      say(raw, "Go where? Exits: " + names() + ".");
      return;
    }
    go(raw, target);
  }

  /* A clear button, shown only while there is something to clear. */
  var clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = "clear";
  clear.hidden = true;
  form.appendChild(clear);
  function wipe() {
    log.textContent = "";
    clear.hidden = true;
  }
  clear.addEventListener("click", function () {
    wipe();
    input.focus();
  });
  new MutationObserver(function () {
    clear.hidden = !log.children.length;
  }).observe(log, { childList: true });

  /* "/" jumps to the command bar from anywhere; Escape clears and leaves it. */
  document.addEventListener("keydown", function (event) {
    var el = document.activeElement;
    var typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      input.focus();
    } else if (event.key === "Escape" && el === input) {
      wipe();
      input.blur();
    }
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    run(input.value);
    input.value = "";
  });
})();
