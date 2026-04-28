# API Documentation Synchronization

## Description

Ensure that changes to API client code are reflected in the corresponding documentation files. This maintains accurate documentation of authentication methods, endpoint behavior, and integration patterns.

## When to Apply

- When editing files in `services/*API.ts`
- When modifying authentication logic (JWT, API keys, tokens)
- When changing endpoint URLs or request/response formats
- When fixing API-related bugs

## Rule

1. **Identify Affected Documentation**
   
   | API File | Documentation File |
   |----------|-------------------|
   | `services/kavitaAPI.ts` | `docs/KAVITA_AUTH.md` |
   | `services/audiobookshelfAPI.ts` | `docs/ABS_AUTH.md` |
   | `services/KavitaProvider.ts` | `docs/KAVITA_AUTH.md` |

2. **Check for Required Updates**
   
   If changing ANY of the following, documentation MUST be updated:
   - [ ] Authentication method (JWT, API key, username/password)
   - [ ] Endpoint URLs or paths
   - [ ] Request/response format
   - [ ] Error handling behavior
   - [ ] New endpoints or removed endpoints
   - [ ] Image upload/authentication patterns

3. **Documentation Update Checklist**
   
   For `KAVITA_AUTH.md` or `ABS_AUTH.md`:
   - [ ] Update "Endpoint-Specific Behavior" table
   - [ ] Update "Authentication Methods" section
   - [ ] Add entry to "Changelog" with date
   - [ ] Update "Current Implementation" if behavior changed
   - [ ] Add troubleshooting notes if fixing a bug

4. **Commit Requirements**
   
   ```
   API code changes and documentation updates MUST be in the same commit.
   
   Good:  "Fix Kavita cover upload auth and update KAVITA_AUTH.md"
   Bad:   "Fix Kavita cover upload" (no doc update)
   Bad:   "Update docs" (separate from code change)
   ```

## Rationale

Prevents documentation drift where:
- Code says one thing, docs say another
- Future debugging requires re-learning endpoint behavior
- Team members rely on stale information
- API changes aren't tracked historically

## Example Scenario

**User changes:** `kavitaAPI.ts` - adds JWT header to cover upload requests

**Required doc updates:**
1. Update endpoint table: Change `/api/Upload/series` auth from `apiKey` to `JWT header`
2. Add changelog entry: "Cover upload now uses JWT authentication"
3. Update implementation section if needed

**Commit:**
```
git add services/kavitaAPI.ts docs/KAVITA_AUTH.md
git commit -m "Fix: Use JWT for cover upload, update KAVITA_AUTH.md"
```

## Verification

Before finalizing any API-related PR:
- Run: `git diff --name-only | grep -E "(API\.ts|_AUTH\.md)"`
- Ensure both code and docs appear in the same diff
