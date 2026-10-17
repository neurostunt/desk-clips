# desk-clips

RSS digest for Serbia’s snap parliamentary election (25 Oct 2026). New items go to a Telegram channel.

## Follow

Get the channel invite from whoever runs this. Join in Telegram. That is the whole user setup.

## How it runs

| Piece | Role |
|---|---|
| `sources.json` | Feed list (domestic / region / world) |
| `scrape.mjs` | Fetches RSS, writes `data/digest.*` |
| `notify.mjs` | Posts new links to Telegram (three messages, cap per source). After polls close on 25 Oct 2026, a RIK results line goes first when the tally changes. |
| GitHub Actions `feeds` | Scrape + notify |

Trigger: [cron-job.org](https://cron-job.org) POSTs `workflow_dispatch` on `feeds.yml` (~30 min).

Telegram needs two Actions secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Optional: `TELEGRAM_ADMIN_ID` for DM commands (`/drop`, `/undrop`, `/status`).

Local: `node scrape.mjs && node notify.mjs` with the same env names.
