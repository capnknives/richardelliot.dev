# richardelliot.dev

Richard Elliot's portfolio, served by GitHub Pages at https://richardelliot.dev.
Plain HTML, CSS and a little JavaScript: no framework and no build step. Edit a
file, push to `main`, and it is live.

## What is where

| Path | What |
| --- | --- |
| `index.html` | Front page: introduction, project list, about. |
| `projects/*.html` | One landing page per project. |
| `assets/site.css` | All styling. Each project has a colour, set by `data-room`. |
| `assets/prompt.js` | The command prompt (`look`, `exits`, `go <name>`, `back`). |
| `assets/fonts/` | Self-hosted typefaces (Bricolage Grotesque, Literata) and their licenses. |
| `404.html` | Not-found page. Uses absolute paths because it is served at any depth. |
| `CNAME` | The custom domain, `richardelliot.dev`. |

## Add a project

1. Copy one of the pages in `projects/` and change `data-room` on `<body>` to the new project's key.
2. In `assets/site.css`, add two colours for it under `:root` (a deep tone and a pale wash) and a
   `[data-room="key"]` line next to the existing four. Check the deep tone against the wash for
   contrast (4.5:1 or better).
3. Add a row to the list in `index.html`, and a link in the "Exits" list of the other project pages.
   Give each link `data-exit="key"`. The command prompt reads those links, so it needs no change.

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
