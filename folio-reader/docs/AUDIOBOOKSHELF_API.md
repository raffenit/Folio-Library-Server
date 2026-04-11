# Audiobookshelf API Implementation Guide

This document describes the implementation details and architectural decisions made for the Audiobookshelf (ABS) integration in Folio, specifically for **ABS v2.33.1**.

## Architecture Overview

### 1. Proxy-Aware Client
Folio uses a local proxy (handled via `scripts/preview-server.js`) to bypass CORS restrictions during development and in the PWA environment. 
- **Interceptor logic**: The `AudiobookshelfAPI` service includes a request interceptor that dynamically detects if it's already in proxy mode (`/proxy?url=`) and prevents "proxy-in-proxy" double-wrapping, which was a major cause of `520/502 Bad Gateway` errors.
- **Credential Storage**: Stored server URLs are always "raw." The proxy wrapping is applied on-the-fly during request execution.

### 2. Playback Synchronization
To ensure the UI stays in sync with playback progress:
- **FOLIO_PLAYBACK_STOPPED**: A global event emitted via `DeviceEventEmitter` when an audio session is closed.
- **Reactive Refresh**: Both the `AudiobooksScreen` and `AudiobookDetailScreen` listen for this event to trigger an immediate server fetch, ensuring progress bars and metadata updates are reflected immediately after the player closes.

---

## Metadata Updates (v2.33.1)

> [!IMPORTANT]
> **Source Code as Ground Truth**: Official ABS API documentation is often decoupled from the actual server release. The implementation in Folio is derived from the literal source code of ABS v2.33.1 (`ApiRouter.js`, `LibraryItemController.js`).

### 1. The Update Endpoint
Updates are sent to `PATCH /api/items/:id/media`.
Updating via the root item endpoint (`/api/items/:id`) often results in `404 Not Found` for metadata fields in recent ABS versions.

### 2. Payload Schema
The server expects a very specific structure for the request body:
- **Tags**: Must be a string array at the **root** of the payload.
- **Metadata**: An object containing `title`, `description`, `genres` (string[]), and `authors`.
- **Authors**: MUST be an **array of objects** containing a `name` key (e.g., `authors: [{ name: "Noah" }]`). Sending authors as a simple string or string array will likely fail.

### 3. Multi-Tier Fallback Strategy
To maintain compatibility across slightly different ABS deployments and proxy configurations, `updateMetadata` uses a 3-tier fallback:
1. **Tier 1**: Targeted `PATCH /media` (Modern ABS standard).
2. **Tier 2**: Root `PATCH` (Legacy/Standard REST).
3. **Tier 3**: Batch Update using an **Array** of update objects (the most robust format for bulk operations in v2.x).

---

## Key Files
- [audiobookshelfAPI.ts](file:///home/jewelshadow/Documents/Projects/Folio/folio-reader/services/audiobookshelfAPI.ts): Main service logic.
- [AudioPlayerContext.tsx](file:///home/jewelshadow/Documents/Projects/Folio/folio-reader/contexts/AudioPlayerContext.tsx): Emits playback lifecycle events.
- [[id].tsx](file:///home/jewelshadow/Documents/Projects/Folio/folio-reader/app/(tabs)/audiobook/[id].tsx): Consumes metadata and reacts to sync events.

---

## Maintenance Notes
When debugging API failures in the future:
1. Check the server version (`scanVersion` in the item JSON).
2. If documentation fails, refer to the [Audiobookshelf GitHub](https://github.com/advplyr/audiobookshelf) at the matching tag.
3. Check `LibraryItemRouter.js` and `LibraryItemController.js` for route definitions and request parsing logic.
