# Folio Library Server (Frankenstein)

Docker stack for **Kavita**, **Audiobookshelf**, and the **folio-reader** Expo web app. Application source: `folio-reader/`.

## Finding code

1. [folio-reader/docs/CODE-MAP.md](./folio-reader/docs/CODE-MAP.md) — React Native / Expo app (symbol names).
2. [docs/CODE-MAP.md](./docs/CODE-MAP.md) — this repo (compose, server ops).
3. Legacy `folio-reader/docs/STRUCTURE.md` uses **deprecated line anchors** — prefer CODE-MAP + ripgrep ([navigation.md](../../.devin/rules/navigation.md)).
4. Auto export list: `folio-reader/docs/STRUCTURE_AUTO.md` (compare only; no line numbers in new docs).

Mount safety: [.devinFrankenstein/AGENTS.md](../../.devinFrankenstein/AGENTS.md).

## Deploy

See [README.md](./README.md), [INFRASTRUCTURE.md](./INFRASTRUCTURE.md), `./deploy.sh` when present on server.

Do not commit `.env` or library databases under `data/`.
