# richardelliot.dev

Richard Elliot's portfolio, served by GitHub Pages at https://richardelliot.dev.
Plain HTML, CSS and a little JavaScript: no framework, no libraries and no build step. Edit a
file, push to `main`, and it is live.

## What is where

| Path | What |
| --- | --- |
| `index.html` | Front page: the inside of the box (headline), the 3D corridor whose doors are links, the world bar (number, constants, jump), a band per project, side doors (small tools), hire me, the workshop, beliefs, working rules, the record, about. |
| `projects/*.html` | One page per project: retractbench, StoryGecko, Aquainspection, Riftforge, WITS. StoryGecko and WITS are full case studies (where it came from, how work moves through it, decisions and what they cost, what testing or review found). Their facts come from each project's own repository (build log, roadmap, README): recheck them there before changing a number. No screenshots of the private apps. |
| `tools/index.html` | Side doors: the room that lists the small tools. It has one door in the corridor; the tools themselves no longer have doors there. |
| `tools/*.html` | One page per small tool, listed in `tools/index.html` and named in the short "Side doors" section of the front page. |
| `assets/cadence.css`, `assets/cadence.js`, `assets/cadence-words.js` | The Cadence tool (`tools/cadence.html`): a syllable counter for lyrics. `cadence.js` holds the spelling rules, the line-by-line reading and the click playback (anything in square brackets is never counted, and the page's instructions say so); `cadence-words.js` is a table of the common words the rules get wrong, derived from the CMU Pronouncing Dictionary (license in `assets/cadence-words.LICENSE.txt`). Loaded on that page only. The top half of `cadence.js` also runs in Node. |
| `assets/trace.css`, `assets/trace.js` | The Trace tool (`tools/trace.html`): one message followed through the router of WITS (`capnknives/WitsV3`). `trace.js` ports the ordered checks of `classify_message()` in `agents/routing_classifier.py`, the tool gates of `agents/orchestrator_preflight.py`, the injection patterns and the PII patterns, with shortened phrase lists; it then draws the path. No model runs: where WITS would call one, the page says so and counts it. Loaded on that page only. The top half of `trace.js` also runs in Node. |
| `assets/forget-me.css`, `assets/forget-me.js` | The Forget me tool (`tools/forget-me.html`): a small neural network and its training written out by hand, the weight field, and the two ways of taking a fact back. Loaded on that page only. The top half of the script also runs in Node (`require` it) for checking the numbers. |
| `assets/knobs.css`, `assets/knobs.js` | The Knobs tool (`tools/knobs.html`): how an AI model is made, trained and used, in six stops, with one small language model (1,992 weights, trained on a 46-sentence reading) that runs in the page. Words to numbers, a random model, training, writing a word at a time, wiping weights to look for a fact, and the step up to a chatbot. Three wordings (plain, curious, technical) are picked at the top and kept in the address as `#plain`, `#curious` or `#technical`; each stop has one paragraph per wording, marked `data-lv`. Loaded on that page only. The top half of the script also runs in Node (`require` it) for checking the numbers. |
| `assets/feeder-match.css`, `assets/feeder-match.js` | The Feeder match tool (`tools/feeder-match.html`): a snake species and weight in, a feeder size, a schedule and a 30-day count out. `FEEDERS` (the size names and gram ranges) is a placeholder taken from one supplier's chart, to be replaced by the breeder's own; `SPECIES` holds the tapering share-of-body-weight curves, the hognose weight ladder and the schedules, for five species (corn snake, Florida kingsnake, Pueblan milk snake, Texas rat snake, western hognose). `ORDER` drives the request form under the ticket: today it only writes a message the buyer copies; setting `contactName`, `sms` or `prices` there adds a greeting, a "Text this request" link and an estimated total. Loaded on that page only. The top half of the script also runs in Node. |
| `assets/pool-balance.css`, `assets/pool-balance.js` | The pool water balance tool (`tools/pool-balance.html`): its layout, the water chemistry, the dosing plan and the drawn pool wall. Loaded on that page only. |
| `assets/site.css` | All styling. The front page is dark (`html.box`); each project is a world with its own color and mood, set by `data-room` on `<body>`, a `.band` or a `.door`. |
| `assets/box.js` | Worlds (the headline starts in superposition and collapses into a numbered world; the number sets that world's constants, which drive the corridor, heading weight and spacing, and a page overlay), the branch map, and the Plain view switch. Loaded on every page for Plain view. |
| `assets/prompt.js` | The command prompt (`look`, `examine`, `exits`, `go <name>`, `show <kind>`, `walk`, `inventory`, `back`), the things to examine in each room, the hidden way down, and a set of commands that are not in the help. Docked at the bottom of every page; `/` focuses it. |
| `assets/bench.js` | The workshop on the front page: one line and three constants to change, eleven probes, two ways home. The "without the record" undo is a simulation. |
| `assets/backdrop.js` | One WebGL fragment shader with several modes: a backdrop per world, the starfield, and the 3D corridor, whose doors are portals onto the worlds. The corridor holds one door per link in `.door-tags` (up to eight), names the nearest four, and lets you walk on to bring the next ones close. It also pins the door names to their doors and handles clicks on doors. Still frame under reduced motion; off in Plain view; without WebGL the doors become a plain row of links. |
| `words.html` | The gallery: every quote, reached through the extra door that appears in about one world in six. The same list lives in `QUOTES` in `assets/box.js`, which shows one per world on the front page; change both together. Not linked from the navigation. |
| `cellar.html`, `assets/cellar.css`, `assets/cellar.js` | The cellar: a hidden page, reached from the front-page prompt (`examine floor`, then `down`). Not linked or indexed. Shelves of jars (one keepsake from each project and tool, the shader, the mustard seed), one idea written in six languages (each sample was run before it went on the page, except the PowerShell and GLSL ones: rerun them if you change them), a tally of every prompt command that fills in as a visitor finds the hidden ones (kept in `sessionStorage`, gone when the tab closes), and the wall. |
| `worker/`, `.github/workflows/wall.yml` | The cellar wall: a small Cloudflare Worker (`worker/wall.js`) that keeps the names and notes visitors leave, in one KV entry. It stores an id, the name, the note and the time, and nothing about the visitor. `node worker/test.mjs` runs its rules. See "The wall" below. |
| `assets/fonts/` | Self-hosted typefaces (Sofia Sans, Sofia Sans Extra Condensed, Literata italic) and their licenses. |
| `404.html` | Not-found page. Uses absolute paths because it is served at any depth. |
| `CNAME` | The custom domain, `richardelliot.dev`. |
| `assets/card.png`, `assets/touch-icon.png` | The 1200x630 picture that link previews show (every page's `og:image`), and the icon a phone uses when the site is added to a home screen. |
| `sitemap.xml`, `robots.txt` | The pages search engines should index. Add a line to `sitemap.xml` for each new page; `words.html`, `cellar.html` and `404.html` stay out. |

## Add a project

1. Copy one of the pages in `projects/` and change `data-room` on `<body>` to the new project's key.
2. In `assets/site.css`, add two colors for it under `:root` (a deep tone and a pale wash) and a
   `[data-room="key"]` line next to the existing four. Check the deep tone against the wash for
   contrast (4.5:1 or better).
3. In `index.html`, copy a `<section class="band">` for it and add a link to `.door-tags`, with
   `data-exit="key"` (the command bar reads those links), `data-kind` (the kinds `show` filters by) and
   `data-world` (which `world()` branch is seen through the door). The corridor picks up the new link by
   itself: doors go two to a stretch of wall in the order of the links, the nearest four are
   named, and walking on brings up the rest, up to eight links. What is seen through the new door
   is the `world()` and `tintOf()` branch its `data-world` names, in `assets/backdrop.js`
   (0 to 7 exist: 4 to 7 were drawn for the tools, WITS uses 7 and Side doors uses 5; 9 is the hidden door). Without a branch there it shows the hidden door's sky.
4. Add a link in the "Exits" list of the other project pages, also with `data-exit="key"`.
5. Optional: a moving backdrop (an entry in `ROOMS` in `assets/backdrop.js` and a matching branch
   in the shader), a `view-transition-name` pair in `assets/site.css`, and things to examine in
   `THINGS` in `assets/prompt.js`. Without these the room still works, on a flat color.

## Add a small tool

A tool does not get a corridor door or a band. The page goes in `tools/`, it gets a section in
`tools/index.html`, a name in the front page's "Side doors" sentence, a line in the exits list of
the other tool pages, and an entry in `FILED` in `assets/prompt.js` (so `show` and `go` find it
from any page). Otherwise the same as a project: its own styles and
script go in `assets/<name>.css` and `assets/<name>.js` (scope the styles under one class on
`<main>`, as `.pool` does). `tools/pool-balance.html` is the one to copy.

## The wall

The wall in the cellar is hidden until it has a server to talk to.

1. In the repository's settings, add three Actions secrets: `CLOUDFLARE_API_TOKEN` (create it in
   Cloudflare with the "Edit Cloudflare Workers" template), `CLOUDFLARE_ACCOUNT_ID`, and
   `WALL_ADMIN_KEY` (any long random string; keep a copy, it is the key that removes notes).
2. Run the "Cellar wall" workflow (Actions tab, "Run workflow"). It tests the rules, finds or
   creates the KV namespace, and deploys. The log ends with the Worker's address
   (`https://cellar-wall.<your-subdomain>.workers.dev`).
3. Put that address in `<meta name="wall-endpoint" content="">` in `cellar.html` and push.

What is refused: links, addresses, phone numbers, and the words in `WHOLE` and `STEMS` at the
top of `worker/wall.js` (edit the lists there; `worker/test.mjs` has the cases that must stay
clean, such as Scunthorpe). The wall holds the newest 200 notes and takes at most 20 an hour in
total. That limit is for the whole wall because nothing about a visitor is kept to count by.

To remove a note: open `cellar.html#keeper`, type the admin key, and press "wipe" beside it.
The key stays in that page's memory and is sent only with a wipe.

## Keep true

The front page states facts that go stale: the stage of each project, the figures under
retractbench, the dated entries in "The record", and what "Hire me" offers. Update them when
things move. "What I believe" says the site has no trackers, cookies or framework: keep that
true, or change the sentence. The wall in the cellar says it keeps a name, a note and the day and
nothing else: keep `worker/wall.js` to that, or change the sentence in `cellar.html`. The pool page takes dissolved solids from the pool type (1,000 ppm for chlorine, 3,200 for
salt, `SOLIDS` in `assets/pool-balance.js`) unless a reading is typed in. The pool water balance and Forget me pages say they send nothing
anywhere: keep that true too. Forget me also states its own numbers (1,560 weights, thirty facts,
ten people) in its text: if the model in `assets/forget-me.js` changes, change the sentences.
Knobs states its own numbers in its text (1,992 weights, 46 sentences, a 46-word vocabulary, 434
drills of which 298 is the most any guesser can match, 300 passes, 8 and 24 for the layer sizes):
if the model or the reading in `assets/knobs.js` changes, change the sentences in all three
wordings. It also cites three outside sources and one model's size (Llama 3.1, 405 billion, 81
million pages at 5,000 a page): check the links still open. It says it sends nothing anywhere:
keep that true.
Cadence states how well its rules scored (92 in 100, about 2,400 exceptions): if the rules in
`assets/cadence.js` change, rebuild `assets/cadence-words.js` and update those figures. The
corridor has room for eight doors and all eight are in use: a ninth link needs the limit raised in
`assets/backdrop.js` (the `uPerm[8]` uniform, the loop over it and `tags.slice(0, 8)`), or it will
not get a door. Trace says its checks, reasons, gates and block messages are the ones in WITS: if
the router in `capnknives/WitsV3` changes order or wording, change `assets/trace.js` to match, or
change the sentences under "What is real here" on the page.

## Contact

The front page gives `hello@richardelliot.dev` under "Hire me" and "About", and the prompt answers
`mail`. The address is a Name.com forward to a personal inbox, so there is no mailbox to check:
if the forward is ever removed, take the address off the page.

## Domain and HTTPS

The domain is registered at Name.com and points at GitHub Pages: four `A` records on the bare
domain and a `CNAME` for `www`. GitHub issues and renews the HTTPS certificate itself.

The Mortals and Monsters game site is separate: it lives in `capnknives/capnknives.github.io`
and its player site is served by the game server at `play.riftforge.me`.
The bare `riftforge.me` address is set as that repository's Pages domain but does not currently
resolve to GitHub Pages, so it shows a browser error.

## Check before shipping

The chemistry, the model, the syllable counter and the router each run in Node or in a plain
function, so they can be swept without a browser. The checks that have caught real bugs:

- Pool balance: run `plan()` over a grid of readings and require that every dose is positive
  and finite, that pH, alkalinity, calcium and stabilizer all end in range, that no plan drains
  calcium out and then adds it back, and that every pool between 50 and 90°F ends balanced
  (it does, for chlorine and salt, across 12,600 combinations; near freezing the ranges cannot
  balance water and the page says "still hungry"). Raising pH is always a soda ash dose. When
  that dose carries alkalinity over range, acid follows later, in rounds, with a return visit.
  Aeration is only ever extra advice inside a chemical step. A pH up to 8.0 is left alone,
  with a note, when the water balances without acid (`PH_LEAVE`); above 8.0, or when the water
  would scale, it is brought down. The index is the pool trade's sum
  (pH + temperature, calcium and alkalinity factors, minus the dissolved-solids constant from
  the ANSI/APSP table): the two worked examples in the CPO handbook, -0.5 and +0.4, must come
  out as -0.52 and +0.42.
- Feeder match: `require` the script and run `match()` for every species, sex, shape and feeder type at every weight from 1 to 3,000 g. Every answer must name a size, no meal may pass 25% of body weight except the smallest pinky for a hatchling, a size must never go down as weight goes up, and a hognose or a milk snake is never offered a rat.
- Knobs: `require` the script, make models from many seeds (`newModel(seed)`) and run `pass()`
  300 times on each. Every one should end with `right()` at 298 of 434, and an untrained one near
  zero. Write a few hundred sentences with `write()`: most should not be in the reading, and none
  may run past 16 words. Type a word the model has never seen at stop 1: it must show a question
  mark, not break.
- Cadence: a line of one very long word, and a paste of a few thousand lines. Words must wrap
  and the page draws only the first 300 lines.
- Trace: strings of 2,000 digits (some patterns are slow on long input, which is why input is
  capped), and `read ../../x.txt`, which must stop at the read-roots gate.
- The workshop on the front page under reduced motion: the probes read computed styles the
  instant they change, so the line they read must have no transition.
- Every page at 320px with one unbroken 5,000-character word typed into any text box.
- Every page with JavaScript off: tool pages show their explanation and hide the controls.

## Preview locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## After changing a stylesheet or script

Browsers keep `assets/site.css` and the scripts for a while. Each page links them with a version
tag (`site.css?v=17`). When you change one of those files, raise the number in every HTML file so
returning visitors get the new one:

```bash
grep -rl '?v=17' --include='*.html' . | xargs sed -i 's/?v=17/?v=18/g'
```

## Screen sizes

There is no separate mobile site. Sizes are fluid (`clamp()` with viewport units), the layout
drops to one column at 46rem and 60rem, and the root font size grows on monitors wider than about
1450px so the whole site scales up. Checked without sideways scrolling at 320, 360, 390 and 430px
(phones), 844x390 (phone on its side), 768 and 1024px (tablets), 1366px (laptop) and 1920px.

Very wide windows, including a browser zoomed far out, are handled by three limits in
`assets/site.css`: `--gutter` grows so the content stays in a centered column of about 112rem,
the corridor stops at 46rem tall and 112rem wide, and the front-page headline is sized by the
window's height as well as its width so it never fills the screen. Checked at 1900x930 and at
5700x2790, which is what a 1900px window reports at 33% zoom.
