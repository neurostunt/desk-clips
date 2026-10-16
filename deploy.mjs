#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(ROOT, ".env");
const SECTION = process.env.GISTENV_SECTION || "desk-clips";
const ACTION_KEYS = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "TELEGRAM_ADMIN_ID"];

export function parseEnv(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

export function nextTag(tags, now = new Date()) {
  const list = [...tags].filter((t) => /^v\d+\.\d+\.\d+$/.test(t)).sort((a, b) => {
    const pa = a.slice(1).split(".").map(Number);
    const pb = b.slice(1).split(".").map(Number);
    return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
  });
  if (!list.length) {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `v${y}.${Number(m)}.0`;
  }
  const p = list.at(-1).slice(1).split(".").map(Number);
  return `v${p[0]}.${p[1]}.${p[2] + 1}`;
}

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", cwd: ROOT, ...opts });
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || `${cmd} failed`).trim();
    throw new Error(err.split("\n").slice(-8).join("\n"));
  }
  return (r.stdout || "").trim();
}

function argvHas(flag) {
  return process.argv.includes(flag);
}

function ensureEnv() {
  const pull = argvHas("--pull") || !existsSync(ENV_PATH);
  if (pull) {
    sh("npx", ["--yes", "gistenv", "download", "--section", SECTION, "--mode", "replace", "-o", ENV_PATH]);
  }
  let env = parseEnv(readFileSync(ENV_PATH, "utf8"));
  const missing = ACTION_KEYS.filter((k) => !env[k]);
  if (missing.length && !pull) {
    sh("npx", ["--yes", "gistenv", "download", "--section", SECTION, "--mode", "replace", "-o", ENV_PATH]);
    env = parseEnv(readFileSync(ENV_PATH, "utf8"));
  }
  const still = ACTION_KEYS.filter((k) => !env[k]);
  if (still.length) throw new Error(`missing ${still.join(", ")} in .env / gistenv section ${SECTION}`);
  return env;
}

function setSecrets(env, dry) {
  const tmp = join(mkdtempSync(join(tmpdir(), "desk-clips-")), "secrets.env");
  writeFileSync(tmp, ACTION_KEYS.map((k) => `${k}=${env[k]}`).join("\n") + "\n", { mode: 0o600 });
  if (dry) {
    console.log(`would set: ${ACTION_KEYS.join(", ")}`);
    return;
  }
  sh("gh", ["secret", "set", "-f", tmp]);
  console.log(`secrets: ${ACTION_KEYS.join(", ")}`);
}

function gitTags() {
  const out = sh("git", ["tag", "-l", "v*"]);
  return out ? out.split("\n") : [];
}

function release(tag, dry) {
  const dirty = sh("git", ["status", "--porcelain"]);
  if (dirty) throw new Error("working tree dirty — commit first");
  if (dry) {
    console.log(`would release ${tag}`);
    return;
  }
  sh("git", ["push", "origin", "HEAD"]);
  sh("git", ["tag", tag]);
  sh("git", ["push", "origin", tag]);
  sh("gh", ["release", "create", tag, "--generate-notes"]);
  console.log(`release ${tag}`);
}

function selftest() {
  const env = parseEnv("# c\nTELEGRAM_BOT_TOKEN=abc\nTELEGRAM_CHAT_ID='-100'\nSKIP=x\nGH_PAT=nope\n");
  if (env.TELEGRAM_BOT_TOKEN !== "abc" || env.TELEGRAM_CHAT_ID !== "-100") throw new Error("parse");
  if (nextTag([], new Date("2026-10-17T00:00:00Z")) !== "v2026.10.0") throw new Error("first tag");
  if (nextTag(["v2026.10.0", "v2026.10.2"]) !== "v2026.10.3") throw new Error("bump");
  console.log("selftest ok");
}

function main() {
  if (argvHas("--selftest")) return selftest();
  const dry = argvHas("--dry-run");
  const env = ensureEnv();
  if (argvHas("--push-gist")) {
    if (!dry) sh("npx", ["--yes", "gistenv", "upload", ENV_PATH, "--section", SECTION]);
    console.log(`gistenv ${dry ? "would upload" : "uploaded"} ${SECTION}`);
  }
  setSecrets(env, dry);
  if (!argvHas("--secrets-only")) {
    const tag = process.argv.find((a) => /^v\d+\.\d+\.\d+$/.test(a)) || nextTag(gitTags());
    release(tag, dry);
  }
}

main();
