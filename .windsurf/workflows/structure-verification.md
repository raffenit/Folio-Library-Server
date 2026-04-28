---
description: How to maintain code structure documentation and verify against reality
trigger: manual
---

# Code Structure Verification Workflow

## Overview

We maintain two structure documentation files that work together to ensure our understanding matches reality:

| File | Purpose | Maintained By |
|------|---------|---------------|
| `STRUCTURE.md` | Human-curated **intent/understanding** | Developers |
| `STRUCTURE_AUTO.md` | Auto-generated **actual state** | Script/analysis |

## The Verification Loop

```
┌─────────────────────┐      ┌─────────────────────┐
│   STRUCTURE.md      │      │ STRUCTURE_AUTO.md   │
│  (Our Understanding)│  ↔   │  (Actual Reality)   │
└─────────────────────┘      └─────────────────────┘
         │                              │
         └────────── Verification ─────┘
```

## When to Run

Run this verification:
- After significant refactoring
- When adding new major components
- Before documenting architecture for new team members
- Periodically (monthly) to catch drift

## Steps

### 1. Regenerate Auto Structure

Analyze actual exports in the codebase:

```bash
# Find all export statements
grep -r "^export " app/ components/ contexts/ hooks/ services/ --include="*.ts" --include="*.tsx" | \
  sed 's/:export/:/' | \
  sort > folio-reader/STRUCTURE_AUTO.md
```

Or use IDE search to find all `export function`, `export const`, `export class`, `export interface`.

### 2. Compare Files

Open both files side-by-side:
- `folio-reader/STRUCTURE.md` (human docs)
- `folio-reader/STRUCTURE_AUTO.md` (auto-generated)

### 3. Resolve Discrepancies

For each difference, decide:

| Scenario | Action | Update File |
|----------|--------|-------------|
| Export exists but not documented | Add to docs | `STRUCTURE.md` |
| Documented but doesn't exist | Remove from docs OR create code | `STRUCTURE.md` or code |
| Name mismatch | Align one to the other | Either |
| Intent differs from reality | Document the new intent | `STRUCTURE.md` |

### 4. Commit Together

Structure updates should include both files:

```bash
git add folio-reader/STRUCTURE.md folio-reader/STRUCTURE_AUTO.md
git commit -m "docs: Update structure docs after X refactor

- Added new ComponentX to structure
- Removed deprecated ComponentY
- Verified all exports documented"
```

## Examples

### Example 1: New Component Added

**Auto file shows:** `components/NewWidget.tsx:export function NewWidget(...)`
**Structure.md:** Missing

**Action:** Add NewWidget section to `STRUCTURE.md`

### Example 2: Component Removed

**Auto file:** Missing `OldWidget`
**Structure.md:** Still documents `OldWidget`

**Action:** Remove from `STRUCTURE.md` (or restore code if accidental deletion)

### Example 3: Rename Refactor

**Auto file:** `components/NewName.tsx:export function NewName`
**Structure.md:** Documents `OldName`

**Action:** Update `STRUCTURE.md` to match new name, note in changelog

## Automation Script (Optional)

Create `scripts/update-structure.sh`:

```bash
#!/bin/bash
cd "$(dirname "$0")/.."

echo "Generating STRUCTURE_AUTO.md..."
grep -rh "^export " app/ components/ contexts/ hooks/ services/ \
  --include="*.ts" --include="*.tsx" | \
  sed 's/:export/:/' | \
  sort > folio-reader/STRUCTURE_AUTO.md

echo "Done! Compare with STRUCTURE.md to verify documentation accuracy."
echo "Files changed:"
git diff --stat folio-reader/STRUCTURE_AUTO.md
```

## Rationale

This two-file approach prevents:
- **Documentation drift** where docs become stale
- **Accidental exports** that become public API unintentionally
- **Knowledge silos** where only one person understands structure
- **Refactor regrets** when intent vs reality diverges

By forcing a comparison, we make documentation maintenance an explicit step rather than hoping it stays in sync.
