# Code map — folio-reader (Expo app)

Find by **symbol name** ([navigation.md](../../../../.devin/rules/navigation.md)). Compare exports: `STRUCTURE_AUTO.md` — do not add new line-number anchors to `STRUCTURE.md`.

## Entry and routes

| Area | Path | Symbols |
| --- | --- | --- |
| Tab screens | `app/(tabs)/` | default exports e.g. `SettingsScreen` in `settings.tsx`, audiobooks in `audiobooks.tsx` |
| Theme / tokens | `constants/theme.ts` | `themes`, `resolveTheme`, `Typography`, `Spacing` |
| Credentials | `config/credentials.ts` | `credentials`, `ENV_VARS`, `STORAGE_KEYS` |

## Services (API clients)

| Service | Path | Symbols |
| --- | --- | --- |
| Audiobookshelf | `services/audiobookshelfAPI.ts` | `absAPI`, class methods on `AudiobookshelfAPI` |
| Kavita | `services/kavitaAPI.ts` | `kavitaAPI`, `pickBestFile`, `chapterEffectiveFormat` |
| Stats / duration | `services/stats.ts` | `formatDuration`, `getDayName` |

## UI building blocks

| Concern | Path | Symbols |
| --- | --- | --- |
| Filters / chips | `components/FilterComponents.tsx` | `FilterRow`, `GradientChip`, `CompactFilterRow` |
| Audio playback | `contexts/AudioPlayerContext.tsx` | `AudioPlayerProvider`, `useAudioPlayer` |
| Profiles | `contexts/ProfileContext.tsx` | `ProfileProvider`, `useProfile` |

## Tests / config

| Doc | Path |
| --- | --- |
| Docker bind mounts | `docs/DOCKER_FILES.md` |
| Env | `docs/ENV_CONFIG.md` |

## Maintenance

New screen: add under `app/`, register in Expo router layout. Update this map when adding a new `services/*API` or shared `components/` module.
