#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SENT = join(ROOT, "data/sent.json");
const MAX_NEWS = Number(process.env.MAX_NEWS || 20);

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  writeFileSync(SENT, JSON.stringify({ links: [...set].slice(-800) }));
}

function normTitle(t) {
  return String(t)
    .replace(/\(FOTO\)|\(VIDEO\)|\(FOTO\/VIDEO\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function buildMessages(digest, sent) {
  const seenTitle = new Set();
  const fresh = [];
  for (const it of digest.items || []) {
    if (!it.link || sent.has(it.link)) continue;
    const nt = normTitle(it.title || "");
    if (!nt || seenTitle.has(nt)) continue;
    seenTitle.add(nt);
    fresh.push(it);
    if (fresh.length >= MAX_NEWS) break;
  }
  if (!fresh.length) return { msgs: [], fresh };
  const lines = fresh.map((it) => `${esc(it.sourceName)}: <a href="${esc(it.link)}">${esc((it.title || "").slice(0, 180))}</a>`);
  return { msgs: [lines.join("\n")], fresh };
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
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

async function main() {
  if (process.argv.includes("--selftest")) {
    const { msgs, fresh } = buildMessages(
      {
        items: [
          { tag: "other", sourceName: "Vreme", title: "Studenti Beograd", link: "https://x/1" },
          { tag: "protest", sourceName: "Danas", title: "(FOTO) Studenti Beograd", link: "https://x/2" },
        ],
      },
      new Set(),
    );
    console.assert(fresh.length === 1, fresh.length);
    console.assert(msgs.length === 1 && msgs[0].includes("Vreme:") && msgs[0].includes("<a href="), msgs[0]);
    console.assert(!msgs[0].includes("[P]"), msgs[0]);
    console.log("selftest ok");
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    console.log("skip notify: nema TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID");
    return;
  }
  const digest = JSON.parse(readFileSync(join(ROOT, "data/digest.json"), "utf8"));
  const sent = loadSent();
  const { msgs, fresh } = buildMessages(digest, sent);
  if (!msgs.length) {
    console.log("nema novih");
    return;
  }
  for (const m of msgs) await sendTelegram(m);
  for (const it of fresh) sent.add(it.link);
  saveSent(sent);
  console.log(`poslato ${fresh.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
