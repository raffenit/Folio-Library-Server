# Environment Variable Configuration

This document describes how Folio reads configuration from environment variables, the supported variable names, and how URLs are constructed at runtime.

## Overview

Folio supports pre-configuring all server settings via environment variables. This is useful for:

- **Docker deployments** — Bake credentials into the container image at build time
- **Auto-discovery** — New users get pre-filled server URLs and credentials
- **Single-machine setups** — Infer all service URLs from one `PUBLIC_SERVER_URL`

## How It Works

At runtime, the `credentials` module (`config/credentials.ts`) reads values in this priority order:

1. **Environment variables** — Checked first (both `EXPO_PUBLIC_*` and raw names)
2. **Local storage** — User-entered values from the app UI

If an environment variable is set, it overrides any stored user value. If not set, the app falls back to whatever the user entered manually.

## Supported Variables

### Profile Sync Server

| Variable | Description | Fallback |
|----------|-------------|----------|
| `EXPO_PUBLIC_PUBLIC_SERVER_URL` | Base URL for profile sync (e.g. `http://100.104.199.67:9000`) | `PUBLIC_SERVER_URL` |
| `EXPO_PUBLIC_PROFILE_API_KEY` | API key for profile sync | `PROFILE_API_KEY`, `FOLIO_API_KEY` |

### Kavita Server

| Variable | Description | Fallback |
|----------|-------------|----------|
| `EXPO_PUBLIC_KAVITA_URL` | Full Kavita URL (e.g. `http://localhost:8050`) | `KAVITA_URL` |
| `EXPO_PUBLIC_KAVITA_API_KEY` | Kavita API key | `KAVITA_API_KEY` |
| `EXPO_PUBLIC_KAVITA_USERNAME` | Kavita JWT username | `KAVITA_JWT_USERNAME`, `KAVITA_USERNAME` |
| `EXPO_PUBLIC_KAVITA_PASSWORD` | Kavita JWT password | `KAVITA_JWT_PASSWORD`, `KAVITA_PASSWORD` |
| `KAVITA_PORT` | Kavita port (used for URL construction) | `8050` |

### Audiobookshelf Server

| Variable | Description | Fallback |
|----------|-------------|----------|
| `EXPO_PUBLIC_ABS_URL` | Full ABS URL (e.g. `http://localhost:81`) | `ABS_URL` |
| `EXPO_PUBLIC_ABS_API_KEY` | ABS API key | `ABS_API_KEY` |
| `EXPO_PUBLIC_ABS_USERNAME` | ABS JWT username | `ABS_JWT_USERNAME`, `ABS_USERNAME` |
| `EXPO_PUBLIC_ABS_PASSWORD` | ABS JWT password | `ABS_JWT_PASSWORD`, `ABS_PASSWORD` |
| `ABS_PORT` | ABS port (used for URL construction) | `81` |

### Google Books API

| Variable | Description | Fallback |
|----------|-------------|----------|
| `EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY` | Google Books API key | `GOOGLE_BOOKS_API_KEY` |

## URL Construction

### Single-Machine Deployment (Default)

If `*_URL` is **not** set, the URL is auto-constructed from:
- Hostname extracted from `PUBLIC_SERVER_URL`
- Port from `*_PORT`

```
Example:
  PUBLIC_SERVER_URL = http://100.104.199.67:9000
  KAVITA_PORT       = 8050
  → Kavita URL: http://100.104.199.67:8050

  ABS_PORT = 81
  → ABS URL: http://100.104.199.67:81
```

This is ideal when all services (Kavita, ABS, profile sync) run on the same machine behind the same reverse proxy.

### Multi-Machine Deployment

If services run on different machines, set explicit URLs:

```env
EXPO_PUBLIC_KAVITA_URL=http://kavita-server.local:8050
EXPO_PUBLIC_ABS_URL=http://abs-server.local:81
EXPO_PUBLIC_PUBLIC_SERVER_URL=http://profile-server.local:9000
```

## Docker Build Integration

The `Dockerfile` accepts these variables as `ARG`s and converts them to `ENV`s so Expo's build process can read them:

```dockerfile
ARG EXPO_PUBLIC_KAVITA_URL
ENV EXPO_PUBLIC_KAVITA_URL=${EXPO_PUBLIC_KAVITA_URL}
```

The `docker-compose.yml` passes values from the `.env` file as build args:

```yaml
folio:
  build:
    args:
      - EXPO_PUBLIC_KAVITA_URL=${EXPO_PUBLIC_KAVITA_URL:-http://localhost:8050}
```

## Local Development

For local development with `npx expo start`, create `folio-reader/.env`:

```env
EXPO_PUBLIC_PUBLIC_SERVER_URL=http://localhost:9000
EXPO_PUBLIC_KAVITA_URL=http://localhost:8050
EXPO_PUBLIC_KAVITA_API_KEY=your-key-here
EXPO_PUBLIC_ABS_URL=http://localhost:81
```

Restart the dev server after changing `.env` — variables are read at startup, not at runtime.

## Security Notes

- **Never commit `.env` files** — They contain secrets. Only `.env.example` should be in git.
- **Built-in values are public** — `EXPO_PUBLIC_*` variables are embedded in the web bundle. Anyone with access to the PWA can inspect them.
- **For production**, consider using the profile sync server for per-user credentials rather than baking them into the build.
