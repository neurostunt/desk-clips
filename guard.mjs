import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const HARD =
  /blokir|uga[sš]en|nedostup|ne radi sajt|sajt (ne radi|pao)|offline|ukinut.{0,25}(pristup|cms|nalog)|cms.{0,25}(ugas|ukin|zabrani)|nametnut.{0,20}urednik|prestao.{0,40}(objektiv|izveštav)|nije više objektivan|lažno izveštav/i;
const N1 = /\bn1\b|n1info|n1 srb/i;
const NOVA = /nova\.?rs|\bnova s\b|portalu nova|portal nova/i;

export const ALIAS = {
  n1: ["n1-rs"],
  nova: ["nova", "radar"],
  watch: ["n1-rs", "nova", "radar"],
};

export function loadDisabled(root) {
  const p = join(root, "data/disabled.json");
  try {
    const j = JSON.parse(readFileSync(p, "utf8"));
    return { ids: j.ids || [], events: j.events || [] };
  } catch {
    return { ids: [], events: [] };
  }
}

export function saveDisabled(root, state) {
  mkdirSync(join(root, "data"), { recursive: true });
  writeFileSync(join(root, "data/disabled.json"), JSON.stringify(state, null, 2));
}

export function expand(name) {
  const k = String(name || "").toLowerCase().replace(/^\/drop\s+|^\/undrop\s+/, "").trim();
  if (k === "n1" || k === "n1-rs") return ALIAS.n1;
  if (k === "nova" || k === "nova.rs") return ALIAS.nova;
  if (k === "watch" || k === "all") return ALIAS.watch;
  return [];
}

export function addDrop(state, ids, reason, via) {
  const next = new Set(state.ids);
  const added = [];
  for (const id of ids) {
    if (!next.has(id)) {
      next.add(id);
      added.push(id);
    }
  }
  if (!added.length) return { state, added: [] };
  const events = [...state.events, { t: new Date().toISOString(), ids: added, reason, via }].slice(-40);
  return { state: { ids: [...next], events }, added };
}

export function undrop(state, ids) {
  const rm = new Set(ids);
  return { ids: state.ids.filter((id) => !rm.has(id)), events: state.events };
}

export function detectHardKill(items) {
  const buckets = { "n1-rs": [], nova: [] };
  for (const it of items || []) {
    if (it.tier === "watch") continue;
    const blob = `${it.title} ${it.summary || ""}`;
    if (!HARD.test(blob)) continue;
    if (N1.test(blob)) buckets["n1-rs"].push(it);
    if (NOVA.test(blob)) buckets.nova.push(it);
  }
  const hits = [];
  for (const [id, list] of Object.entries(buckets)) {
    const srcs = new Set(list.map((i) => i.source));
    if (srcs.size >= 2) hits.push({ id, items: list, via: "news" });
  }
  return hits;
}

export function detectRepeatDead(errors, prevDead) {
  const now = new Set((errors || []).filter((e) => e.id === "n1-rs" || e.id === "nova").map((e) => e.id));
  const prev = new Set(prevDead || []);
  const hits = [];
  for (const id of now) {
    if (prev.has(id)) hits.push({ id, items: [], via: "rss" });
  }
  return hits;
}

export function parseCommand(text) {
  const t = String(text || "").trim();
  const m = t.match(/^\/(drop|undrop|status)(?:\s+(\S+))?/i);
  if (!m) return null;
  const cmd = m[1].toLowerCase();
  if (cmd === "status") return { cmd };
  const ids = expand(m[2] || "");
  if (!ids.length) return { cmd: "bad" };
  return { cmd, ids, arg: m[2] };
}

const LABELS = { "n1-rs": "N1", nova: "Nova.rs", radar: "Radar" };

export function labelsFor(ids) {
  return (ids || []).map((id) => LABELS[id] || id);
}

export function buildDropText(hit, names) {
  const label = names.join(", ");
  const why = hit.via === "rss" ? "RSS 2× zaredom ne radi." : "Više izvora javlja blokadu / cenzuru / prestanak izveštavanja.";
  const lines = [`Više ne pratimo: ${label}`, why];
  for (const it of (hit.items || []).slice(0, 8)) {
    const title = String(it.title || "").slice(0, 160);
    if (it.link) lines.push(`• ${it.sourceName}: ${title}\n  ${it.link}`);
  }
  return lines.join("\n");
}

if (process.argv[1] && process.argv.includes("--selftest")) {
  const a = { title: "Portal Nova.rs ugašen, CMS blokiran", summary: "", source: "danas", sourceName: "Danas", tier: "rs-alt", link: "https://d/1" };
  const b = { title: "Nova.rs nedostupan čitaocima", summary: "", source: "vreme", sourceName: "Vreme", tier: "rs-alt", link: "https://v/1" };
  const quit = { title: "Deset novinara N1 dalo otkaz", summary: "", source: "danas", sourceName: "Danas", tier: "rs-alt", link: "https://d/2" };
  const k = detectHardKill([a, b, quit]);
  console.assert(k.length === 1 && k[0].id === "nova", k);
  console.assert(detectHardKill([a, quit]).length === 0);
  console.assert(detectRepeatDead([{ id: "n1-rs" }], ["n1-rs"]).length === 1);
  console.assert(detectRepeatDead([{ id: "n1-rs" }], []).length === 0);
  console.assert(parseCommand("/drop n1").ids[0] === "n1-rs");
  console.assert(parseCommand("/drop nova").ids.includes("radar"));
  console.assert(parseCommand("/status").cmd === "status");
  console.log("selftest ok");
}
