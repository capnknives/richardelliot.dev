# richardelliot.dev

Richard Elliot's portfolio, served by GitHub Pages at https://richardelliot.dev.
Plain HTML, CSS and a little JavaScript: no framework, no libraries and no build step. Edit a
file, push to `main`, and it is live.

## What is where

| Path | What |
| --- | --- |
| `index.html` | Front page: the inside of the box (headline), the 3D corridor whose doors are links, the world bar (number, constants, jump), a band per project, side doors (small tools), hire me, the workshop, beliefs, working rules, the record, about. |
| `projects/*.html` | One landing page per project. |
| `tools/*.html` | One page per small tool. Each is a door in the corridor and an entry under "Side doors". |
| `assets/cadence.css`, `assets/cadence.js`, `assets/cadence-words.js` | The Cadence tool (`tools/cadence.html`): a syllable counter for lyrics. `cadence.js` holds the spelling rules, the line-by-line reading and the click playback; `cadence-words.js` is a table of the common words the rules get wrong, derived from the CMU Pronouncing Dictionary (license in `assets/cadence-words.LICENSE.txt`). Loaded on that page only. The top half of `cadence.js` also runs in Node. |
| `assets/forget-me.css`, `assets/forget-me.js` | The Forget me tool (`tools/forget-me.html`): a small neural network and its training written out by hand, the weight field, and the two ways of taking a fact back. Loaded on that page only. The top half of the script also runs in Node (`require` it) for checking the numbers. |
| `assets/pool-balance.css`, `assets/pool-balance.js` | The pool water balance tool (`tools/pool-balance.html`): its layout, the water chemistry, the dosing plan and the drawn pool wall. Loaded on that page only. |
| `assets/site.css` | All styling. The front page is dark (`html.box`); each project is a world with its own color and mood, set by `data-room` on `<body>`, a `.band` or a `.door`. |
| `assets/box.js` | Worlds (the headline starts in superposition and collapses into a numbered world; the number sets that world's constants, which drive the corridor, heading weight and spacing, and a page overlay), the branch map, and the Plain view switch. Loaded on every page for Plain view. |
| `assets/prompt.js` | The command prompt (`look`, `examine`, `exits`, `go <name>`, `walk`, `inventory`, `back`), the things to examine in each room, the hidden way down, and a set of commands that are not in the help. Docked at the bottom of every page; `/` focuses it. |
| `assets/bench.js` | The workshop on the front page: one line and three constants to change, eleven probes, two ways home. The "without the record" undo is a simulation. |
| `assets/backdrop.js` | One WebGL fragment shader with several modes: a backdrop per world, the starfield, and the 3D corridor, whose doors are portals onto the worlds. The corridor holds one door per link in `.door-tags` (up to eight), names the nearest four, and lets you walk on to bring the next ones close. It also pins the door names to their doors and handles clicks on doors. Still frame under reduced motion; off in Plain view; without WebGL the doors become a plain row of links. |
| `words.html` | The gallery: every quote, reached through the extra door that appears in about one world in six. The same list lives in `QUOTES` in `assets/box.js`, which shows one per world on the front page; change both together. Not linked from the navigation. |
| `cellar.html` | A hidden page, reached from the front-page prompt (`examine floor`, then `down`). Not linked or indexed. |
| `assets/fonts/` | Self-hosted typefaces (Sofia Sans, Sofia Sans Extra Condensed, Literata italic) and their licenses. |
| `404.html` | Not-found page. Uses absolute paths because it is served at any depth. |
| `CNAME` | The custom domain, `richardelliot.dev`. |

## Add a project

1. Copy one of the pages in `projects/` and change `data-room` on `<body>` to the new project's key.
2. In `assets/site.css`, add two colors for it under `:root` (a deep tone and a pale wash) and a
   `[data-room="key"]` line next to the existing four. Check the deep tone against the wash for
   contrast (4.5:1 or better).
3. In `index.html`, copy a `<section class="band">` for it and add a link to `.door-tags`, with
   `data-exit="key"` (the command bar reads those links). The corridor picks up the new link by
   itself: doors go two to a stretch of wall in the order of the links, the nearest four are
   named, and walking on brings up the rest, up to eight links. What is seen through the new door
   is the next number in the `world()` and `tintOf()` shader functions in `assets/backdrop.js`
   (0 to 6 are taken, 9 is the hidden door). Without a branch there it shows the hidden door's sky.
4. Add a link in the "Exits" list of the other project pages, also with `data-exit="key"`.
5. Optional: a moving backdrop (an entry in `ROOMS` in `assets/backdrop.js` and a matching branch
   in the shader), a `view-transition-name` pair in `assets/site.css`, and things to examine in
   `THINGS` in `assets/prompt.js`. Without these the room still works, on a flat color.

## Add a small tool

Same steps as a project, with these differences: the page goes in `tools/`, its own styles and
script go in `assets/<name>.css` and `assets/<name>.js` (scope the styles under one class on
`<main>`, as `.pool` does), and on the front page it gets an item in the "Side doors" list
instead of a band. `tools/pool-balance.html` is the one to copy.

## Keep true

The front page states facts that go stale: the stage of each project, the figures under
retractbench, the dated entries in "The record", and what "Hire me" offers. Update them when
things move. "What I believe" says the site has no trackers, cookies or framework: keep that
true, or change the sentence. The pool water balance and Forget me pages say they send nothing
anywhere: keep that true too. Forget me also states its own numbers (1,560 weights, thirty facts,
ten people) in its text: if the model in `assets/forget-me.js` changes, change the sentences.
Cadence states how well its rules scored (92 in 100, about 2,400 exceptions): if the rules in
`assets/cadence.js` change, rebuild `assets/cadence-words.js` and update those figures. The
corridor has room for eight doors and seven are in use.

## Domain and HTTPS

The domain is registered at Name.com and points at GitHub Pages: four `A` records on the bare
domain and a `CNAME` for `www`. GitHub issues and renews the HTTPS certificate itself.

The Mortals and Monsters game site is separate: it lives in `capnknives/capnknives.github.io`
and its player site is served by the game server at `play.riftforge.me`.
The bare `riftforge.me` address is set as that repository's Pages domain but does not currently
resolve to GitHub Pages, so it shows a browser error.

## Preview locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## After changing a stylesheet or script

Browsers keep `assets/site.css` and the scripts for a while. Each page links them with a version
tag (`site.css?v=13`). When you change one of those files, raise the number in every HTML file so
returning visitors get the new one:

```bash
grep -rl '?v=13' --include='*.html' . | xargs sed -i 's/?v=13/?v=14/g'
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
