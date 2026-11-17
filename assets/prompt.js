/* The command prompt.
   The site is laid out like a text game: every page is a room, every link
   marked data-exit is a way out. This script reads those links from the page,
   so adding a project to the HTML adds it to the prompt with no change here.
   Without JavaScript the prompt is hidden and the links work as usual. */
(function () {
  "use strict";

  var box = document.querySelector("[data-prompt]");
  if (!box) return;

  var log = box.querySelector("[data-prompt-log]");
  var form = box.querySelector("form");
  var input = box.querySelector("input");
  var room = box.getAttribute("data-room-text") || "";

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
    return list;
  }

  function names() {
    return exits()
      .map(function (e) { return e.key; })
      .join(", ");
  }

  function say(command, reply) {
    log.textContent = "";
    var said = document.createElement("span");
    said.className = "said";
    said.textContent = "> " + command + "\n";
    log.appendChild(said);
    log.appendChild(document.createTextNode(reply));
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

  function run(raw) {
    var line = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!line) return;

    var parts = line.split(" ");
    var verb = parts[0];
    var rest = parts.slice(1).join(" ");

    if (verb === "help" || verb === "?") {
      say(raw, "look        describe this page\nexits       list where you can go\ngo <name>   go there (a name on its own works too)\nback        return to the front page");
      return;
    }
    if (verb === "look" || verb === "l") {
      say(raw, room + "\nExits: " + names() + ".");
      return;
    }
    if (verb === "exits" || verb === "ls") {
      say(raw, "Exits: " + names() + ".");
      return;
    }
    if (verb === "back") {
      rest = "home";
      verb = "go";
    }

    var target = verb === "go" || verb === "cd" || verb === "open" ? rest : line;
    if (!target) {
      say(raw, "Go where? Exits: " + names() + ".");
      return;
    }

    var exit = find(target);
    if (exit) {
      say(raw, "Going to " + exit.key + ".");
      window.location.href = exit.href;
      return;
    }
    say(raw, "No exit called “" + target + "”. Exits: " + names() + ".");
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    run(input.value);
    input.value = "";
  });
})();
