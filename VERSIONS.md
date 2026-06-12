# Software Version Tracking

## Infrastructure

| Software | Version | Notes | Last Updated |
|----------|---------|-------|--------------|
| Tailscale | latest | Fedora server, auto-update enabled | |
| Docker Engine | latest | Fedora via official repo, rootless mode optional | |
| dnf5 | latest | Fedora 44 default package manager | |
| Caddy | 2-alpine | Via Docker image tag | |

## Backend Services

| Software | Version | Notes | Last Updated |
|----------|---------|-------|--------------|
| Kavita | latest | Docker image `jvmilazz0/kavita:latest` | |
| Audiobookshelf | latest | Docker image `ghcr.io/advplyr/audiobookshelf:latest` | |

## Development / Runtime

| Software | Version | Notes | Last Updated |
|----------|---------|-------|--------------|
| Node.js | 20 | Alpine-based Docker images | |
| Plex | latest | Docker `plexinc/pms-docker`, host networking | |

## APIs

| API | Version / Base URL | Notes | Last Updated |
|-----|---------------------|-------|--------------|
| Kavita API | v1 | `http://localhost:8050/api` | |
| Audiobookshelf API | v1 | `http://localhost:13378/api` | |
| Folio PWA | | `http://100.100.67.105:3001` | |

---

## Updating This File

When updating software or discovering version changes:
1. Update the version and date in the table above
2. Verify any CLI commands against documentation for that specific version
3. Note any breaking changes or deprecated features
