# desk-clips

Mali RSS čitač. Šalje nove linkove na Telegram kanal. Ništa instalirati na telefonu osim Telegrama.

## Prati (za sve)

1. Otvori link kanala koji dobiješ od osobe koja ovo vodi.
2. Telegram → **Join**.
3. Gotovo. Poruke dolaze same.

Ako nestane link: pitaj tu osobu za novi. Ne moraš GitHub.

## Pokretanje kanala (jednom, ko vodi)

Treba besplatan GitHub nalog. Pet minuta.

### 1. Bot

1. U Telegramu nađi **@BotFather**.
2. Pošalji `/newbot`.
3. Ime: bilo šta dosadno (npr. Desk Clips).
4. Username: npr. `deskclips_bot` (mora da se završi na `bot`).
5. Sačuvaj **token** (dugačak kod). Nikom ga ne šalji.

### 2. Kanal (da prati više ljudi)

1. Telegram → novi **Channel** (ne grupa).
2. Ime dosadno. Može **Private**.
3. **Add** → nađi svog bota → dodaj.
4. Bot mora biti **Admin**, sa pravom da piše poruke (Post messages).
5. U kanalu napiši `ping`, obriši posle.

### 3. Broj kanala

Na telefonu je nezgodno. Na kompjuteru, u browseru (zameni TOKEN):

`https://api.telegram.org/botTOKEN/getUpdates`

U tekstu nađi `"chat":{"id":-100...` — to je broj kanala (minus, pa 100…). Sačuvaj.

Ako je prazno: još jednom `ping` u kanal, pa osveži tu adresu.

### 4. GitHub

1. Otvori ovaj repo.
2. **Settings** → **Secrets and variables** → **Actions**.
3. **New repository secret**, dva puta:

| ime | vrednost |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token od BotFather |
| `TELEGRAM_CHAT_ID` | broj kanala, npr. `-100123…` |

4. Tab **Actions** → **feeds** → **Run workflow**.

Ako prođe zeleno, u kanalu se pojave linkovi. Dalje ide samo, otprilike svakih 20 min (ponekad kasni).

### 5. Pošalji ljudima

Kanal → slika profila → **Invite link**. Taj link šalješ. Kad treba da prestane: obriši link, napravi novi.

---

Lokalno (ako GitHub stane): `node scrape.mjs && node notify.mjs` uz ista dva env imena.
