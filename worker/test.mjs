/* node worker/test.mjs : the wall's rules, run against the real handler with a stand-in store.
   The stand-in waits a little on every read and write, like real storage, so the tests would
   catch two notes overwriting each other. */
import assert from "node:assert/strict";
import { handle, refuse, tidy, zeroBits, bitsFor, LIMITS, PUZZLE } from "./wall.js";

const pause = () => new Promise((r) => setTimeout(r, 2));
function freshWall(oldKV) {
  const data = new Map();
  const store = { get: async (k) => { await pause(); return data.get(k); }, put: async (k, v) => { await pause(); data.set(k, structuredClone(v)); } };
  let line = Promise.resolve();
  const exclusive = (fn) => { const run = line.then(fn); line = run.catch(() => {}); return run; };
  const kv = new Map(oldKV ? [["notes", JSON.stringify(oldKV)]] : []);
  const env = { ADMIN_KEY: "the-key", WALL: { get: async (k) => kv.get(k) ?? null } };
  const call = async (method, path, body, headers = {}) => {
    const init = { method, headers: { "content-type": "application/json", ...headers } };
    if (body !== undefined) { init.body = typeof body === "string" || body instanceof ReadableStream ? body : JSON.stringify(body); if (body instanceof ReadableStream) init.duplex = "half"; }
    const r = await handle(new Request("https://wall.test" + path, init), env, store, exclusive);
    return { status: r.status, body: await r.json() };
  };
  return { data, env, call };
}

/* What a visitor's browser does: ask for a puzzle, solve it, send the note with the answer. */
async function solve(seed, bits) {
  for (let n = 0; ; n++) if ((await zeroBits(seed + ":" + n)) >= bits) return String(n);
}
async function sign(w, name, note, extra = {}) {
  const c = (await w.call("GET", "/challenge")).body;
  return w.call("POST", "/notes", { name, note, seed: c.seed, nonce: await solve(c.seed, c.bits), ...extra });
}

/* ---------- the word rules ---------- */
for (const clean of ["Kilroy was here", "Hello from Texas", "Scunthorpe says hi", "I passed the class", "assassin's creed fan", "Found the trapdoor. Nice shelves.", "cocktail hour", "Dickens reader", "the grape harvest", "shiitake mushrooms", "Hancock", "5 stars @ the cellar", "Class of 2026", "pass it on", "as good as it gets", "José", "Zoë was here 🎉", "polka dot dress", "St. Louis", "e.g. this", "Fukuoka trip"]) assert.equal(refuse(clean), "", clean);
for (const foul of ["fuck this", "f u c k", "fuuuuck", "f.u.c.k", "sh1t", "$hit", "you b1tch", "a$$hole", "kys", "n1gg3r", "what a cunt", "FAGGOT", "heil hitler", "kill yourself", "a s s", "biiiitch",
  "nіgger", "сunt", "fսck you", "shіt", "phuck", "phuk you", "kill urself", "kill ur self", "𝐟𝐮𝐜𝐤"]) assert.notEqual(refuse(foul), "", foul);
for (const link of ["visit http://x.co", "www.spam.biz", "buy at cheap-pills.com", "me@mail.net", "find me @kilroy", "call 555 123 4567", "visit evil.app", "evil.tk now", "go to evil[.]com", "evil dot com", "evil (dot) net"]) assert.notEqual(refuse(link), "", link);
assert.equal(tidy("  a\u0000b  <b>c</b>\n d ", 99), "a b bc/b d");
assert.equal(tidy("x".repeat(50), 24).length, 24);
assert.equal(tidy(42, 24), "");

/* ---------- the puzzle ---------- */
assert.equal(bitsFor(0), PUZZLE.base);
assert.equal(bitsFor(PUZZLE.free), PUZZLE.base);
assert.equal(bitsFor(PUZZLE.free + 5), PUZZLE.base + 5);
assert.equal(bitsFor(1000), PUZZLE.max);

let w = freshWall();
let r = await w.call("GET", "/notes");
assert.deepEqual(r.body.notes, []);
r = await sign(w, "Kilroy", "was here");
assert.equal(r.status, 201);
const id = r.body.note.id;
assert.deepEqual(Object.keys(w.data.get("notes")[0]).sort(), ["id", "name", "note", "t"]);              /* nothing about the visitor is kept */
assert.equal((await sign(w, "Kilroy", "was here")).status, 409);
assert.equal((await w.call("POST", "/notes", { name: "No", note: "work" })).status, 400);              /* no puzzle, no note */

const c = (await w.call("GET", "/challenge")).body;
const nonce = await solve(c.seed, c.bits);
const [t, b, rnd, sig] = c.seed.split(".");
assert.equal((await w.call("POST", "/notes", { name: "Cheat", note: "", seed: [t, "1", rnd, sig].join("."), nonce: "0" })).status, 400);   /* an easier puzzle than was signed */
assert.equal((await w.call("POST", "/notes", { name: "Lazy", note: "", seed: c.seed, nonce: "x" })).status, 400);                         /* not solved */
assert.equal((await w.call("POST", "/notes", { name: "Once", note: "", seed: c.seed, nonce })).status, 201);
assert.equal((await w.call("POST", "/notes", { name: "Twice", note: "", seed: c.seed, nonce })).status, 409);                             /* a puzzle works once */

assert.equal((await sign(w, "", "x")).status, 400);
assert.equal((await sign(w, "Bob", "you are all sh1t")).status, 422);
assert.equal((await sign(w, "fuckface", "")).status, 422);
assert.equal((await sign(w, "Bob", "see www.spam.biz")).status, 422);
assert.equal((await w.call("POST", "/notes", "{not json")).status, 400);
assert.equal((await w.call("POST", "/notes", "[1]")).status, 400);
assert.equal((await w.call("POST", "/notes", { name: "Bot", note: "hi", website: "x" })).status, 200);
assert.ok(!w.data.get("notes").some((n) => n.name === "Bot"));                                          /* the hidden field: accepted, not kept */
r = await sign(w, "<script>alert(1)</script>", "x".repeat(500));
assert.equal(r.status, 201); assert.ok(!r.body.note.name.includes("<")); assert.equal(r.body.note.note.length, LIMITS.note);

/* A body over the limit is refused, even sent without a length. */
const big = new ReadableStream({ start(ctl) { ctl.enqueue(new TextEncoder().encode('{"name":"a","note":"' + "x".repeat(5000) + '"}')); ctl.close(); } });
assert.equal((await w.call("POST", "/notes", big)).status, 413);

/* ---------- deleting ---------- */
assert.equal((await w.call("DELETE", "/notes/" + id)).status, 401);
assert.equal((await w.call("DELETE", "/notes/" + id, undefined, { authorization: "Bearer wrong-key" })).status, 401);
assert.equal((await w.call("DELETE", "/notes/" + id, undefined, { authorization: "the-key" })).status, 401);                    /* the word Bearer is required */
assert.equal((await w.call("DELETE", "/notes/" + id, undefined, { authorization: "Bearer the-key" })).status, 200);
assert.equal((await w.call("DELETE", "/notes/" + id, undefined, { authorization: "Bearer the-key" })).status, 404);
assert.equal((await w.call("GET", "/elsewhere")).status, 404);

/* ---------- a busy wall ---------- */
/* Puzzles fetched while the wall was quiet stop working once it gets busy. */
w = freshWall();
const early = [];
for (let i = 0; i < 6; i++) { const ch = (await w.call("GET", "/challenge")).body; early.push({ ...ch, nonce: await solve(ch.seed, ch.bits) }); }
const results = [];
for (const [i, e] of early.entries()) results.push((await w.call("POST", "/notes", { name: "Early" + i, note: "", seed: e.seed, nonce: e.nonce })).status);
assert.deepEqual(results, [201, 201, 201, 201, 409, 409]);
assert.equal((await w.call("GET", "/challenge")).body.bits, PUZZLE.base + 1);

/* Many people signing at the same moment: every note that is accepted is kept. */
w = freshWall();
const batch = await Promise.all(Array.from({ length: 12 }, async (_, i) => {
  const ch = (await w.call("GET", "/challenge")).body;
  return w.call("POST", "/notes", { name: "Same" + i, note: "moment", seed: ch.seed, nonce: await solve(ch.seed, ch.bits) });
}));
const accepted = batch.filter((x) => x.status === 201).length;
assert.ok(accepted >= PUZZLE.free + 1);
assert.equal(w.data.get("notes").length, accepted);
assert.ok(batch.every((x) => x.status === 201 || (x.status === 409 && x.body.retry)));

/* A stale puzzle is turned away. */
w = freshWall();
const old = (await w.call("GET", "/challenge")).body;
const realNow = Date.now;
Date.now = () => realNow() + PUZZLE.life + 1000;
assert.equal((await w.call("POST", "/notes", { name: "Slow", note: "", seed: old.seed, nonce: await solve(old.seed, old.bits) })).status, 409);
Date.now = realNow;

/* Notes on the old KV wall are carried over the first time the new wall wakes up. */
w = freshWall([{ id: "abcdef12", name: "Old", note: "timer", t: Date.now() - 86400000 }]);
assert.equal((await w.call("GET", "/notes")).body.notes[0].name, "Old");
w.data.set("notes", "garbage");
assert.equal((await w.call("GET", "/notes")).status, 200);

/* Not set up: no key, no posting. */
w = freshWall(); delete w.env.ADMIN_KEY;
assert.equal((await w.call("GET", "/challenge")).status, 503);

console.log("wall: all checks passed");
