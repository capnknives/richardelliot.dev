/* node worker/test.mjs : the wall's rules, run against the real handler with a stand-in store. */
import assert from "node:assert/strict";
import wall, { refuse, tidy, LIMITS } from "./wall.js";

const store = new Map();
const env = { WALL: { get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); } }, ADMIN_KEY: "the-key" };
const call = async (method, path, body, headers = {}) => {
  const r = await wall.fetch(new Request("https://wall.test" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : (typeof body === "string" ? body : JSON.stringify(body)) }), env);
  return { status: r.status, body: r.status === 204 ? null : await r.json(), headers: r.headers };
};

for (const clean of ["Kilroy was here", "Hello from Texas", "Scunthorpe says hi", "I passed the class", "assassin's creed fan", "Found the trapdoor. Nice shelves.", "cocktail hour", "Dickens reader", "the grape harvest", "shiitake mushrooms", "Hancock", "5 stars @ the cellar", "Class of 2026", "pass it on", "as good as it gets"]) assert.equal(refuse(clean), "", clean);
for (const foul of ["fuck this", "f u c k", "fuuuuck", "f.u.c.k", "sh1t", "$hit", "you b1tch", "a$$hole", "kys", "n1gg3r", "what a cunt", "FAGGOT", "heil hitler", "kill yourself", "a s s", "biiiitch"]) assert.notEqual(refuse(foul), "", foul);
for (const link of ["visit http://x.co", "www.spam.biz", "buy at cheap-pills.com", "me@mail.net", "find me @kilroy", "call 555 123 4567"]) assert.notEqual(refuse(link), "", link);
assert.equal(tidy("  a\u0000b  <b>c</b>\n d ", 99), "a b bc/b d");
assert.equal(tidy("x".repeat(50), 24).length, 24);
assert.equal(tidy(42, 24), "");

let r = await call("GET", "/notes");
assert.deepEqual(r.body.notes, []);
assert.equal(r.headers.get("access-control-allow-origin"), "https://richardelliot.dev");
r = await call("POST", "/notes", { name: "Kilroy", note: "was here" });
assert.equal(r.status, 201);
const id = r.body.note.id;
assert.deepEqual(Object.keys(JSON.parse(store.get("notes"))[0]).sort(), ["id", "name", "note", "t"]);   /* nothing else is kept */
assert.equal((await call("POST", "/notes", { name: "Kilroy", note: "was here" })).status, 409);
assert.equal((await call("POST", "/notes", { name: "", note: "x" })).status, 400);
assert.equal((await call("POST", "/notes", { name: "Bob", note: "you are all sh1t" })).status, 422);
assert.equal((await call("POST", "/notes", { name: "fuckface", note: "" })).status, 422);
assert.equal((await call("POST", "/notes", { name: "Bob", note: "see www.spam.biz" })).status, 422);
assert.equal((await call("POST", "/notes", "{not json")).status, 400);
assert.equal((await call("POST", "/notes", "[1]")).status, 400);
r = await call("POST", "/notes", { name: "Bot", note: "hi", website: "x" });
assert.equal(r.status, 200); assert.equal(JSON.parse(store.get("notes")).length, 1);                     /* the hidden field: accepted, not kept */
r = await call("POST", "/notes", { name: "<script>alert(1)</script>", note: "x".repeat(500) });
assert.equal(r.status, 201); assert.ok(!r.body.note.name.includes("<")); assert.equal(r.body.note.note.length, LIMITS.note);
assert.equal((await call("GET", "/notes")).body.notes[1].day.length, 10);
assert.equal((await call("DELETE", "/notes/" + id)).status, 401);
assert.equal((await call("DELETE", "/notes/" + id, undefined, { authorization: "Bearer wrong-key" })).status, 401);
assert.equal((await call("DELETE", "/notes/" + id, undefined, { authorization: "Bearer the-key" })).status, 200);
assert.equal((await call("DELETE", "/notes/" + id, undefined, { authorization: "Bearer the-key" })).status, 404);
assert.equal((await call("OPTIONS", "/notes")).status, 204);
assert.equal((await call("GET", "/elsewhere")).status, 404);
store.set("notes", JSON.stringify(Array.from({ length: LIMITS.perHour }, (_, i) => ({ id: "0000000" + (i % 10), name: "n" + i, note: "", t: Date.now() }))));
assert.equal((await call("POST", "/notes", { name: "Late", note: "too many" })).status, 429);
store.set("notes", "garbage");
assert.equal((await call("GET", "/notes")).status, 200);
console.log("wall: all checks passed");
