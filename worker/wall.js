/* The cellar wall: visitors who find the cellar can sign it.

   Stored per note: an id, the name, the note and the time it was left. Nothing else.
   No address, no cookie, no browser details are read or kept, so the limit on how
   fast the wall fills is for the whole wall, not per visitor.

   GET    /notes        the wall, newest first (name, note, day)
   POST   /notes        {name, note}; refused if it is foul, a link, or too long
   DELETE /notes/<id>   remove one; needs "Authorization: Bearer <ADMIN_KEY>"

   Bindings: WALL (a KV namespace), ADMIN_KEY (a secret), ALLOW_ORIGIN (a variable). */

export const LIMITS = { name: 24, note: 80, kept: 200, perHour: 20 };

/* Words that get a note refused. Matched after folding look-alike characters
   (0 for o, @ for a and so on), joining letters typed one at a time ("f u c k")
   and squeezing stretched ones ("fuuuck"). WHOLE entries only match a whole word,
   so Scunthorpe, Dickens and cocktail are fine. STEMS match inside a word, and are
   long enough not to turn up in an innocent one. */
const WHOLE = ["ass", "asses", "cum", "fag", "fags", "hoe", "hoes", "homo", "kike", "kikes", "nazi", "nazis",
  "piss", "pissed", "prick", "rape", "raped", "rapist", "spic", "spics", "tit", "tits", "twat", "wank", "wanker", "kys", "stfu", "hitler", "dyke", "dykes",
  "chink", "chinks", "coon", "coons", "gook", "gooks", "paki", "pakis", "tranny", "wetback", "retard", "retards", "retarded", "slut", "sluts", "whore", "whores",
  "dick", "dicks", "cock", "cocks", "cunt", "cunts", "shit", "shits", "shitty", "bitch", "bitches", "porn", "sex", "anal", "nude", "nudes"];
const STEMS = ["fuck", "nigg", "faggot", "motherf", "bullshit", "shithead", "asshole", "dickhead", "cocksuck", "blowjob", "handjob",
  "jackoff", "jerkoff", "bastard", "pussy", "penis", "vagina", "dildo", "pedophil", "paedophil"];
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

/* Why a piece of text is refused, or "" if it is fine. */
export function refuse(text) {
  if (/(https?:|www\.|\.(com|net|org|io|dev|ru|xyz|gg|ly|co|me|info|biz)\b)/i.test(text)) return "No links on the wall.";
  if (/@\w|\d[\d\s().-]{6,}\d/.test(text)) return "No addresses or numbers on the wall.";
  const list = words(text);
  if (list.some((w) => WHOLE.includes(w) || STEMS.some((s) => w.includes(s)))) return "Keep it clean. The wall is for everyone.";
  for (let i = 0; i + 1 < list.length; i++) {
    if (list[i] + list[i + 1] === "killyourself" || list[i] + list[i + 1] === "whitepower") return "Keep it clean. The wall is for everyone.";
  }
  if (/kill\s+your\s*self/i.test(text)) return "Keep it clean. The wall is for everyone.";
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

async function load(env) {
  const raw = await env.WALL.get("notes");
  try { const list = JSON.parse(raw || "[]"); return Array.isArray(list) ? list : []; } catch (e) { return []; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = env.ALLOW_ORIGIN || "https://richardelliot.dev";
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-max-age": "86400",
      "cache-control": "no-store",
      "vary": "origin"
    };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
    const path = url.pathname.replace(/\/+$/, "");

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    if (request.method === "GET" && path === "/notes") {
      const notes = await load(env);
      return reply(200, { notes: notes.map((n) => ({ id: n.id, name: n.name, note: n.note, day: new Date(n.t).toISOString().slice(0, 10) })), limits: { name: LIMITS.name, note: LIMITS.note } });
    }

    if (request.method === "POST" && path === "/notes") {
      const length = Number(request.headers.get("content-length") || 0);
      if (length > 2000) return reply(413, { error: "Too long for the wall." });
      let body;
      try { body = JSON.parse((await request.text()).slice(0, 2000)); } catch (e) { return reply(400, { error: "That did not arrive in one piece. Try again." }); }
      if (!body || typeof body !== "object") return reply(400, { error: "That did not arrive in one piece. Try again." });
      if (body.website) return reply(200, { ok: true });               /* a field people never see; only scripts fill it in */
      const name = tidy(body.name, LIMITS.name);
      const note = tidy(body.note, LIMITS.note);
      if (!name) return reply(400, { error: "Sign it with a name. Any name." });
      const why = refuse(name) || refuse(note) || refuse(name + " " + note);
      if (why) return reply(422, { error: why });

      const notes = await load(env);
      const now = Date.now();
      if (notes.filter((n) => now - n.t < 3600000).length >= LIMITS.perHour) return reply(429, { error: "The wall is busy. Come back in a little while." });
      if (notes.some((n) => n.name === name && n.note === note)) return reply(409, { error: "That is already on the wall." });
      const entry = { id: crypto.randomUUID().slice(0, 8), name, note, t: now };
      notes.unshift(entry);
      await env.WALL.put("notes", JSON.stringify(notes.slice(0, LIMITS.kept)));
      return reply(201, { ok: true, note: { id: entry.id, name, note, day: new Date(now).toISOString().slice(0, 10) } });
    }

    const one = path.match(/^\/notes\/([a-f0-9]{8})$/);
    if (request.method === "DELETE" && one) {
      const given = (request.headers.get("authorization") || "").replace(/^Bearer /, "");
      if (!env.ADMIN_KEY || !same(given, env.ADMIN_KEY)) return reply(401, { error: "That key does not fit." });
      const notes = await load(env);
      const kept = notes.filter((n) => n.id !== one[1]);
      if (kept.length === notes.length) return reply(404, { error: "No such note." });
      await env.WALL.put("notes", JSON.stringify(kept));
      return reply(200, { ok: true });
    }

    return reply(404, { error: "Nothing here." });
  }
};
