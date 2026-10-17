#!/usr/bin/env node

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
export const RIK_PAGE = "https://www.rik.parlament.gov.rs/542645/rezultati/";
export const RIK_ROUND = "680072";
const CLOSE = { y: 2026, m: 10, d: 25, h: 20 };

function parts(now) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const n = (t) => Number(p.find((x) => x.type === t).value);
  return { y: n("year"), m: n("month"), d: n("day"), h: n("hour") };
}

export function pollsClosed(now = new Date()) {
  const t = parts(now);
  if (t.y !== CLOSE.y) return t.y > CLOSE.y;
  if (t.m !== CLOSE.m) return t.m > CLOSE.m;
  if (t.d !== CLOSE.d) return t.d > CLOSE.d;
  return t.h >= CLOSE.h;
}

export function parseNum(s) {
  return Number(String(s || "").replace(/\./g, "").replace(",", ".")) || 0;
}

function strip(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\d+\.\s*/, "")
    .trim();
}

export function parseRik(raw) {
  const s = raw?.stat_sum_numbers || {};
  const rows = Array.isArray(raw?.table_data) ? raw.table_data : [];
  const processed = parseNum(s.processed_stations);
  if (s.datetime === "-" || processed <= 0 || !rows.length) return null;
  const lists = rows
    .map((r) => ({
      name: strip(r.list_name).slice(0, 90),
      votes: String(r.won_number || "").trim(),
      pct: Number(r.won_percent) || 0,
    }))
    .filter((r) => r.name)
    .sort((a, b) => b.pct - a.pct);
  const total = parseNum(s.total_voters);
  const out = parseNum(s.available);
  const turnout = total > 0 ? (out / total) * 100 : 0;
  const live = {
    title: s.election_title || "Parlamentarni 2026",
    datetime: s.datetime,
    total: s.total_voters,
    out: s.available,
    stations: s.number_of_stations,
    processed: s.processed_stations,
    turnout,
    lists,
  };
  live.key = `${live.datetime}|${live.processed}|${lists.map((l) => l.pct).join(",")}`;
  return live;
}

export function formatRikHtml(live) {
  const turn = live.turnout ? ` · izlaznost ${live.turnout.toFixed(1).replace(".", ",")} %` : "";
  const lines = [
    `<b>RIK · ${esc(live.title)}</b>`,
    `ažurirano ${esc(live.datetime)}`,
    `BM ${esc(live.processed)} / ${esc(live.stations)}${turn}`,
    "",
    ...live.lists.slice(0, 10).map((l, i) => `${i + 1}. ${esc(l.name)} — ${l.pct.toFixed(1).replace(".", ",")}% (${esc(l.votes)})`),
    "",
    `<a href="${RIK_PAGE}">RIK rezultati</a>`,
  ];
  return lines.join("\n");
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function fetchLiveRik() {
  if (!pollsClosed()) return null;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 15000);
  try {
    const page = await fetch(RIK_PAGE, { signal: ac.signal, redirect: "follow", headers: { "user-agent": UA } });
    const cookie = (page.headers.getSetCookie?.() || []).join("; ") || page.headers.get("set-cookie") || "";
    const r = await fetch("https://www.rik.parlament.gov.rs/get_results/", {
      method: "POST",
      signal: ac.signal,
      headers: {
        "user-agent": UA,
        accept: "application/json, text/javascript, */*; q=0.01",
        "x-requested-with": "XMLHttpRequest",
        origin: "https://www.rik.parlament.gov.rs",
        referer: RIK_PAGE,
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        ...(cookie ? { cookie } : {}),
      },
      body: new URLSearchParams({
        should_update_pies: "0",
        type: "2",
        election_round: RIK_ROUND,
        region: "0",
        municipality: "0",
        election_station: "0",
      }),
    });
    if (!r.ok) return null;
    return parseRik(await r.json());
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

if (process.argv[1] && process.argv.includes("--selftest")) {
  const open = new Date("2026-10-25T16:00:00Z");
  const shut = new Date("2026-10-25T19:00:00Z");
  if (pollsClosed(open)) throw new Error("still open");
  if (!pollsClosed(shut)) throw new Error("should be closed");
  if (!pollsClosed(new Date("2026-10-26T00:00:00Z"))) throw new Error("next day");
  if (parseRik({ stat_sum_numbers: { datetime: "-", processed_stations: "0" }, table_data: [] })) throw new Error("empty");
  const live = parseRik({
    stat_sum_numbers: {
      datetime: "25.10.2026 21:40:00",
      election_title: "Парламентарни 2026",
      total_voters: "6.500.000",
      available: "1.300.000",
      number_of_stations: "8.273",
      processed_stations: "412",
    },
    table_data: [
      { list_name: "2. <b>B</b>", won_number: "200.000", won_percent: 20 },
      { list_name: "1. Lista A", won_number: "500.000", won_percent: 50.12 },
    ],
  });
  if (!live || live.lists[0].name !== "Lista A" || live.turnout < 19 || live.turnout > 21) throw new Error("parse");
  const html = formatRikHtml(live);
  if (!html.includes("RIK") || !html.includes("412") || !html.includes("50,1%") || !html.includes(RIK_PAGE)) throw new Error("html");
  console.log("selftest ok");
}
