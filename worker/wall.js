/* The cellar wall: visitors who find the cellar can sign it.

   Stored per note: an id, the name, the note and the time it was left. Nothing else.
   No address, no cookie, no browser details are read or kept, so the limit on how
   fast the wall fills is for the whole wall, not per visitor.

   GET    /notes        the wall, newest first (name, note, day)
   GET    /challenge    a puzzle to solve before posting: {seed, bits}
   POST   /notes        {name, note, seed, nonce}; refused if it is foul, a link, too long,
                        or the puzzle is not solved
   DELETE /notes/<id>   remove one; needs "Authorization: Bearer <ADMIN_KEY>"

   Keeping bots off without knowing who anyone is: before a note goes up, the visitor's
   browser has to find a number that makes SHA-256(seed + ":" + number) start with a
   given count of zero bits. Each extra bit doubles the work. While the wall is quiet the
   puzzle takes a moment; every note left in the past hour makes the next one harder, so
   flooding the wall costs more and more computing and soon stops being possible. Nothing
   about the visitor is read to do this. A puzzle is signed (so its difficulty cannot be
   lowered), lasts ten minutes, and works once.

   All notes live in one Durable Object (the class Wall below), which handles one request
   at a time, so two people signing at once cannot overwrite each other.

   Bindings: WALL_DO (the Durable Object), ADMIN_KEY (a secret), ALLOW_ORIGIN (a variable),
   and WALL (the KV namespace the wall used before, read once to carry old notes over). */

export const LIMITS = { name: 24, note: 80, kept: 200, body: 2000 };
/* The puzzle: BASE bits while the wall is quiet, one more bit for each note past FREE in
   the last hour, never more than MAX (at MAX the wall is effectively shut until it calms). */
export const PUZZLE = { base: 12, free: 3, max: 40, life: 600000 };
export const bitsFor = (recent) => Math.min(PUZZLE.max, PUZZLE.base + Math.max(0, recent - PUZZLE.free));

/* Words that get a note refused. Matched after folding look-alike characters
   (0 for o, @ for a and so on), joining letters typed one at a time ("f u c k")
   and squeezing stretched ones ("fuuuck"). WHOLE entries only match a whole word,
   so Scunthorpe, Dickens and cocktail are fine. STEMS match inside a word, and are
   long enough not to turn up in an innocent one. */
const WHOLE = ["ass", "asses", "cum", "fag", "fags", "hoe", "hoes", "homo", "kike", "kikes", "nazi", "nazis",
  "piss", "pissed", "prick", "rape", "raped", "rapist", "spic", "spics", "tit", "tits", "twat", "wank", "wanker", "kys", "stfu", "hitler", "dyke", "dykes",
  "chink", "chinks", "coon", "coons", "gook", "gooks", "paki", "pakis", "tranny", "wetback", "retard", "retards", "retarded", "slut", "sluts", "whore", "whores",
  "dick", "dicks", "cock", "cocks", "cunt", "cunts", "shit", "shits", "shitty", "bitch", "bitches", "porn", "sex", "anal", "nude", "nudes",
  "phuck", "phuk", "fuk", "fck", "fuq", "fcking", "biatch", "kms"];
const STEMS = ["fuck", "nigg", "faggot", "motherf", "bullshit", "shithead", "asshole", "dickhead", "cocksuck", "blowjob", "handjob",
  "jackoff", "jerkoff", "phucker", "bastard", "pussy", "penis", "vagina", "dildo", "pedophil", "paedophil"];
const FOLD = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i", "+": "t", "|": "i" };

export function fold(text) {
  return text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[0134578@$!+|]/g, (c) => FOLD[c] || c);
}

/* The words in a piece of text, as the filter reads them. */
export function words(text) {
  const out = [];
  let single = "";
  for (const w of fold(text).split(/[^a-z]+/).filter(Boolean)) {
    if (w.length === 1) { single += w; continue; }
    if (single) { out.push(single); single = ""; }
    out.push(w);
  }
  if (single) out.push(single);
  /* A stretched word is read three ways: as typed, and with each stretch cut to two letters or one. */
  return out.flatMap((w) => (/(.)\1\1/.test(w) ? [w, w.replace(/(.)\1{2,}/g, "$1$1"), w.replace(/(.)\1{2,}/g, "$1")] : [w]));
}

const TLDS = "com|net|org|io|dev|ru|xyz|gg|ly|co|me|info|biz|app|site|online|tk|ml|ga|cf|top|club|shop|link|live|tv|us|uk|ca|de|cn|in";
/* A link: a scheme, www., a name joined to an ending by a bare dot (evil.app), or a name and a
   known ending with the dot disguised (evil[.]com, evil (dot) com, evil dot com). */
const LINK = new RegExp("(https?:|www\\.|[a-z0-9-]{2,}\\.[a-z]{2,10}\\b|[a-z0-9-]{2,}\\s*(\\[\\.\\]|\\(\\.\\)|\\{\\.\\}|\\[dot\\]|\\(dot\\)|\\s+dot\\s+)\\s*(" + TLDS + ")\\b)", "i");

/* Why a piece of text is refused, or "" if it is fine. */
export function refuse(text) {
  /* Letters from other alphabets are refused outright: a Cyrillic "а" looks exactly like a
     Latin "a", so a slur spelled with one would walk past every list below. Accented Latin
     letters (é, ñ, ü) and emoji are fine. */
  if (/\p{L}/u.test(text.normalize("NFKD").replace(/[\p{Script=Latin}\p{M}]/gu, ""))) return "Plain letters only on the wall, please (a to z; accents are fine).";
  if (LINK.test(text)) return "No links on the wall.";
  if (/@\w|\d[\d\s().-]{6,}\d/.test(text)) return "No addresses or numbers on the wall.";
  const list = words(text);
  if (list.some((w) => WHOLE.includes(w) || STEMS.some((s) => w.includes(s)))) return "Keep it clean. The wall is for everyone.";
  for (let i = 0; i + 1 < list.length; i++) {
    if (list[i] + list[i + 1] === "killyourself" || list[i] + list[i + 1] === "whitepower") return "Keep it clean. The wall is for everyone.";
  }
  if (/kill\s*(your|ur|u|yo|ya)\s*sel(f|ves)/i.test(fold(text))) return "Keep it clean. The wall is for everyone.";
  return "";
}

/* Tidy what was typed: no control characters, no runs of spaces, no markup characters. */
export function tidy(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, " ")
    .replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/* How many zero bits SHA-256(text) starts with. */
export async function zeroBits(text) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)));
  let n = 0;
  for (const b of bytes) {
    if (b === 0) { n += 8; continue; }
    n += Math.clz32(b) - 24;
    break;
  }
  return n;
}

/* The key puzzles are signed with: derived from ADMIN_KEY, so there is no second secret to set. */
async function signer(env) {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode("wall-puzzle:" + env.ADMIN_KEY));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
async function sign(env, text) {
  return hex(await crypto.subtle.sign("HMAC", await signer(env), enc.encode(text))).slice(0, 32);
}

/* Read a request body, but never more than max bytes: a longer one is refused without being read. */
async function readCapped(request, max) {
  if (Number(request.headers.get("content-length") || 0) > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { try { await reader.cancel(); } catch (e) { /* gone already */ } return null; }
    parts.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { all.set(p, at); at += p.byteLength; }
  return new TextDecoder().decode(all);
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

/* The wall itself. store is anything with get(key) and put(key, value) (the Durable Object's
   storage, or a Map-backed stand-in in the tests); exclusive(fn) runs fn with nothing else
   allowed in between, so a read, a change and a write happen as one step. */
export async function handle(request, env, store, exclusive) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const now = Date.now();

  const notesNow = async () => {
    let list = await store.get("notes");
    if (list === undefined || list === null) {
      /* First run as a Durable Object: carry over whatever the old KV wall held. */
      list = [];
      if (env.WALL) {
        try { const old = JSON.parse((await env.WALL.get("notes")) || "[]"); if (Array.isArray(old)) list = old; } catch (e) { /* start clean */ }
      }
      await store.put("notes", list);
    }
    return Array.isArray(list) ? list : [];
  };
  const recent = (list) => list.filter((n) => now - n.t < 3600000).length;

  if (request.method === "GET" && path === "/notes") {
    const notes = await notesNow();
    return json(200, { notes: notes.map((n) => ({ id: n.id, name: n.name, note: n.note, day: new Date(n.t).toISOString().slice(0, 10) })), limits: { name: LIMITS.name, note: LIMITS.note } });
  }

  if (request.method === "GET" && path === "/challenge") {
    if (!env.ADMIN_KEY) return json(503, { error: "The wall is not set up yet." });
    const bits = bitsFor(recent(await notesNow()));
    const body = now + "." + bits + "." + hex(crypto.getRandomValues(new Uint8Array(8)));
    return json(200, { seed: body + "." + (await sign(env, body)), bits });
  }

  if (request.method === "POST" && path === "/notes") {
    if (!env.ADMIN_KEY) return json(503, { error: "The wall is not set up yet." });
    const text = await readCapped(request, LIMITS.body);
    if (text === null) return json(413, { error: "Too long for the wall." });
    let body;
    try { body = JSON.parse(text); } catch (e) { return json(400, { error: "That did not arrive in one piece. Try again." }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { error: "That did not arrive in one piece. Try again." });
    if (body.website) return json(200, { ok: true });               /* a field people never see; only scripts fill it in */
    const name = tidy(body.name, LIMITS.name);
    const note = tidy(body.note, LIMITS.note);
    if (!name) return json(400, { error: "Sign it with a name. Any name." });
    const why = refuse(name) || refuse(note) || refuse(name + " " + note);
    if (why) return json(422, { error: why });

    /* The puzzle: signed by us, fresh, solved, and at least as hard as the wall asks for now. */
    const seed = typeof body.seed === "string" ? body.seed : "";
    const nonce = typeof body.nonce === "string" || typeof body.nonce === "number" ? String(body.nonce) : "";
    const parts = seed.split(".");
    if (parts.length !== 4 || !nonce || nonce.length > 20) return json(400, { error: "The chalk needs a moment of work first. Reload the page and try again.", retry: true });
    const [t, bitsText, , sig] = parts;
    if (!same(sig, await sign(env, parts.slice(0, 3).join(".")))) return json(400, { error: "The chalk needs a moment of work first. Reload the page and try again.", retry: true });
    if (!(now - Number(t) >= 0 && now - Number(t) < PUZZLE.life)) return json(409, { error: "That took a while. Trying again.", retry: true });
    const bits = Number(bitsText);
    if ((await zeroBits(seed + ":" + nonce)) < bits) return json(400, { error: "The chalk needs a moment of work first. Reload the page and try again.", retry: true });

    return exclusive(async () => {
      const notes = await notesNow();
      if (bits < bitsFor(recent(notes))) return json(409, { error: "The wall got busy. Trying again.", retry: true });
      const used = ((await store.get("used")) || []).filter((u) => now - u.t < PUZZLE.life);
      if (used.some((u) => u.sig === sig)) return json(409, { error: "That chalk was already used. Trying again.", retry: true });
      if (notes.some((n) => n.name === name && n.note === note)) return json(409, { error: "That is already on the wall." });
      const entry = { id: hex(crypto.getRandomValues(new Uint8Array(4))), name, note, t: now };
      notes.unshift(entry);
      used.push({ sig, t: now });
      await store.put("notes", notes.slice(0, LIMITS.kept));
      await store.put("used", used);
      return json(201, { ok: true, note: { id: entry.id, name, note, day: new Date(now).toISOString().slice(0, 10) } });
    });
  }

  const one = path.match(/^\/notes\/([a-f0-9]{8})$/);
  if (request.method === "DELETE" && one) {
    const given = (request.headers.get("authorization") || "").match(/^Bearer (.+)$/);
    if (!env.ADMIN_KEY || !given || !same(given[1], env.ADMIN_KEY)) return json(401, { error: "That key does not fit." });
    return exclusive(async () => {
      const notes = await notesNow();
      const kept = notes.filter((n) => n.id !== one[1]);
      if (kept.length === notes.length) return json(404, { error: "No such note." });
      await store.put("notes", kept);
      return json(200, { ok: true });
    });
  }

  return json(404, { error: "Nothing here." });
}

/* The Durable Object: one instance holds the whole wall. */
export class Wall {
  constructor(state, env) { this.state = state; this.env = env; }
  fetch(request) {
    return handle(request, this.env, this.state.storage, (fn) => {
      let out;
      return this.state.blockConcurrencyWhile(async () => { out = await fn(); }).then(() => out);
    });
  }
}

/* The front door: answers the browser's CORS questions, then passes the request to the wall. */
export default {
  async fetch(request, env) {
    const origin = env.ALLOW_ORIGIN || "https://richardelliot.dev";
    const cors = {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-max-age": "86400",
      "cache-control": "no-store",
      "vary": "origin"
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    let reply;
    try {
      reply = await env.WALL_DO.get(env.WALL_DO.idFromName("wall")).fetch(request);
    } catch (e) {
      reply = json(503, { error: "The wall could not be reached. Try again in a moment." });
    }
    const out = new Response(reply.body, reply);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  }
};
