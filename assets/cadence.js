/* Cadence (tools/cadence.html): syllables per line, against a tempo.
   Part one counts syllables: spelling rules, then a table of the common words
   the rules get wrong (assets/cadence-words.js), then anything the visitor has
   corrected by hand. Part two reads the lyrics, draws each line as a bar with
   one tick per syllable, flags the lines that stand out, and can play a line
   as clicks. Nothing leaves the browser and nothing is saved. */
(function () {
"use strict";

/* ---------- Counting ---------- */

/* Count syllables from spelling alone. Right for about 92 in 100 common words. */
function bySpelling(word) {
  var raw = word.toLowerCase().replace(/[^a-z']/g, "");
  var w = raw.replace(/'s$/, "").replace(/n't$/, "nt").replace(/'(ll|re|ve|d|m)$/, "").replace(/'/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  /* A y between two vowels starts a new syllable: play-ing, lay-er. */
  var groups = w.replace(/([aeiou])y(?=[aeiou])/g, "$1 ").match(/[aeiouy]+/g);
  var n = groups ? groups.length : 0;
  /* Endings that are written but not said. */
  if (/[^aeiouy]e$/.test(w) && !/[^aeiou]le$/.test(w)) n--;                          /* make, hope; not table */
  else if (/[^aeiouy]es$/.test(w) && !/(s|x|z|ch|sh|c|g)es$/.test(w) && !/[^aeiouy]les$/.test(w)) n--;   /* makes, hopes */
  else if (/[^aeiouytd]ed$/.test(w)) n--;                                            /* walked, burned; not wanted */
  else if (/[^aeiouy]e(ly|ful|less|ment|ness)$/.test(w)) n--;                        /* lonely, hopeful */
  /* Two vowels written together but said apart. */
  var apart = w.match(/ia(?!n$|l$|ge)|io(?!n|us)|iu|eo(?!us|n$)|ua(?!r|l$)|uo|ii|ya|oi(?=ng)|ei(?=ng)|ea(?=te$|tor|tion)|ie(?=t|st$|r$|nce|nt)|uou|oe(?=t|m)/g);
  if (apart) n += apart.length;
  if (/[^aeiou]sm$/.test(w)) n++;                                                    /* prism, chasm */
  if (/[^aeiouy]n't$/.test(raw)) n++;                                                /* didn't, couldn't */
  return Math.max(1, n);
}

var KNOWN = {};
function loadWords(table) {
  for (var count in table) {
    var words = table[count].split(" ");
    for (var i = 0; i < words.length; i++) KNOWN[words[i]] = parseInt(count, 10);
  }
}

/* Lowercase, straight apostrophes, and accents taken off so café is read as cafe. */
function plain(s) {
  s = s.toLowerCase().replace(/[‘’]/g, "'");
  return s.normalize ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : s;
}

/* A number the way it is usually said: 100 is one hundred, 1999 is nineteen ninety-nine,
   2005 is twenty oh five. Anything longer is read a digit at a time. */
var ONES = [2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 3, 1, 2, 2, 2, 2, 3, 2, 2];   /* zero to nineteen */
var TENS = [0, 0, 2, 2, 2, 2, 2, 3, 2, 2];                                 /* twenty to ninety */
function sayNumber(digits) {
  var n = parseInt(digits, 10), i, d = 0;
  function under100(v) { return v < 20 ? ONES[v] : TENS[Math.floor(v / 10)] + (v % 10 ? ONES[v % 10] : 0); }
  function under1000(v) { return v < 100 ? under100(v) : ONES[Math.floor(v / 100)] + 2 + (v % 100 ? under100(v % 100) : 0); }
  if (digits.length > 4 || (digits.length > 1 && digits[0] === "0")) {
    for (i = 0; i < digits.length; i++) d += ONES[+digits[i]];
    return d;
  }
  if (n < 1000) return under1000(n);
  if (n % 1000 === 0) return ONES[n / 1000] + 2;                           /* two thousand */
  if (n % 100 === 0) return under100(n / 100) + 2;                         /* nineteen hundred */
  if (n % 1000 < 10) return ONES[Math.floor(n / 1000)] + 2 + ONES[n % 10]; /* two thousand five */
  return under100(Math.floor(n / 100)) + (n % 100 < 10 ? 1 : 0) + under100(n % 100);
}

/* One written word, which may be hyphenated or a number. */
function countPart(part) {
  var p = plain(part).replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, "");
  if (!p) return 0;
  if (/^\d+$/.test(p)) return sayNumber(p);
  p = p.replace(/[^a-z']/g, "").replace(/^'+|'+$/g, "");
  if (!p) return 0;
  if (Object.prototype.hasOwnProperty.call(KNOWN, p)) return KNOWN[p];
  var bare = p.replace(/'s$/, "");       /* fire's counts as fire */
  if (bare !== p && Object.prototype.hasOwnProperty.call(KNOWN, bare)) return KNOWN[bare];
  var dropped = p.replace(/in'?$/, "ing");   /* runnin' counts as running */
  if (dropped !== p && /in'$/.test(p) && Object.prototype.hasOwnProperty.call(KNOWN, dropped)) return KNOWN[dropped];
  return bySpelling(p);
}
function keyOf(token) {
  return plain(token).replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, "");
}
function countToken(token, fixes) {
  var key = keyOf(token);
  if (!key) return 0;
  if (fixes && Object.prototype.hasOwnProperty.call(fixes, key)) return fixes[key];
  var parts = key.split(/[-–—\/]+/), n = 0;
  for (var i = 0; i < parts.length; i++) n += countPart(parts[i]);
  return n;
}

/* Lyrics into sections of lines of words. A blank line starts a new section. Anything in
   [square brackets] is never counted, wherever it appears. A line that is nothing but brackets,
   or a short label ending in a colon, names the section. */
function parse(text, opt) {
  var sections = [], cur = null, lines = text.replace(/\r/g, "").split("\n");
  function open(label) { cur = { label: label || "", lines: [] }; sections.push(cur); }
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) { cur = null; continue; }
    var label = null;
    if (/\[/.test(line) && !line.replace(/\[[^\]]*\]?/g, "").trim()) label = line.match(/\[([^\]]*)\]?/);
    else label = line.match(/^([A-Za-z][\w #-]{0,24}):$/);
    if (label) { open(label[1].trim()); continue; }
    if (!cur) open("");
    /* Put spaces around brackets so a tag pressed against a word, like [whispered]never, still splits. */
    var tokens = line.replace(/\[/g, " [").replace(/\]/g, "] ").trim().split(/\s+/), words = [], total = 0, inside = false, tagged = false;
    for (var t = 0; t < tokens.length; t++) {
      var tok = tokens[t];
      if (tok.indexOf("(") !== -1) inside = true;
      if (tok.indexOf("[") !== -1) tagged = true;
      var skipped = tagged || !!(opt && opt.skipParens && inside);
      var n = skipped ? 0 : countToken(tok, opt && opt.fixes);
      if (tok.indexOf(")") !== -1) inside = false;
      if (tok.indexOf("]") !== -1) tagged = false;
      words.push({ text: tok, key: keyOf(tok), n: n, skipped: skipped });
      total += n;
    }
    cur.lines.push({ words: words, n: total });
  }
  return sections.filter(function (s) { return s.lines.length; });
}

function median(a) {
  var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/* Rate and flags for every line. beats is how many beats one line is given. */
function measure(sections, bpm, beats, ceiling) {
  var seconds = beats * 60 / bpm, all = { lines: 0, syllables: 0, flagged: 0, fastest: null };
  sections.forEach(function (s) {
    var counts = s.lines.map(function (l) { return l.n; });
    s.usual = median(counts);
    s.lines.forEach(function (l) {
      l.rate = l.n / seconds;
      l.fast = l.rate > ceiling + 1e-9;
      var off = l.n - s.usual;
      l.odd = s.lines.length >= 3 && Math.abs(off) >= Math.max(3, s.usual * 0.3) ? off : 0;
      all.lines++; all.syllables += l.n;
      if (l.fast || l.odd) all.flagged++;
      if (!all.fastest || l.rate > all.fastest.rate) all.fastest = l;
    });
  });
  all.seconds = seconds;
  return all;
}

var ENGINE = { sayNumber: sayNumber, bySpelling: bySpelling, loadWords: loadWords, countToken: countToken, parse: parse, measure: measure, median: median };
if (typeof module !== "undefined" && module.exports) { module.exports = ENGINE; return; }
loadWords(window.CADENCE_WORDS || {});

/* Words that lyrics use and dictionaries mostly do not. */
loadWords({ 1: "y'all 'cause cause ain't 'em 'til til yeah yea ooh oh whoa nah yo uh huh ay aye hey mmm", 2: "gonna wanna gotta tryna finna imma i'ma lemme kinda outta sorta gimme oughta uh-huh uh-oh" });

/* ---------- Page ---------- */
var $ = function (id) { return document.getElementById(id); };
var EXAMPLE = [
  "[Verse]",
  "Woke up late with the porch light on",
  "Coffee gone cold and the morning half gone",
  "[quieter] Phone face down so the day can't call",
  "Every single thing I said I'd do is still up on the wall and I know it",
  "",
  "[Hook]",
  "Run it back, run it back (hey)",
  "Same four chords and a heart attack",
  "Run it back, run it back (hey)",
  "Louder now so the neighbors clap"
].join("\n");

var MAX_DRAWN = 300;                     /* a song is well under this; a pasted novel should not stall the page */
var fixes = {};                          /* words corrected by hand: key -> count. Kept until the page is reloaded. */
var editing = null;                      /* { key, s, l } of the word whose count is being changed */
var box = $("cd-text"), out = $("cd-lines");
box.value = EXAMPLE;

function settings() {
  var bpm = Math.min(260, Math.max(40, parseFloat($("cd-bpm").value) || 150));
  return { bpm: bpm, beats: parseInt($("cd-beats").value, 10) || 4, ceiling: parseFloat($("cd-ceiling").value) || 8, skipParens: $("cd-parens").checked };
}
function one(n) { return Math.round(n * 10) / 10; }
function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function render() {
  var s = settings();
  $("cd-bpm-out").textContent = s.bpm;
  $("cd-ceiling-out").textContent = s.ceiling;
  var sections = parse(box.value, { skipParens: s.skipParens, fixes: fixes });
  var all = measure(sections, s.bpm, s.beats, s.ceiling);
  out.innerHTML = "";

  if (!all.lines) {
    $("cd-sum").textContent = "Paste or type some lyrics above, one line per line.";
    return;
  }
  $("cd-sum").textContent = all.lines + (all.lines === 1 ? " line, " : " lines, ") + all.syllables + " syllables. At " + s.bpm + " beats a minute, " +
    s.beats + " beats is " + one(all.seconds) + " seconds a line. The fastest line asks for " + one(all.fastest.rate) + " syllables a second. " +
    (all.flagged ? all.flagged + (all.flagged === 1 ? " line stands out." : " lines stand out.") : "Nothing stands out.");

  var drawn = 0;
  sections.forEach(function (sec, si) {
    if (drawn >= MAX_DRAWN) return;
    var wrap = el("section", "sec");
    var head = el("h3", "", sec.label || "Section " + (si + 1));
    head.appendChild(el("span", "", " usually " + one(sec.usual) + " a line"));
    wrap.appendChild(head);
    var list = el("ol", "");
    sec.lines.forEach(function (line, li) {
      if (drawn >= MAX_DRAWN) return;
      drawn++;
      var item = el("li", "line" + (line.fast ? " fast" : "") + (line.odd ? " odd" : ""));
      item.appendChild(el("b", "n", String(line.n)));

      var words = el("p", "words");
      line.words.forEach(function (w) {
        if (!w.key) { words.appendChild(el("span", "punct", w.text)); words.appendChild(document.createTextNode(" ")); return; }
        var b = el("button", "w" + (w.skipped ? " skipped" : "") + (Object.prototype.hasOwnProperty.call(fixes, w.key) ? " fixed" : ""));
        b.type = "button";
        b.appendChild(el("span", "", w.text));
        b.appendChild(el("i", "", w.skipped ? "" : new Array(Math.min(w.n, 9) + 1).join("•")));
        b.setAttribute("aria-label", w.text + ", " + (w.skipped ? "not counted" : w.n + (w.n === 1 ? " syllable" : " syllables")) + ". Change the count.");
        b.addEventListener("click", function () {
          editing = editing && editing.key === w.key && editing.s === si && editing.l === li ? null : { key: w.key, s: si, l: li };
          render();
        });
        words.appendChild(b);
        words.appendChild(document.createTextNode(" "));
      });
      item.appendChild(words);

      /* The bar: beats as divisions, one tick per syllable, spread evenly. */
      var bar = el("div", "bar");
      bar.style.setProperty("--beats", s.beats);
      for (var t = 0; t < Math.min(line.n, 96); t++) {
        var tick = el("i", "");
        tick.style.left = ((t + 0.5) / Math.min(line.n, 96) * 100).toFixed(2) + "%";
        bar.appendChild(tick);
      }
      item.appendChild(bar);

      var meta = el("p", "meta");
      var play = el("button", "play", "Hear it");
      play.type = "button";
      play.addEventListener("click", function () { hear(line.n, s, bar); });
      meta.appendChild(play);
      var notes = [one(line.rate) + " a second"];
      if (line.fast) notes.push("faster than your limit of " + s.ceiling);
      if (line.odd) notes.push(Math.abs(line.odd) % 1 ? one(Math.abs(line.odd)) + (line.odd > 0 ? " more" : " fewer") + " than this section's usual"
        : Math.abs(line.odd) + (line.odd > 0 ? " more" : " fewer") + " than this section's usual " + one(sec.usual));
      meta.appendChild(el("span", "", notes.join(", ") + "."));
      item.appendChild(meta);

      if (editing && editing.s === si && editing.l === li) {
        var w = line.words.filter(function (x) { return x.key === editing.key; })[0];
        if (w) item.appendChild(editor(w));
      }
      list.appendChild(item);
    });
    wrap.appendChild(list);
    out.appendChild(wrap);
  });
  if (all.lines > drawn) out.appendChild(el("p", "more", "Showing the first " + drawn + " lines of " + all.lines + ". The totals above count all of them."));
}

function editor(w) {
  var row = el("p", "fix");
  var now = Object.prototype.hasOwnProperty.call(fixes, w.key) ? fixes[w.key] : countToken(w.text);
  row.appendChild(el("span", "", "“" + w.key + "” counts as "));
  var less = el("button", "", "−"), more = el("button", "", "+"), reset = el("button", "reset", "Use the rule");
  less.type = more.type = reset.type = "button";
  less.setAttribute("aria-label", "One fewer"); more.setAttribute("aria-label", "One more");
  less.disabled = now <= 0; more.disabled = now >= 12;
  less.addEventListener("click", function () { fixes[w.key] = now - 1; render(); });
  more.addEventListener("click", function () { fixes[w.key] = now + 1; render(); });
  reset.addEventListener("click", function () { delete fixes[w.key]; editing = null; render(); });
  row.appendChild(less); row.appendChild(el("b", "", String(now))); row.appendChild(more);
  row.appendChild(el("span", "", " everywhere it appears. "));
  if (Object.prototype.hasOwnProperty.call(fixes, w.key)) row.appendChild(reset);
  return row;
}

/* Play one line: a click on each beat, a softer tick on each syllable, evenly spaced. */
var audio = null;
function hear(n, s, bar) {
  var Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx || !n) return;
  try {
    audio = audio || new Ctx();
    if (audio.state === "suspended") audio.resume();
    var t0 = audio.currentTime + 0.08, len = s.beats * 60 / s.bpm;
    var blip = function (at, freq, gain, dur, type) {
      var o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(gain, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g); g.connect(audio.destination);
      o.start(at); o.stop(at + dur + 0.02);
    };
    for (var b = 0; b <= s.beats; b++) blip(t0 + b * 60 / s.bpm, b === 0 || b === s.beats ? 1320 : 990, 0.12, 0.05, "square");
    var ticks = Math.min(n, 64);         /* past this it is a buzz, and a very long line would stall the page */
    for (var i = 0; i < ticks; i++) blip(t0 + i * len / ticks, 300, 0.4, 0.06, "triangle");
    bar.classList.remove("playing");
    void bar.offsetWidth;                /* restart the sweep */
    bar.style.setProperty("--len", len.toFixed(3) + "s");
    bar.classList.add("playing");
    window.setTimeout(function () { bar.classList.remove("playing"); }, len * 1000 + 150);
  } catch (e) { /* no sound on this device; the page still works */ }
}

var timer = 0;
function soon() { window.clearTimeout(timer); timer = window.setTimeout(function () { editing = null; render(); }, 160); }
box.addEventListener("input", soon);
["cd-bpm", "cd-beats", "cd-ceiling", "cd-parens"].forEach(function (id) {
  $(id).addEventListener("input", render);
  $(id).addEventListener("change", render);
});
$("cd-clear").addEventListener("click", function () { box.value = ""; editing = null; render(); box.focus(); });
$("cd-example").addEventListener("click", function () { box.value = EXAMPLE; editing = null; render(); });
$("cd-form").addEventListener("submit", function (e) { e.preventDefault(); });
render();

})();
