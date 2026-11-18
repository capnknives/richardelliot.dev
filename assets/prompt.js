/* The command prompt.
   The site is laid out like a text game: every page is a room, every link
   marked data-exit is a way out ("show <kind>" lists the work by kind, from FILED below). This script reads those links from the page,
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
      "doors,door": "Doors down both walls, as far as you can see. Four are close enough to read. Walk on and the next ones come to you: there are more worlds here than the corridor shows at once.",
      "corridor,box,walls,dark": "The inside of the box. The corridor has no color of its own. It goes on further than it should.",
      "light,lamp": "It comes from behind the doors, and from a little overhead. The darkness has not overcome it.",
      "stars,sky,star": "They are different every time the box is opened. All but one. That one has not moved in any world you have seen.",
      "workbench,bench,workshop,laws,dials,probes": "A workbench with four dials and eleven probes. Change the laws, then try both ways of getting home.",
      "floor,draught,draft,boards": "One board is not quite flush. A trapdoor. You could go down.",
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
    cadence: {
      "sheet,lyrics,lyric sheet,stand,music stand": "Crossed out, rewritten, crossed out again. The fourth line of the verse has twice the words of the others.",
      "metronome,amp,click": "It does not care how many words you have. It gives you four beats and moves on.",
      "foam,wall,room": "Egg-crate foam, gone yellow. It has heard every take."
    },
    trace: {
      "relays,relay,rack,labels,label": "Eleven relays, each labeled in pencil with one question. A message trips the first one whose answer is yes. The ones after it never hear about it.",
      "cable,wire,wall": "Everything anyone says comes in on this one cable. Most of it never gets as far as the big machine.",
      "lamps,lamp,lights": "One is lit. That is the whole point of the room.",
      "breaker,handle,switch": "Red handle, worn smooth. It is allowed to say no to anything in here, including the machine."
    },
    wits: {
      "relays,relay,rack,labels,label": "Each relay is labeled in pencil with one question. A message trips the first one whose answer is yes. You can try it yourself: go trace.",
      "cable,wire": "Everything anyone says comes in on this one cable.",
      "machine,model,hum,next room": "It runs on one graphics card, in this house. It does not phone anyone without asking.",
      "list,review,plan,wall": "A list pinned to the wall, headed What is wrong with this. Five items. Underneath, in the same hand: fix in this order."
    },
    tools: {
      "doors,door,passage": "Five smaller doors. Nothing behind them is for sale. Each was built to answer one question.",
      "light,lights": "Each door leaks its own color. The pink one flickers when something is forgotten."
    },
    forgetme: {
      "wall,squares,weights,grid,field": "One square for every number the model is made of. Teach it something and watch where the light goes. It goes almost everywhere.",
      "ledger,record,book,stand": "Every weight, written down before anything was taught. It is the only way back that lands exactly.",
      "model,network": "Small enough to read in an afternoon. It knows ten people who do not exist."
    },
    poolbalance: {
      "wall,plaster,tile,tiles,scale,pits": "Plaster below, a band of tile at the waterline. Hungry water pits the one. Overfull water crusts the other.",
      "kit,test kit,vials,vial,reagents": "Five vials. Four of them take drops and turn a color. The fifth is a thermometer.",
      "water,pool,calcium": "It is never neutral about calcium. Move a reading and watch which way it leans."
    },
    feeder: {
      "tubs,tub,rack,racks,snake,snakes": "Rows of tubs, each with a strip of tape and a weight in grams. The third one flicks its tongue at you.",
      "scale,cup,deli cup,bench": "A kitchen scale and a deli cup with holes in the lid. Every feeding question starts here.",
      "freezer,feeders,mice,rats": "Bags sorted by size, smallest on top. The labels are in grams, because nobody agrees on what a small is."
    },
    riftforge: {
      "rift,crack,light": "A seam of gold in the dusk. Things come through. Some of them stay.",
      "road,roads,crossroads": "Every road leads to a town that keeps living while you are away.",
      "town,towns": "Ordinary American towns. Mostly."
    },
    words: {
      "words,wall,walls,quotes": "Each line is lit from behind. Some of them were said by people who never said them, and are true anyway.",
      "light,lights": "Four colors, the same four as the doors.",
      "door": "It leads back to the corridor. It may not be where you left it."
    },
    cellar: {
      "shelves,shelf,jars,jar": "One thing kept from each world upstairs: a vial, a relay, a shed tail, a sliver of light, an empty jar. A shader in a crate. And a single mustard seed in a jar of its own.",
      "wall,chalk,names,notes": "Names in chalk, left by people who found the way down. There is room for one more. You could sign it.",
      "crate,shader": "One program for every backdrop on the site. It is asked the same question for every pixel, every frame.",
      "bench,tape,snippets,languages,code": "One idea, written out six times in six languages. Keep what was there, and you can always put it back.",
      "tally,commands,list,marks": "A tally scratched into the beam: every command the box understands. Some of the marks are still blank.",
      "seed,mustard seed,mustard": "The smallest thing on the shelf.",
      "stairs,trapdoor": "Light comes down from the corridor. You can go up."
    }
  };

  var CARRYING = "You are carrying nothing. Richard is carrying Python, PyTorch, FastAPI, asyncio, one benchmark and a mustard seed.";

  /* "show ai": the work, filed by kind. On the front page, what does not match steps back. */
  var FILED = [
    { key: "retractbench", path: "projects/retractbench.html", name: "retractbench", kinds: "ai research" },
    { key: "storygecko", path: "projects/storygecko.html", name: "StoryGecko", kinds: "apps ai writing" },
    { key: "aquainspection", path: "projects/aquainspection.html", name: "Aquainspection", kinds: "apps ai" },
    { key: "riftforge", path: "projects/riftforge.html", name: "Riftforge", kinds: "games" },
    { key: "wits", path: "projects/wits.html", name: "WITS", kinds: "ai agents" },
    { key: "trace", path: "tools/trace.html", name: "Trace", kinds: "tools ai agents" },
    { key: "forgetme", path: "tools/forget-me.html", name: "Forget me", kinds: "tools ai research" },
    { key: "cadence", path: "tools/cadence.html", name: "Cadence", kinds: "tools writing" },
    { key: "poolbalance", path: "tools/pool-balance.html", name: "Pool balance", kinds: "tools" },
    { key: "feeder", path: "tools/feeder-match.html", name: "Feeder match", kinds: "tools" }
  ];
  var KIND_NAMES = "ai, apps, tools, research, agents, games, writing";
  var KIND_ALIASES = { app: "apps", tool: "tools", game: "games", agent: "agents", ml: "ai", saas: "apps", everything: "all", projects: "all" };

  function has(kinds, kind) {
    return (" " + kinds + " ").indexOf(" " + kind + " ") !== -1;
  }
  function dim(kind) {
    var nodes = document.querySelectorAll("[data-kind]");
    for (var i = 0; i < nodes.length; i++) {
      var off = kind !== "all" && !has(nodes[i].getAttribute("data-kind"), kind);
      if (off) nodes[i].classList.add("dim"); else nodes[i].classList.remove("dim");
    }
  }
  function show(raw, word) {
    var kind = KIND_ALIASES[word] || word;
    if (!kind) { say(raw, "Show what? Kinds: " + KIND_NAMES + ". Or show all."); return; }
    if (kind === "all") {
      dim("all");
      say(raw, "Everything: " + FILED.map(function (f) { return f.name; }).join(", ") + ".");
      return;
    }
    var hits = FILED.filter(function (f) { return has(f.kinds, kind); });
    if (!hits.length) { say(raw, "Nothing is filed under \u201c" + word + "\u201d. Kinds: " + KIND_NAMES + "."); return; }
    dim(kind);
    say(raw, kind + ": " + hits.map(function (f) { return f.name; }).join(", ") + "." +
      (here === "home" ? "\nThe rest has stepped back. show all brings it home." : "") +
      "\nType go and a name.");
  }

  /* Every command, by one name each, so the cellar can show which have been found.
     The first nine are in the help. The rest are for people who try things. */
  var LISTED = ["help", "look", "examine", "exits", "go", "show", "walk", "inventory", "back"];
  var HIDDEN = [
    ["down", /^(down|d)$/], ["jump", /^(jump|fork)$/], ["origin", /^origin$/], ["world", /^(world|constants|where|whereami)$/],
    ["score", /^(score|stats)$/], ["observe", /^(observe|measure)$/], ["who", /^who$/], ["north", /^(n|s|e|w|north|south|east|west)$/],
    ["say", /^say$/], ["hail", /^hail$/], ["consider", /^(consider|con)$/], ["camp", /^(camp|sit|rest)$/], ["dance", /^dance$/],
    ["sudo", /^sudo$/], ["forget", /^(rm|delete|forget)$/], ["mail", /^(mail|email|contact|write)$/], ["hello", /^(hello|hi|hey)$/],
    ["xyzzy", /^(xyzzy|plugh)$/], ["42", /^42$/], ["quit", /^(quit|exit|logout)$/], ["sign", /^sign$/]
  ];
  var ALSO = { "?": "help", l: "look", x: "examine", inspect: "examine", ls: "exits", cd: "go", open: "go", enter: "go",
    filter: "show", list: "show", forward: "walk", onward: "walk", advance: "walk", i: "inventory", inv: "inventory", up: "back", u: "back" };
  function found() {
    try { return (window.sessionStorage.getItem("cmds") || "").split(",").filter(Boolean); } catch (e) { return []; }
  }
  function note(verb, rest) {
    var name = LISTED.indexOf(verb) !== -1 ? verb : ALSO[verb];
    if (name === "look" && rest) name = "examine";
    if (!name) {
      for (var i = 0; i < HIDDEN.length; i++) if (HIDDEN[i][1].test(verb)) { name = HIDDEN[i][0]; break; }
    }
    if (!name) return;
    var have = found();
    if (have.indexOf(name) !== -1) return;
    have.push(name);
    try { window.sessionStorage.setItem("cmds", have.join(",")); } catch (e) { /* storage is optional */ }
    window.dispatchEvent(new CustomEvent("commandfound", { detail: name }));
  }
  window.REPrompt = { listed: LISTED, hidden: HIDDEN.map(function (h) { return h[0]; }), found: found };

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
    if (hits.length === 1) return hits[0];
    /* Not a way out of this room, but a place on the site: every project and tool can be reached from anywhere. */
    var squashed = word.replace(/[^a-z0-9]/g, "");
    var filed = FILED.filter(function (f) {
      return squashed.length > 1 && (f.key.indexOf(squashed) === 0 || f.name.toLowerCase().replace(/[^a-z0-9]/g, "").indexOf(squashed) === 0);
    });
    if (squashed === "sidedoors" || squashed === "side" || squashed === "passage") return { key: "tools", href: new URL("tools/", root()).href };
    return filed.length === 1 ? { key: filed[0].key, href: new URL(filed[0].path, root()).href } : null;
  }

  /* The top of the site, worked out from this page's link to the front page. */
  function root() {
    var home = document.querySelector('a[data-exit="home"]');
    return home ? new URL(".", home.href).href : new URL(".", document.baseURI).href;
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

    note(verb, rest);

    if (verb === "sign") {
      if (here !== "cellar") { say(raw, "There is nothing here to sign. People say there is a wall somewhere below."); return; }
      window.dispatchEvent(new CustomEvent("signwall"));
      say(raw, document.querySelector("[data-wall]:not([hidden])") ? "You pick up the chalk." : "The wall is bare, and there is no chalk yet.");
      return;
    }
    if (verb === "help" || verb === "?") {
      say(raw, "look       this page\nexamine X  look closer\nexits      where you can go\ngo X       go there\nshow X     ai, apps, tools, all\nwalk       down the corridor\ninventory  what you carry\nback       front page\n\n/ jumps here. Esc clears.\nThere are other commands. Try things.");
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
    if (verb === "walk" || verb === "forward" || verb === "onward" || verb === "advance") {
      if (here !== "home") { say(raw, "There is no corridor in here. Type back to return to it."); return; }
      var back = /^(back|backward|backwards)$/.test(rest);
      window.dispatchEvent(new CustomEvent("corridorwalk", { detail: { steps: back ? -1 : 1 } }));
      say(raw, back ? "You walk back the way you came." : "You walk on. Two doors fall behind you and two more come up out of the dark.");
      return;
    }
    if (verb === "show" || verb === "filter" || verb === "list") {
      show(raw, rest);
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

    /* ---- Not in the help. Found by people who try things. ---- */
    var box = window.RE && window.RE.info ? window.RE : null;
    if (verb === "jump" || line === "open box" || line === "open the box" || verb === "fork") {
      if (here !== "home" || !box) say(raw, "There is nowhere to jump from in here. Go back to the corridor first.");
      else { box.jump(); say(raw, "The corridor folds. You are somewhere else."); }
      return;
    }
    if (verb === "origin" || line === "go home" || line === "home world") {
      if (here !== "home" || !box) say(raw, "The origin is back through the corridor.");
      else { box.toOrigin(); say(raw, "World 0000. Everything is where it started."); }
      return;
    }
    if (verb === "world" && /^\d{1,4}$/.test(rest)) {
      if (here !== "home" || !box) say(raw, "You can only change worlds from the corridor.");
      else { box.goWorld(parseInt(rest, 10)); say(raw, "The corridor folds. " + box.info()); }
      return;
    }
    if (verb === "world" || verb === "constants" || verb === "where" || verb === "whereami") {
      say(raw, here === "home" && box ? box.info() : "You are inside one of the worlds. The corridor knows which.");
      return;
    }
    if (verb === "score" || verb === "stats") {
      say(raw, "Worlds visited this session: " + (box ? box.visited() : 1) + ". Trapdoor: " + (recalls("trapdoor") ? "found" : "not found") + ".");
      return;
    }
    if (verb === "observe" || verb === "measure") {
      say(raw, "You look closely. The world holds still for you.");
      return;
    }
    if (verb === "who") {
      say(raw, "You are alone in here. Probably.");
      return;
    }
    if (/^(n|s|e|w|north|south|east|west)$/.test(line)) {
      say(raw, "You walk for a while. The corridor brings you back to where you started.");
      return;
    }
    if (verb === "say" && rest) {
      say(raw, "You say, \u201c" + raw.trim().slice(4) + "\u201d. Nothing answers.");
      return;
    }
    if (verb === "hail") {
      say(raw, "Hail, traveler. The doors are that way.");
      return;
    }
    if ((verb === "consider" || verb === "con") && rest) {
      say(raw, "You size up the " + rest + ". It looks like an even fight.");
      return;
    }
    if (verb === "camp" || verb === "sit" || verb === "rest") {
      say(raw, "You sit down and wait. Old habits.");
      return;
    }
    if (verb === "dance") {
      say(raw, "You dance. In this world, nobody is watching.");
      return;
    }
    if (verb === "sudo") {
      say(raw, "Nice try.");
      return;
    }
    if (verb === "rm" || verb === "delete" || verb === "forget") {
      say(raw, "Gone. An undo that kept the record could bring it back. One that did not, could only get close.");
      return;
    }
    if (verb === "mail" || verb === "email" || verb === "contact" || verb === "write") {
      say(raw, "A brass mail slot in the wall. The plate reads hello@richardelliot.dev.");
      return;
    }
    if (verb === "hello" || verb === "hi" || verb === "hey") {
      say(raw, "Hello. Type help if you are lost.");
      return;
    }
    if (line === "42") {
      say(raw, "That is the answer. Nobody here remembers the question.");
      return;
    }
    if (verb === "quit" || verb === "exit" || verb === "logout") {
      say(raw, "The box has no outside. Try a door.");
      return;
    }
    if (verb === "back" || verb === "up" || verb === "u") {
      if (here === "home") { say(raw, "You are already in the corridor. Every way back leads here."); return; }
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
      input.value = "";
      input.blur();
    }
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    run(input.value);
    input.value = "";
  });
})();
