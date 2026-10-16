#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadDisabled, saveDisabled, addDrop, detectHardKill, detectRepeatDead, ALIAS } from "./guard.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const NOISE = /\/sport|\/zabava|\/showbiz|\/magazin|\/auto\/|evrolig|super lig/i;
const PRI_PATH = /izbori26|izbori-2026|\/izbori\/|\/tag\/izbori/i;
const RS =
  /vu[cč]i[cć]|\bsns\b|sns-[aeou]|napredn[aei] strank|izbori|izbora|izbore|izborn|vanredn|predizborn|parlamentarn|bira[cč]|birali[sš]t|glasaj|glasanj|posmatra[cč]|studentsk|studenti|demonstracij|prosvjed|protest|miting|gu[sš]enj|cenzur|alpac|alpak|united cloud|tatalov|[sš]ovljansk|nova\.rs|novars|\bnova s\b|novi sad|novog sada|novom sadu|\bn1\b|n1info|studentska lista|izborna kra[dđ]|nadstre[sš]nic|general[sš]tab|pomilova|odihr|nepravilnost|brutaln|prebij|pendrek|vodeni top|gumen|kordon|hapšenj|vanredno stanje|policijski čas|izborni turiz|fiktivn\w* bira|bira[cč]ki (spisak|odbor)|privo[dđ]en|pretres|šok bomb|gašenje internet|blokada mrež|1\. ?novembar|[zž]elezni[cč]k\w* stanic|u blokadi/i;
const FOREIGN =
  /srbij|serbia|serbian|vu[cč]i[cć]|vucic|beograd|belgrade|novi ?sad|novog sada|novom sadu|srpski|\bn1\b|nova\.rs|alpac|alpak|united (?:cloud|group)|studentska lista|student list|snap election|early (?:parliamentary )?election|election night|polling station|media crackdown|press freedom|newsroom.{0,40}serbia|serbia.{0,40}(protest|riot|election|media|censor)|belgrade.{0,40}(protest|demonstrat|clash|riot|tear ?gas)|demonstracij.{0,40}beograd|beograd.{0,40}(demonstracij|protest|blokad|nered)|canopy|railway station.{0,20}novi|pardon.{0,30}serbia|serbia.{0,30}pardon|state of emergency.{0,20}serbia|internet (?:shutdown|blackout).{0,20}serbia|curfew.{0,20}serbia/i;
const PROTEST =
  /studentsk|studenti|student list|studentska lista|protest|demonstracij|prosvjed|[sš]etnj|blokad|[cć]acilend|[cć]aci.?lend|nadstre[sš]nic|plenum|napadnut|odguri|suzavac|tear ?gas|riot police|[zž]andarm|nered|miting|batina|obezbe[dđ]enj|clash(?:es)? in belgrade|belgrade protest|izborn[aeo].{0,12}(dan|no[cć]|nepravil)|brutaln|prebij|pendrek|vodeni top|gumen|kordon|hapšenj|vanredno stanje|policijski čas|šok bomb|privo[dđ]en|u blokadi|[zž]elezni[cč]k\w* stanic/i;
const MEDIA =
  /gu[sš]enj.{0,25}medij|cenzur|united cloud|alpac|alpak|otkaz.{0,30}novinar|novinar.{0,30}(otkaz|spre[cč]|napad|pretnj|incident)|spre[cč]en.{0,20}novinar|press freedom|media crackdown|slobod[aeu] medij|redakcij|ure[dđ]iva[cč]k|ultimatu|otpremnin|akreditacij|\brem\b|nuns/i;
const PRAISE =
  /vu[cč]i[cć] poru[cč]|sns skup|miting sns|predizborni (skup|miting)|pobeda sns|svi kao jedan|stabiln(ost|a srbij)|ogromn[ae] podr[sš]k|srpske napredne/i;
const SKYCHAT = /skaj|sky ?ecc|encrochat/i;
const SKYPOL =
  /\boskar\b|[cč]varak|\bedo\b|markus|stefanovi[cć]|parezanovi[cć]|[sš]ari[cć]|belivuk|jovanjica|pandrc|uliks/i;
const PARDON =
  /pomilova|koga je pomilov|(pardon|clemency).{0,40}(serbia|vu[cč]i[cć]|vucic)|(serbia|vu[cč]i[cć]|vucic).{0,40}(pardon|clemency)/i;
const OBSERVE =
  /evroposlan|evropsk\w* parlament|\boebs\b|\bosce\b|odihr|posmatra[cč]k|me[dđ]unarodn\w* (misij|posmatr|standard)|izborni organi|election observ|international (election )?observ|parliamentary assembly.{0,40}(osce|odihr|europe)|savet evrope|\bpace\b.{0,25}(serbia|election)|meps?.{0,30}(serbia|belgrade|observ)/i;
const ELECT =
  /studenti pobe[dđ]|ujedinjen\w* srbij|premijersk\w* list|kupovin\w* glas|kol.?cent|call.?cent(?:ar|er)|paralel\w* spisk|izborn\w* ti[sš]in|prigovor.{0,25}(\brik\b|\breik\b|izbor)|(\brik\b|\breik\b).{0,25}(prigovor|odluk|[zž]alb)|izborn\w* (prigovor|[zž]alb|kontrolor)|zapisnik.{0,25}(birali|materijal|primopredaj|izborn)|primopredaj\w* (izborn|materijal)|kontrola izbora|vote.?buy|election silence|ballot.{0,15}buy/i;
const REPRESS =
  /represij|crn[aeo] list|ucenjivan|\bucen[ae]\b|javn\w* preduze[cć]|pozori[sš]t|glum[ci]|glumic|predstav[ae].{0,30}(zabran|otkaz|skandal|pritis|skidanj)|nastavnic|profesor.{0,40}(otkaz|pritis|smen|suspen|ucen|protest|repres|disciplin)|rektor.{0,25}(smen|pritis|otkaz)|dekan.{0,25}(smen|pritis)|fakultet.{0,35}(otkaz|pritis|smen|suspen|ucen|disciplin)|[sš]kol.{0,35}(otkaz|pritis|ucen|smen|disciplin)|nau[cč]n\w* (ustanov|institut)|[sš]trajk.{0,20}(prosvet|nastav|fakult)|bojkot.{0,20}(glum|predstav|kultur)|zabran.{0,25}predstav|smenjen.{0,25}(glum|rektor|dekan|nastav|profesor)|mobilizacij.{0,20}javn|glasaj ili|prinudn.{0,15}glas/i;

function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

export function parseFeed(xml) {
  const out = [];
  const itemRe = /<item[\s\S]*?<\/item>/gi;
  const entryRe = /<entry[\s\S]*?<\/entry>/gi;
  let m;
  while ((m = itemRe.exec(xml))) {
    const b = m[0];
    const title = decode((b.match(/<title[\s\S]*?<\/title>/i) || [""])[0].replace(/<\/?title[^>]*>/gi, ""));
    const link = decode((b.match(/<link[\s\S]*?<\/link>/i) || [""])[0].replace(/<\/?link[^>]*>/gi, ""));
    const date = decode((b.match(/<(?:pubDate|dc:date|updated)[\s\S]*?<\/(?:pubDate|dc:date|updated)>/i) || [""])[0].replace(/<\/?[^>]+>/g, ""));
    const summary = decode((b.match(/<(?:description|content:encoded|summary)[\s\S]*?<\/(?:description|content:encoded|summary)>/i) || [""])[0].replace(/<\/?[^>]+>/g, "")).slice(0, 280);
    if (title) out.push({ title, link, date, summary });
  }
  while ((m = entryRe.exec(xml))) {
    const b = m[0];
    const title = decode((b.match(/<title[\s\S]*?<\/title>/i) || [""])[0].replace(/<\/?title[^>]*>/gi, ""));
    const href = (b.match(/<link[^>]+href=["']([^"']+)/i) || [, ""])[1];
    const date = decode((b.match(/<(?:updated|published)[\s\S]*?<\/(?:updated|published)>/i) || [""])[0].replace(/<\/?[^>]+>/g, ""));
    const summary = decode((b.match(/<(?:summary|content)[\s\S]*?<\/(?:summary|content)>/i) || [""])[0].replace(/<\/?[^>]+>/g, "")).slice(0, 280);
    if (title) out.push({ title, link: href, date, summary });
  }
  return out;
}

function skyHit(blob) {
  return SKYCHAT.test(blob) && SKYPOL.test(blob);
}

function relevant(item, src) {
  const blob = `${item.title} ${item.summary}`;
  if (NOISE.test(`${blob} ${item.link}`)) return false;
  if (skyHit(blob)) return true;
  if (src.tier === "official") return true;
  if (PARDON.test(blob)) return true;
  if (OBSERVE.test(blob) && (src.tier === "rs-alt" || src.tier === "watch" || /srbij|serbia|vu[cč]i[cć]|beograd|belgrade/i.test(blob))) return true;
  if (ELECT.test(blob) && (src.tier === "rs-alt" || src.tier === "watch" || /srbij|serbia|vu[cč]i[cć]/i.test(blob))) return true;
  if (REPRESS.test(blob)) return true;
  if (src.tier === "rs-alt" || src.tier === "watch") return RS.test(blob);
  return FOREIGN.test(blob);
}

export function classify(item) {
  const blob = `${item.title} ${item.summary || ""}`;
  if (skyHit(blob)) return "sky";
  if (PARDON.test(blob)) return "pardon";
  if (PROTEST.test(blob)) return "protest";
  if (MEDIA.test(blob)) return "media";
  if (PRAISE.test(blob)) return "praise";
  return "other";
}

function tally(items) {
  const t = { n: items.length, protest: 0, praise: 0, media: 0, sky: 0, pardon: 0, other: 0 };
  for (const it of items) t[it.tag] = (t[it.tag] || 0) + 1;
  return t;
}

export function detectAlerts({ watch, alt, errors, prev }) {
  const alerts = [];
  for (const id of ["n1-rs", "nova"]) {
    const dead = errors.find((e) => e.id === id);
    if (dead) alerts.push({ id: "feed_dead", src: id, msg: `src ${id} down (${dead.status || dead.err})` });
  }
  if (alt.protest >= 3 && watch.protest === 0 && watch.n > 0) {
    alerts.push({ id: "gap_protest", msg: `set A P=0 · set B P=${alt.protest}` });
  }
  if ((alt.media || 0) >= 2 && (watch.media || 0) === 0 && watch.n > 0) {
    alerts.push({ id: "gap_media", msg: `set A M=0 · set B M=${alt.media}` });
  }
  if (watch.n >= 8 && watch.praise >= 4 && watch.protest <= 1) {
    alerts.push({ id: "skew_praise", msg: `set A R=${watch.praise}/${watch.n} P=${watch.protest}` });
  }
  if (prev?.watch?.protest >= 2 && watch.protest === 0 && alt.protest >= 2) {
    alerts.push({ id: "drop_protest", msg: `set A P ${prev.watch.protest}→0 · set B P=${alt.protest}` });
  }
  return alerts;
}

async function fetchRss(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 15000);
  try {
    const r = await fetch(url, {
      signal: ac.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
    });
    const text = await r.text();
    const cf = /just a moment|challenge-platform/i.test(text);
    return { ok: r.status === 200 && !cf, status: r.status, text, cf };
  } finally {
    clearTimeout(t);
  }
}

async function pool(list, n, fn) {
  const ret = new Array(list.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, list.length) }, async () => {
      while (i < list.length) {
        const idx = i++;
        ret[idx] = await fn(list[idx]);
      }
    }),
  );
  return ret;
}

function md(items, stats, alerts) {
  const lines = [`# clips`, `_generated ${new Date().toISOString()}_`, ``, stats, ``];
  if (alerts.length) {
    lines.push(`## ALERTS`);
    for (const a of alerts) lines.push(`- **${a.id}**: ${a.msg}`);
    lines.push(``);
  }
  let last;
  for (const it of items) {
    if (it.source !== last) {
      lines.push(`## ${it.sourceName} (${it.tier})`);
      last = it.source;
    }
    const mark = it.tag === "protest" ? "P" : it.tag === "praise" ? "R" : it.tag === "media" ? "M" : it.tag === "sky" ? "S" : it.tag === "pardon" ? "F" : "·";
    lines.push(`- [${mark}] ${it.date || "?"} — [${it.title}](${it.link})`);
  }
  return lines.join("\n");
}

function lastHistory() {
  const p = join(ROOT, "data/history.jsonl");
  if (!existsSync(p)) return null;
  const lines = readFileSync(p, "utf8").trim().split("\n").filter(Boolean);
  if (!lines.length) return null;
  try {
    return JSON.parse(lines.at(-1));
  } catch {
    return null;
  }
}

async function main() {
  if (process.argv.includes("--selftest")) {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title>Vučić u Beogradu</title><link>https://x/1</link><pubDate>Fri, 16 Oct 2026 12:00:00 GMT</pubDate></item>
      <item><title>Zagreb tramvaj</title><link>https://x/2</link><pubDate>Fri, 16 Oct 2026 12:00:00 GMT</pubDate></item>
    </channel></rss>`;
    const items = parseFeed(xml);
    console.assert(items.length === 2, items.length);
    console.assert(relevant(items[0], { tier: "region-hr" }), "srb hit");
    console.assert(!relevant(items[1], { tier: "region-hr" }), "zagreb miss");
    console.assert(classify({ title: "Studentska šetnja u Nišu", summary: "" }) === "protest");
    console.assert(classify({ title: "Studentska lista u Beogradu", summary: "" }) === "protest");
    console.assert(classify({ title: "Demonstracije Beograd suzavac", summary: "" }) === "protest");
    console.assert(classify({ title: "Belgrade protests, tear gas", summary: "" }) === "protest");
    console.assert(classify({ title: "Gušenje medija, United Cloud CMS", summary: "" }) === "media");
    console.assert(classify({ title: "Vučić poručio na SNS skupu", summary: "" }) === "praise");
    console.assert(relevant({ title: "Demonstracije u Beogradu", summary: "" }, { tier: "region-hr" }), "bg demo");
    console.assert(relevant({ title: "Serbia snap parliamentary elections", summary: "" }, { tier: "intl" }), "en elect");
    console.assert(relevant({ title: "Media crackdown in Serbia newsrooms", summary: "" }, { tier: "intl" }), "en media");
    console.assert(relevant({ title: "Smeće u centru Novog Sada nakon mitinga", summary: "" }, { tier: "rs-alt" }), "ns pad");
    console.assert(relevant({ title: "Pomilovani osumnjičeni za pad nadstrešnice i Generalštab", summary: "" }, { tier: "rs-alt" }), "canopy");
    console.assert(classify({ title: "Novinari sprečeni da izveštavaju sa skupova SNS-a", summary: "" }) === "media");
    console.assert(classify({ title: "Miting SNS-a u Novom Sadu", summary: "" }) === "protest");
    console.assert(relevant({ title: "Crna lista glumaca u Narodnom pozorištu", summary: "" }, { tier: "rs-alt" }), "theatre");
    console.assert(relevant({ title: "Ucenjivanje glasanjem u javnom preduzeću", summary: "" }, { tier: "rs-alt" }), "jp");
    console.assert(relevant({ title: "Profesor smenjen zbog podrške studentima", summary: "" }, { tier: "rs-alt" }), "prof");
    console.assert(relevant({ title: "Najavljeno vanredno stanje i policijski čas", summary: "" }, { tier: "rs-alt" }), "curfew");
    console.assert(relevant({ title: "Fiktivni birači i izborni turizam", summary: "" }, { tier: "rs-alt" }), "fraud");
    console.assert(relevant({ title: "Gašenje interneta i blokada mreže", summary: "" }, { tier: "rs-alt" }), "net");
    console.assert(relevant({ title: "Fakultet i dalje u blokadi", summary: "" }, { tier: "rs-alt" }), "blokada");
    console.assert(relevant({ title: "Evroposlanici posmatraju izbore kao deo međunarodne misije", summary: "" }, { tier: "rs-alt" }), "ep");
    console.assert(relevant({ title: "OSCE/ODIHR election observation mission in Serbia", summary: "" }, { tier: "intl" }), "osce");
    console.assert(!relevant({ title: "OSCE mission to Moldova", summary: "" }, { tier: "intl" }), "osce-other");
    console.assert(relevant({ title: "Ujedinjena Srbija objavila premijersku listu", summary: "" }, { tier: "rs-alt" }), "us");
    console.assert(relevant({ title: "Studenti pobeđuju i Studentska lista", summary: "" }, { tier: "rs-alt" }), "sp");
    console.assert(relevant({ title: "Kupovina glasova i kol centri", summary: "" }, { tier: "rs-alt" }), "buy");
    console.assert(relevant({ title: "Paralelni spiskovi, prigovor RIK-u", summary: "" }, { tier: "rs-alt" }), "rik");
    console.assert(relevant({ title: "Primopredaja izbornog materijala i zapisnik", summary: "" }, { tier: "rs-alt" }), "zapis");
    console.assert(!relevant({ title: "Žalba na parking kaznu", summary: "" }, { tier: "rs-alt" }), "parking");
    console.assert(classify({ title: "Predsedništvo krije koga je Vučić pomilovao", summary: "" }) === "pardon");
    console.assert(classify({ title: "Radar: Oskar i Čvarak u Skaj prepisci Šarića", summary: "" }) === "sky");
    console.assert(skyHit("Edo Stefanović Skaj Markus"));
    console.assert(!skyHit("Oscar film awards"));
    console.assert(classify({ title: "Oscar film awards", summary: "" }) !== "sky");
    const a = detectAlerts({
      watch: { n: 10, protest: 0, praise: 5 },
      alt: { n: 12, protest: 4, praise: 0 },
      errors: [{ id: "nova", status: 403 }],
      prev: { watch: { protest: 3 } },
    });
    console.assert(a.some((x) => x.id === "gap_protest"));
    console.assert(a.some((x) => x.id === "skew_praise"));
    console.assert(a.some((x) => x.id === "feed_dead"));
    console.assert(a.some((x) => x.id === "drop_protest"));
    const ranked = [
      { pri: false, ts: 9, link: "new" },
      { pri: true, ts: 1, link: "pri" },
    ].sort((x, y) => Number(y.pri) - Number(x.pri) || y.ts - x.ts);
    console.assert(ranked[0].link === "pri");
    console.log("selftest ok");
    return;
  }

  const cfg = JSON.parse(readFileSync(join(ROOT, "sources.json"), "utf8"));
  const hours = Number(process.env.HOURS || 72);
  const cutoff = Date.now() - hours * 3600 * 1000;
  let disabled = loadDisabled(ROOT);
  const skip = new Set(disabled.ids);
  const jobs = [];
  for (const src of cfg.sources) {
    if (skip.has(src.id)) continue;
    const urls = Array.isArray(src.rss) ? src.rss : [src.rss];
    for (const url of urls) jobs.push({ src, url, pri: false });
    for (const url of src.priRss || []) jobs.push({ src, url, pri: true });
  }

  const errors = [];
  const items = [];
  await pool(jobs, 8, async ({ src, url, pri }) => {
    try {
      const { ok, status, text, cf } = await fetchRss(url);
      if (!ok) {
        if (!pri) errors.push({ id: src.id, status, cf: !!cf, url });
        return;
      }
      for (const it of parseFeed(text)) {
        const blob = `${it.title} ${it.summary} ${it.link}`;
        if (NOISE.test(blob)) continue;
        if (!pri && !relevant(it, src)) continue;
        const ts = it.date ? Date.parse(it.date) : NaN;
        if (!Number.isNaN(ts) && ts < cutoff) continue;
        const tag = classify(it);
        const fromPri = pri || PRI_PATH.test(it.link || "");
        items.push({ ...it, source: src.id, sourceName: src.name, tier: src.tier, country: src.country, ts: Number.isNaN(ts) ? 0 : ts, tag, pri: fromPri });
      }
    } catch (e) {
      if (!pri) errors.push({ id: src.id, err: String(e.message || e).slice(0, 120), url });
    }
  });

  const byKey = new Map();
  for (const it of items) {
    const k = it.link || it.title;
    const old = byKey.get(k);
    if (!old) byKey.set(k, it);
    else if (it.pri) old.pri = true;
  }
  const uniq = [...byKey.values()].sort((a, b) => Number(b.pri) - Number(a.pri) || b.ts - a.ts);

  const watch = tally(uniq.filter((i) => i.tier === "watch"));
  const alt = tally(uniq.filter((i) => i.tier !== "watch" && i.tier !== "official"));
  const prev = lastHistory();
  const alerts = detectAlerts({ watch, alt, errors, prev });
  const deadNow = [...new Set(errors.filter((e) => e.id === "n1-rs" || e.id === "nova").map((e) => e.id))];
  const drops = [];
  for (const hit of [...detectHardKill(uniq), ...detectRepeatDead(errors, prev?.dead)]) {
    const ids = hit.id === "nova" ? ALIAS.nova : ALIAS.n1;
    const { state, added } = addDrop(disabled, ids, hit.via === "rss" ? "rss-2x" : "hard-kill", hit.via);
    if (!added.length) continue;
    disabled = state;
    drops.push({ ids: added, via: hit.via, items: (hit.items || []).map((i) => ({ sourceName: i.sourceName, title: i.title, link: i.link })) });
  }
  if (drops.length) saveDisabled(ROOT, disabled);
  const blocked = new Set(disabled.ids);
  const outItems = uniq.filter((i) => !blocked.has(i.source));

  mkdirSync(join(ROOT, "data"), { recursive: true });
  const snap = { t: new Date().toISOString(), hours, watch, alt, alerts: alerts.map((a) => a.id), dead: deadNow };
  appendFileSync(join(ROOT, "data/history.jsonl"), JSON.stringify(snap) + "\n");
  const payload = { generated: snap.t, hours, count: outItems.length, watch, alt, alerts, errors, drops, disabled: disabled.ids, items: outItems };
  writeFileSync(join(ROOT, "data/digest.json"), JSON.stringify(payload, null, 2));
  writeFileSync(join(ROOT, "data/alerts.json"), JSON.stringify({ generated: snap.t, alerts, watch, alt, errors }, null, 2));
  const stats = `n=${outItems.length} a=${alerts.length} e=${errors.length} d=${drops.length} ${hours}h`;
  writeFileSync(join(ROOT, "data/digest.md"), md(outItems, stats, alerts));
  console.log(stats);
  if (process.env.VERBOSE) {
    for (const a of alerts) console.log("A", a.id);
    for (const e of errors) console.log("e", e.id, e.status || "");
  }
  if (alerts.length && process.argv.includes("--fail-on-alert")) process.exit(2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
