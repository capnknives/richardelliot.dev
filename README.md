# richardelliot.dev

Richard Elliot's portfolio, served by GitHub Pages at https://richardelliot.dev.
Plain HTML, CSS and a little JavaScript: no framework, no libraries and no build step. Edit a
file, push to `main`, and it is live.

## What is where

| Path | What |
| --- | --- |
| `index.html` | Front page: the inside of the box (headline), the 3D corridor whose doors are links, the world bar (number, constants, jump), a band per project, hire me, the workshop, beliefs, working rules, the record, about. |
| `projects/*.html` | One landing page per project. |
| `assets/site.css` | All styling. The front page is dark (`html.box`); each project is a world with its own colour and mood, set by `data-room` on `<body>`, a `.band` or a `.door`. |
| `assets/box.js` | Worlds (the headline starts in superposition and collapses into a numbered world; the number sets that world's constants, which drive the corridor, heading weight and spacing, and a page overlay), the branch map, and the Plain view switch. Loaded on every page for Plain view. |
| `assets/prompt.js` | The command prompt (`look`, `examine`, `exits`, `go <name>`, `inventory`, `back`), the things to examine in each room, and the hidden way down. Docked at the bottom of every page; `/` focuses it. |
| `assets/bench.js` | The workshop on the front page: one line and three constants to change, eleven probes, two ways home. The "without the record" undo is a simulation. |
| `assets/backdrop.js` | One WebGL fragment shader with several modes: a backdrop per world, the starfield, and the 3D corridor, whose doors are portals onto the worlds. It also pins the door names to their doors and handles clicks on doors. Still frame under reduced motion; off in Plain view; without WebGL the doors become a plain row of links. |
| `cellar.html` | A hidden page, reached from the front-page prompt (`examine floor`, then `down`). Not linked or indexed. |
| `assets/fonts/` | Self-hosted typefaces (Sofia Sans, Sofia Sans Extra Condensed, Literata italic) and their licenses. |
| `404.html` | Not-found page. Uses absolute paths because it is served at any depth. |
| `CNAME` | The custom domain, `richardelliot.dev`. |

## Add a project

1. Copy one of the pages in `projects/` and change `data-room` on `<body>` to the new project's key.
2. In `assets/site.css`, add two colours for it under `:root` (a deep tone and a pale wash) and a
   `[data-room="key"]` line next to the existing four. Check the deep tone against the wash for
   contrast (4.5:1 or better).
3. In `index.html`, copy a `<section class="band">` for it and add a link to `.door-tags`, with
   `data-exit="key"` (the command bar reads those links). The corridor shows four worlds, two on
   each wall, repeating down its length. A fifth needs changes in `assets/backdrop.js`: the
   `world()` and `tintOf()` shader functions, the `mod(..., 4.)` that picks a door's world, and
   the label placement.
4. Add a link in the "Exits" list of the other project pages, also with `data-exit="key"`.
5. Optional: a moving backdrop (an entry in `ROOMS` in `assets/backdrop.js` and a matching branch
   in the shader), a `view-transition-name` pair in `assets/site.css`, and things to examine in
   `THINGS` in `assets/prompt.js`. Without these the room still works, on a flat colour.

## Keep true

The front page states facts that go stale: the stage of each project, the figures under
retractbench, the dated entries in "The record", and what "Hire me" offers. Update them when
things move. "What I believe" says the site has no trackers, cookies or framework: keep that
true, or change the sentence.

## Domain and HTTPS

The domain is registered at Name.com and points at GitHub Pages: four `A` records on the bare
domain and a `CNAME` for `www`. GitHub issues and renews the HTTPS certificate itself.

The Mortals and Monsters game site is separate: it lives in `capnknives/capnknives.github.io`
and is served at `riftforge.me`.

## Preview locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## After changing a stylesheet or script

Browsers keep `assets/site.css` and the scripts for a while. Each page links them with a version
tag (`site.css?v=7`). When you change one of those files, raise the number in every HTML file so
returning visitors get the new one:

```bash
grep -rl '?v=7' --include='*.html' . | xargs sed -i 's/?v=7/?v=8/g'
```
