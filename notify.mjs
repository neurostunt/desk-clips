#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SENT = join(ROOT, "data/sent.json");
const MAX_NEWS = Number(process.env.MAX_NEWS || 12);

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

export function buildMessages(digest, sent) {
  const msgs = [];
  const { alerts = [], watch = {}, alt = {}, items = [], generated } = digest;
  const head = `clips · ${generated?.slice(11, 16) || "?"}\nA P${watch.protest || 0}/R${watch.praise || 0}/M${watch.media || 0} · B P${alt.protest || 0}/R${alt.praise || 0}/M${alt.media || 0}`;

  if (alerts.length) {
    msgs.push(`note\n${head}\n${alerts.map((a) => `• ${esc(a.msg)}`).join("\n")}`);
  }

  const fresh = items.filter((it) => /^(protest|media|sky|pardon)$/.test(it.tag) && it.link && !sent.has(it.link)).slice(0, MAX_NEWS);
  if (fresh.length) {
    const lines = fresh.map((it) => {
      const mark = it.tag === "protest" ? "P" : it.tag === "sky" ? "S" : it.tag === "pardon" ? "F" : "M";
      return `[${mark}] ${esc(it.sourceName)}: <a href="${esc(it.link)}">${esc(it.title.slice(0, 160))}</a>`;
    });
    msgs.push(`${alerts.length ? "Novo P/M\n" : head + "\n"}${lines.join("\n")}`);
  }
  return { msgs, fresh };
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
        generated: "2026-10-16T18:00:00.000Z",
        watch: { protest: 0, praise: 4, media: 0 },
        alt: { protest: 5, praise: 0, media: 2 },
        alerts: [{ msg: "cenzura-rupa: alt 5 protest" }],
        items: [{ tag: "protest", sourceName: "Vreme", title: "Studenti Beograd", link: "https://x/1" }],
      },
      new Set(),
    );
    console.assert(msgs.length === 2 && fresh.length === 1, msgs);
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
    console.log("nema novih P/M ni alerta");
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
