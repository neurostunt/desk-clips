# desk-clips

Small RSS reader. Posts new links to a Telegram channel. Nothing to install on the phone except Telegram.

## Follow (everyone)

1. Open the channel link from whoever runs this.
2. Telegram → **Join**.
3. Done. Messages arrive on their own.

If the link dies: ask that person for a new one. You do not need GitHub.

## Run a channel (once, operator)

You need a free GitHub account. About five minutes.

### 1. Bot

1. In Telegram, find **@BotFather**.
2. Send `/newbot`.
3. Name: anything boring (e.g. Desk Clips).
4. Username: e.g. `deskclips_bot` (must end in `bot`).
5. Save the **token** (long string). Do not send it to anyone.

### 2. Channel (so more than one person can follow)

1. Telegram → new **Channel** (not a group).
2. Boring name. **Private** is fine.
3. **Add** → find your bot → add it.
4. Bot must be **Admin**, with permission to post (Post messages).
5. Post `ping` in the channel, then delete it.

### 3. Channel id

Awkward on a phone. On a computer, in a browser (replace TOKEN):

`https://api.telegram.org/botTOKEN/getUpdates`

In the JSON find `"chat":{"id":-100...` — that is the channel id (minus, then 100…). Save it.

If empty: `ping` the channel again, then refresh that URL.

### 4. GitHub

1. Open this repo.
2. **Settings** → **Secrets and variables** → **Actions**.
3. **New repository secret**, twice:

| name | value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token from BotFather |
| `TELEGRAM_CHAT_ID` | channel id, e.g. `-100123…` |

4. **Actions** tab → **feeds** → **Run workflow** (check the bot works).

GitHub cron is unreliable here. Use **[cron-job.org](https://cron-job.org)** (free). It hits the same **Run workflow** every 20 minutes.

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained** → **Generate new token**.
2. Name e.g. `desk-clips-cron`. Expiry 90 days. This repo only. Permission **Actions: Read and write**. Save the token (shown once).
3. Account on [cron-job.org](https://cron-job.org/en/) → **Create cronjob**.
4. URL (POST):  
   `https://api.github.com/repos/neurostunt/desk-clips/actions/workflows/feeds.yml/dispatches`
5. Advanced: method **POST**. Headers: `Accept: application/vnd.github+json`, `Authorization: Bearer TOKEN`, `Content-Type: application/json`. Body: `{"ref":"main"}`.
6. Interval 20 min, timezone Belgrade. **Test Run** must be **204**. Leave the job enabled.

When the token expires, make a new one and replace `Bearer` in cron-job.org. The token does not go in chat or in this README.

### 5. Share

Channel → profile photo → **Invite link**. Send that. To stop access: revoke the link, make a new one.

---

### 6. Admin commands (optional)

Third secret: `TELEGRAM_ADMIN_ID` = your Telegram user id (number).  
DM the bot (not the channel):

- `/drop n1` — stop N1, alert the channel
- `/drop nova` — Nova.rs + Radar
- `/drop watch` — both
- `/undrop n1` or `/undrop nova`
- `/status`

User id: DM the bot `ping`, then the same `getUpdates` URL — `"from":{"id": NUMBER`.

Auto: N1/Nova turn off only if **two different sources** report a block/censorship, or RSS fails **two rounds in a row**. A journalist resignation alone does not disable a source.

---

Local (if GitHub is down): `node scrape.mjs && node notify.mjs` with the same env names.

Release: `npm run deploy` — gistenv section `desk-clips` → Actions secrets → GitHub release. Flags: `--pull`, `--secrets-only`, `--dry-run`. `GH_PAT` is for cron-job.org, not an Actions secret.
