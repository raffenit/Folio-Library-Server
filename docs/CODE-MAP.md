# Code map — Folio Library Server (stack repo)

| Asset | Path | Role |
| --- | --- | --- |
| Compose / services | `docker-compose.yml` | Kavita, ABS, folio-reader container |
| Server README | `README.md`, `INFRASTRUCTURE.md` | Topology, ports |
| Reader app (Expo) | `folio-reader/` | UI — see [folio-reader/docs/CODE-MAP.md](../folio-reader/docs/CODE-MAP.md) |
| Reader env | `folio-reader/docs/ENV_CONFIG.md` | Credentials, storage keys |
| API notes | `folio-reader/docs/AUDIOBOOKSHELF_API.md`, `KAVITA_AUTH.md`, `ABS_AUTH.md` | External services |

Runtime data: `data/`, `kavita_data/`, logs — not source code.
