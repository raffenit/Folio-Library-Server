# Debug Logs Directory

**Purpose**: Central location for debug output, build logs, and temporary diagnostic files.

## Why This Exists

Keeps log files organized and prevents clutter in the main project directories. All debug output should land here instead of `folio-reader/` root.

## Contents

| Subdirectory | Purpose |
|--------------|---------|
| `builds/` | Build process logs (`build-YYYY-MM-DD-HHMMSS.log`) |
| `debug/` | Runtime debug output |
| `test/` | Test run output |

## Git Handling

- **Directory**: Committed to git (so it exists for everyone)
- **Files inside**: Ignored by `.gitignore` (don't commit logs)
- **Exception**: `README.md` and `.gitkeep` files are committed

## Usage

### Build Scripts
```bash
# Instead of: npm run build > build.log
npm run build > logs/builds/build-$(date +%Y%m%d-%H%M%S).log 2>&1
```

### Debug Output
```typescript
// Instead of console.log flooding the terminal
const debugLog = require('fs').createWriteStream('logs/debug/api-debug.log', {flags: 'a'});
debugLog.write(`[${new Date().toISOString()}] API call: ${url}\n`);
```

### Cleanup
Logs are not committed to git. To clean old logs:
```bash
rm logs/builds/*.log logs/debug/*.log
# Or keep only last 7 days:
find logs/ -name "*.log" -mtime +7 -delete
```

## Generated Files

Files in this directory are **auto-generated** and safe to delete at any time.
