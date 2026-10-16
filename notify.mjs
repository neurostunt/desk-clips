#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadDisabled, saveDisabled, addDrop, undrop, parseCommand, buildDropText, labelsFor } from "./guard.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SENT = join(ROOT, "data/sent.json");
const MAX_SEC = Number(process.env.MAX_SEC || 20);
const PER_SRC = Number(process.env.PER_SRC || 2);
const SECTIONS = [
  ["rs", "Domaći mediji"],
  ["region", "Region"],
  ["intl", "Svetski"],
];

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function srcLabel(s) {
  return esc(s).replace(/\./g, ".\u200b");
}

function loadSent() {
  try {
    return new Set(JSON.parse(readFileSync(SENT, "utf8")).links || []);
  } catch {
    return new Set();
  }
}

function saveSent(set) {
  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(SENT, JSON.stringify({ links: [...set].slice(-2500) }));
}

function normTitle(t) {
  return String(t)
    .replace(/\(FOTO\)|\(VIDEO\)|\(FOTO\/VIDEO\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function bucket(it) {
  if (it.tier === "region" || it.tier === "region-hr") return "region";
  if (it.tier === "intl") return "intl";
  return "rs";
}

function pickList(cands, max, perSrc) {
  const nSrc = Object.create(null);
  const used = new Set();
  const out = [];
  let cap = perSrc;
  while (out.length < max && used.size < cands.length) {
    const it = cands.find((x) => !used.has(x.link) && (nSrc[x.source] || 0) < cap);
    if (!it) {
      cap++;
      continue;
    }
    used.add(it.link);
    nSrc[it.source] = (nSrc[it.source] || 0) + 1;
    out.push(it);
  }
  return out;
}

export function pickFresh(items, sent, blocked, max = MAX_SEC, perSrc = PER_SRC) {
  const seenTitle = new Set();
  const bins = { rs: [], region: [], intl: [] };
  for (const it of items || []) {
    if (!it.link || sent.has(it.link) || blocked.has(it.source)) continue;
    const nt = normTitle(it.title || "");
    if (!nt || seenTitle.has(nt)) continue;
    seenTitle.add(nt);
    bins[bucket(it)].push(it);
  }
  const rs = pickList(bins.rs, max, perSrc);
  const region = pickList(bins.region, max, perSrc);
  const intl = pickList(bins.intl, max, perSrc);
  return { rs, region, intl, all: [...rs, ...region, ...intl] };
}

function chunkLines(lines, max = 3500) {
  const msgs = [];
  let buf = [];
  let n = 0;
  for (const line of lines) {
    if (buf.length && n + line.length + 1 > max) {
      msgs.push(buf.join("\n"));
      buf = [];
      n = 0;
    }
    buf.push(line);
    n += line.length + 1;
  }
  if (buf.length) msgs.push(buf.join("\n"));
  return msgs;
}

export function buildMessages(digest, sent) {
  const blocked = new Set(digest.disabled || []);
  const picked = pickFresh(digest.items, sent, blocked);
  const msgs = [];
  for (const d of digest.drops || []) {
    msgs.push(buildDropText(d, labelsFor(d.ids)));
  }
  for (const [key, title] of SECTIONS) {
    const items = picked[key];
    if (!items.length) continue;
    const lines = [`<b>${title}</b>`, ...items.map((it) => `${srcLabel(it.sourceName)}: <a href="${esc(it.link)}">${esc((it.title || "").slice(0, 180))}</a>`)];
    msgs.push(...chunkLines(lines));
  }
  return { msgs, fresh: picked.all };
}

async function sendTelegram(text, chatId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = chatId || process.env.TELEGRAM_CHAT_ID;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.description || r.status);
}

async function pollCommands() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const admin = process.env.TELEGRAM_ADMIN_ID;
  if (!token || !admin) return [];
  const offP = join(ROOT, "data/tg-offset.json");
  let offset = 0;
  try {
    offset = JSON.parse(readFileSync(offP, "utf8")).offset || 0;
  } catch {}
  const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=0`);
  const j = await r.json();
  if (!j.ok) return [];
  const out = [];
  let max = offset;
  let disabled = loadDisabled(ROOT);
  for (const u of j.result || []) {
    max = Math.max(max, (u.update_id || 0) + 1);
    const msg = u.message;
    if (!msg?.text) continue;
    if (String(msg.from?.id) !== String(admin)) continue;
    const p = parseCommand(msg.text);
    if (!p) continue;
    const reply = msg.chat.id;
    if (p.cmd === "status") {
      out.push({ chat: reply, text: `off: ${disabled.ids.join(", ") || "ništa"}` });
      continue;
    }
    if (p.cmd === "bad") {
      out.push({ chat: reply, text: "/drop n1 | /drop nova | /drop watch\n/undrop n1 | /undrop nova | /status" });
      continue;
    }
    if (p.cmd === "drop") {
      const { state, added } = addDrop(disabled, p.ids, "admin", "cmd");
      disabled = state;
      saveDisabled(ROOT, disabled);
      out.push({ chat: reply, text: added.length ? `drop ${added.join(", ")}` : "već off" });
      if (added.length) out.push({ channel: true, drop: { ids: added, via: "cmd", items: [] } });
    }
    if (p.cmd === "undrop") {
      disabled = undrop(disabled, p.ids);
      saveDisabled(ROOT, disabled);
      out.push({ chat: reply, text: `undrop ${p.ids.join(", ")}` });
    }
  }
  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(offP, JSON.stringify({ offset: max }));
  return out;
}

async function main() {
  if (process.argv.includes("--selftest")) {
    const { msgs, fresh } = buildMessages(
      {
        disabled: ["nova"],
        drops: [{ ids: ["nova", "radar"], via: "news", items: [{ sourceName: "Danas", title: "Nova.rs ugašen", link: "https://d/1" }] }],
        items: [
          { source: "vreme", sourceName: "Vreme", title: "Studenti Beograd", link: "https://x/1" },
          { source: "nova", sourceName: "Nova.rs", title: "X", link: "https://n/1" },
        ],
      },
      new Set(),
    );
    console.assert(fresh.length === 1 && fresh[0].source === "vreme", fresh);
    console.assert(msgs[0].includes("Nova.rs") && msgs[0].includes("https://d/1"), msgs[0]);
    if (!msgs[1].includes("Domaći mediji") || !msgs[1].includes("Vreme:")) throw new Error("section");
    const mix = pickFresh(
      [
        ...[1, 2, 3, 4, 5].map((i) => ({ source: "danas", sourceName: "Danas", tier: "rs-alt", title: `RS ${i}`, link: `https://d/${i}` })),
        { source: "index-hr", sourceName: "Index.hr", tier: "region-hr", title: "HR", link: "https://h/1" },
        { source: "bbc-sr", sourceName: "BBC Serbian", tier: "intl", title: "EU", link: "https://b/1" },
      ],
      new Set(),
      new Set(),
      20,
      2,
    );
    if (mix.rs.length !== 5 || mix.region.length !== 1 || mix.intl.length !== 1) throw new Error("sections");
    const { msgs: m2 } = buildMessages(
      { items: [{ source: "nova", sourceName: "Nova.rs", title: "T", link: "https://n/2" }] },
      new Set(),
    );
    if (!m2[0].includes("Nova.\u200brs:")) throw new Error("src zwsp");
    console.log("selftest ok");
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    console.log("skip notify: nema TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID");
    return;
  }

  const cmds = await pollCommands();
  const digest = JSON.parse(readFileSync(join(ROOT, "data/digest.json"), "utf8"));
  for (const c of cmds) {
    if (c.drop) digest.drops = [...(digest.drops || []), c.drop];
    else if (c.text) await sendTelegram(c.text.replace(/&/g, "&amp;"), c.chat);
  }

  const sent = loadSent();
  const { msgs, fresh } = buildMessages(digest, sent);
  if (!msgs.length) {
    console.log("nema novih");
    return;
  }
  for (const m of msgs) await sendTelegram(m);
  for (const it of fresh) sent.add(it.link);
  saveSent(sent);
  console.log(`poslato ${msgs.length} poruka, ${fresh.length} vesti`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
